# PharmaGo - Multi-Tenant SaaS Backend

PharmaGo is a production-ready, multi-tenant Software-as-a-Service (SaaS) backend designed specifically for pharmacy management. Built with **NestJS** and **Prisma**, it provides robust row-level tenant isolation, allowing multiple pharmacies (tenants) to operate securely from a single database.

## 🚀 Live Environment
- **API Base URL:** `https://pharmago-xpaelqq3.b4a.run/v1`
- **Interactive API Documentation:** `https://pharmago-xpaelqq3.b4a.run/api` *(Powered by Swagger)*

## 🏗️ Tech Stack
- **Framework:** NestJS 11
- **Language:** TypeScript
- **Database:** PostgreSQL (Hosted on Neon.tech)
- **ORM:** Prisma 7
- **Authentication:** JWT (JSON Web Tokens) with Passport
- **Deployment:** Dockerized, hosted on Back4App Containers via GitHub Actions CI/CD.

## 🔐 Core Architecture

### Multi-Tenancy (Row-Level Isolation)
The application enforces strict data isolation at the ORM level. 
A global middleware (`TenantResolverMiddleware`) extracts the `tenant_slug` or `tenant_id` from the authenticated user's JWT, and a custom Prisma Extension automatically injects `{ where: { tenant_id: currentTenant } }` into all database queries and mutations. This ensures that users can *never* access data belonging to another pharmacy, even if they explicitly try.

### Security
- **Global Guards:** All routes are protected by `JwtAuthGuard` by default. Public routes are explicitly marked with the `@Public()` decorator.
- **Helmet:** Automatically sets HTTP security headers.
- **Validation:** Global `ValidationPipe` ensures all incoming payloads match their respective DTOs, stripping out injected/malicious fields.
- **Response Consistency:** Global `ResponseInterceptor` formats all successful responses uniformly as `{ success: true, data: ... }`.

---

## 🛠️ Local Development Setup

### 1. Prerequisites
- **Node.js:** v22.0.0 or higher
- **PostgreSQL:** A local instance or remote connection URI (e.g., Neon DB)
- **Docker** (optional, but recommended for testing the production build locally)

### 2. Environment Variables
Create a `.env` file in the root directory:
```env
DATABASE_URL="postgres://user:password@host/dbname?sslmode=require"
JWT_SECRET="your-super-secret-jwt-key"
JWT_EXPIRES_IN="1d"
```

### 3. Installation
```bash
npm install
```

### 4. Database Setup (Prisma)
Because we use a custom Prisma output directory (`src/prisma/client`), you must run the generate command.
```bash
npm run prisma:generate
npm run prisma:migrate
```

### 5. Running the App
```bash
# Development
npm run start:dev

# Production (Builds and runs from dist/)
npm run build
npm run start:prod
```

---

## 📚 API Collection (Postman)

With our Swagger integration, you no longer need a manual Postman collection file! 

1. Open Postman.
2. Click **Import**.
3. Paste the following Swagger JSON URL:
   `https://pharmago-xpaelqq3.b4a.run/api-json`
4. Postman will automatically generate a complete, up-to-date collection with all endpoints, required headers, and payload structures.

## 🚢 CI/CD & Deployment
The project is fully automated using **GitHub Actions**. Any push to the `main` branch triggers the following pipeline:
1. Installs dependencies using Node 22.
2. Runs ESLint and TypeScript compilation checks.
3. If successful, Back4App automatically pulls the latest commit.
4. Back4App builds the Docker image (which includes a multi-stage process to isolate production dependencies and copy the generated Prisma client).
5. The container is deployed and exposed on port 3000.
