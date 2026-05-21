# Architecture.md — Pharmacy Management System (SaaS, Option A)

---

## 1. Technology Stack

| Layer | Technology | Reason |
|---|---|---|
| Framework | NestJS (TypeScript) | Enforces SOLID, DI by design, modular |
| Database | PostgreSQL 16 | ACID, relational, strong indexing |
| ORM | Prisma + Middleware | Type-safe + tenant isolation injection |
| Cache | Redis | Session tokens, hot drug lookups, dashboard aggregates |
| Auth | JWT (access + refresh tokens) | Carries tenant_id, works with Flutter/Dio |
| Validation | class-validator + class-transformer | DTO-level validation before service layer |
| Docs | Swagger (@nestjs/swagger) | Auto OpenAPI spec → Dart model generation |
| Testing | Jest + Supertest | Unit + E2E (includes cross-tenant isolation tests) |
| Containerization | Docker + docker-compose | Multi-stage builds |
| CI/CD | GitHub Actions | Test → Build → Push → Deploy → Rollback |

---

## 2. System Architecture

```
Flutter App (Android + Web)
        │
        │ HTTPS + JWT (Dio)
        ▼
┌──────────────────────────────────────────┐
│           NestJS API Server              │
│                                          │
│  ┌──────────┐  ┌────────────────────┐   │
│  │ JWT Guard│  │ TenantContext      │   │
│  │ + RBAC   │  │ (AsyncLocalStorage)│   │
│  └──────────┘  └────────────────────┘   │
│                        │                │
│           Prisma Tenant Middleware       │
│        (injects tenant_id everywhere)   │
│                        │                │
│  Controllers → Services → Repositories  │
│                                         │
│  Modules:                               │
│  tenants | auth | users | branches      │
│  drugs | inventory | pos | transactions │
│  suppliers | analytics | reports        │
│  notifications | subscriptions          │
└──────────┬──────────────────────────────┘
           │
     ┌─────┴──────┐
     ▼            ▼
 PostgreSQL      Redis
 (shared DB,   (cache + sessions,
  tenant_id     keyed by tenant)
  on every
  table)
```

---

## 3. Tenant Isolation — How It Works

### 3.1 JWT Payload
Every authenticated token carries the tenant context:
```typescript
interface JwtPayload {
  sub: string;        // user_id
  tenant_id: string;  // ALWAYS present, NEVER from request body
  role: UserRole;
  branch_id: string;
}
```

### 3.2 TenantContext (AsyncLocalStorage)
The JWT guard extracts `tenant_id` and stores it in Node's `AsyncLocalStorage` — a request-scoped store that flows through the entire async call chain without passing it manually:

```typescript
// tenant-context.service.ts
@Injectable()
export class TenantContextService {
  private readonly storage = new AsyncLocalStorage<{ tenantId: string }>();

  run(tenantId: string, fn: () => void) {
    this.storage.run({ tenantId }, fn);
  }

  getTenantId(): string {
    const store = this.storage.getStore();
    if (!store) throw new Error('No tenant context');
    return store.tenantId;
  }
}
```

### 3.3 Prisma Tenant Middleware
Written once, applies to every query in the entire system:

```typescript
prisma.$use(async (params, next) => {
  const tenantId = tenantContextService.getTenantId();

  // Inject on create
  if (params.action === 'create') {
    params.args.data.tenant_id = tenantId;
  }

  // Inject on createMany
  if (params.action === 'createMany') {
    params.args.data = params.args.data.map(
      (item) => ({ ...item, tenant_id: tenantId })
    );
  }

  // Inject on all reads and mutations
  const scopedActions = [
    'findUnique', 'findFirst', 'findMany',
    'update', 'updateMany', 'delete', 'deleteMany', 'count'
  ];
  if (scopedActions.includes(params.action)) {
    params.args.where = {
      ...params.args.where,
      tenant_id: tenantId,
    };
  }

  return next(params);
});
```

**Result:** A developer writing `prisma.inventory.findMany({ where: { branch_id } })` automatically gets `WHERE branch_id = ? AND tenant_id = ?`. Tenant leakage is structurally impossible — not just a convention.

### 3.4 Redis Cache Keys
Cache is also tenant-scoped by key prefix:
```
drug:barcode:{tenantId}:{barcode}
stock:{tenantId}:{drugId}:{branchId}
analytics:daily:{tenantId}:{branchId}:{date}
search:{tenantId}:{query}
```

---

## 4. Module Structure

```
src/
├── main.ts
├── app.module.ts
│
├── common/
│   ├── decorators/         # @Roles(), @CurrentUser(), @Public(), @CurrentTenant()
│   ├── guards/             # JwtAuthGuard, RolesGuard, PlanLimitGuard
│   ├── interceptors/       # LoggingInterceptor, TenantCacheInterceptor
│   ├── filters/            # GlobalExceptionFilter
│   ├── middleware/         # TenantContextMiddleware
│   └── dto/                # PaginationDto, DateRangeDto
│
├── config/
│   ├── database.config.ts
│   ├── redis.config.ts
│   ├── jwt.config.ts
│   └── env.validation.ts
│
├── prisma/
│   ├── prisma.service.ts   # Registers tenant middleware on init
│   ├── tenant.middleware.ts
│   └── schema.prisma
│
├── tenants/                # NEW
│   ├── tenants.module.ts
│   ├── tenants.controller.ts   # register, get, update, suspend
│   ├── tenants.service.ts
│   └── dto/
│
├── subscriptions/          # NEW
│   ├── subscriptions.module.ts
│   ├── subscriptions.service.ts  # plan limits, billing hooks
│   ├── plan-limits.service.ts    # enforces branch/user/drug caps
│   └── dto/
│
├── auth/
│   ├── auth.module.ts
│   ├── auth.controller.ts      # login, refresh, logout
│   ├── auth.service.ts         # returns JWT with tenant_id
│   ├── strategies/
│   └── dto/
│
├── users/
├── branches/
├── drugs/
├── inventory/
├── pos/
├── transactions/
├── suppliers/
├── analytics/
├── reports/
└── notifications/
```

---

## 5. Data Flow — Barcode Sale (Critical Path)

```
Cashier scans barcode
        │
        ▼
GET /drugs/barcode/:code
  JWT Guard → extracts tenant_id → sets TenantContext
        │
        ├─ Redis: GET drug:barcode:{tenantId}:{code}
        │         hit? → return (< 10ms)
        │
        └─ Miss → Prisma query
                  SELECT * FROM drugs
                  WHERE barcode = ? AND tenant_id = ?  ← auto-injected
                  (indexed on both columns)
                  │
                  ├─ SET Redis drug:barcode:{tenantId}:{code} TTL 10min
                  └─ return drug + stock

POST /pos/checkout
  Begin Prisma $transaction():
    ├─ UPDATE inventory SET quantity = quantity - N
    │  WHERE drug_id = ? AND branch_id = ? AND tenant_id = ?
    │  (constraint: quantity >= 0)
    ├─ INSERT INTO transactions (tenant_id injected automatically)
    ├─ INSERT INTO transaction_items
    └─ INSERT INTO stock_movements
  Commit
  Invalidate Redis: drug:barcode:{tenantId}:{code}
  Return receipt
```

---

## 6. Plan Limit Enforcement

```typescript
// plan-limits.service.ts
async checkBranchLimit(tenantId: string): Promise<void> {
  const [tenant, branchCount] = await Promise.all([
    this.getTenantWithPlan(tenantId),
    this.prisma.branch.count() // tenant_id injected by middleware
  ]);

  if (branchCount >= tenant.subscription.plan.max_branches) {
    throw new ForbiddenException(
      `Your plan allows ${tenant.subscription.plan.max_branches} branches. Upgrade to add more.`
    );
  }
}
```

Called via `PlanLimitGuard` on `POST /branches`, `POST /users`, `POST /drugs`.

---

## 7. Authentication Flow

```
POST /tenants/register  [PUBLIC]
  → Create Tenant record
  → Create first User (role: TENANT_OWNER)
  → Create trial Subscription (14 days)
  → Return JWT (with tenant_id)

POST /auth/login  [PUBLIC]
  → Validate credentials
  → Load user.tenant_id
  → Return: { access_token (15min), refresh_token (7d) }
  → JWT payload: { sub, tenant_id, role, branch_id }

All subsequent requests:
  Authorization: Bearer <access_token>
  → JwtAuthGuard: validates token, sets TenantContext
  → RolesGuard: checks role
  → Prisma middleware: injects tenant_id on all queries
```

---

## 8. Deployment Architecture

```
GitHub Push to main
        │
        ▼
GitHub Actions:
  1. Jest unit tests (includes tenant isolation tests)
  2. Playwright E2E tests
  3. Build Docker image (multi-stage)
  4. Push to Docker Hub
  5. SSH to VPS → docker-compose pull + up
  6. Health check → Rollback on failure

VPS (Hetzner CX22+):
  ┌──────────────────────┐
  │   Nginx (SSL/proxy)  │
  ├──────────────────────┤
  │   NestJS Container   │
  ├──────────────────────┤
  │   PostgreSQL         │  ← one DB, all tenants
  ├──────────────────────┤
  │   Redis              │  ← tenant-prefixed keys
  └──────────────────────┘
```

---

## 9. Environment Variables

```env
DATABASE_URL=postgresql://user:password@localhost:5432/pharmacy_saas

REDIS_URL=redis://localhost:6379

JWT_SECRET=<strong_secret>
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=<different_strong_secret>
JWT_REFRESH_EXPIRES_IN=7d

PORT=3000
NODE_ENV=production
ALLOWED_ORIGINS=https://yourfrontend.com

# Billing (when ready)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```
