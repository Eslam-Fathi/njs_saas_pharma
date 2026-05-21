# Data_Models.md — Pharmacy Management System (SaaS, Option A)

---

## Prisma Schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────

enum UserRole {
  SUPER_ADMIN     // Platform level
  TENANT_OWNER    // Pharmacy business owner
  ADMIN           // Branch manager
  PHARMACIST
  CASHIER
  VIEWER
}

enum SubscriptionPlan {
  STARTER
  PRO
  ENTERPRISE
}

enum SubscriptionStatus {
  TRIAL
  ACTIVE
  SUSPENDED
  CANCELLED
}

enum DrugUnit {
  TABLET
  CAPSULE
  BOTTLE
  BOX
  AMPOULE
  SACHET
  TUBE
  VIAL
}

enum PaymentMethod {
  CASH
  CARD
  INSURANCE
  STORE_CREDIT
}

enum TransactionType {
  SALE
  RETURN
}

enum StockMovementType {
  PURCHASE_RECEIVED
  SALE
  RETURN_FROM_CUSTOMER
  RETURN_TO_SUPPLIER
  ADJUSTMENT_INCREASE
  ADJUSTMENT_DECREASE
  PHYSICAL_COUNT_CORRECTION
  EXPIRY_WRITEOFF
}

enum PurchaseOrderStatus {
  DRAFT
  SENT
  PARTIALLY_RECEIVED
  FULLY_RECEIVED
  CANCELLED
}

enum SessionStatus {
  OPEN
  CLOSED
}

enum CartStatus {
  ACTIVE
  HELD
  COMPLETED
  CANCELLED
}

// ─────────────────────────────────────────
// TENANT (SaaS root entity)
// ─────────────────────────────────────────

model Tenant {
  id             String    @id @default(uuid())
  business_name  String
  is_active      Boolean   @default(true)
  created_at     DateTime  @default(now())
  updated_at     DateTime  @updatedAt
  deleted_at     DateTime?

  // Relations
  subscription   Subscription?
  users          User[]
  branches       Branch[]
  categories     Category[]
  manufacturers  Manufacturer[]
  drugs          Drug[]
  inventory      Inventory[]
  inventory_batches InventoryBatch[]
  stock_movements   StockMovement[]
  suppliers         Supplier[]
  purchase_orders   PurchaseOrder[]
  grns              GRN[]
  sessions          CashierSession[]
  carts             Cart[]
  transactions      Transaction[]

  @@index([is_active])
}

model Subscription {
  id                  String             @id @default(uuid())
  tenant_id           String             @unique
  tenant              Tenant             @relation(fields: [tenant_id], references: [id])
  plan                SubscriptionPlan   @default(STARTER)
  status              SubscriptionStatus @default(TRIAL)
  trial_ends_at       DateTime?
  current_period_start DateTime?
  current_period_end   DateTime?
  stripe_customer_id  String?
  stripe_subscription_id String?
  created_at          DateTime           @default(now())
  updated_at          DateTime           @updatedAt

  @@index([status])
}

// ─────────────────────────────────────────
// BRANCH
// ─────────────────────────────────────────

model Branch {
  id          String    @id @default(uuid())
  tenant_id   String                          // ← tenant scope
  tenant      Tenant    @relation(fields: [tenant_id], references: [id])
  name        String
  address     String?
  phone       String?
  vat_number  String?
  vat_rate    Decimal   @default(15.0) @db.Decimal(5, 2)
  timezone    String    @default("Asia/Riyadh")
  is_active   Boolean   @default(true)
  created_at  DateTime  @default(now())
  updated_at  DateTime  @updatedAt
  deleted_at  DateTime?

  users        User[]
  inventory    Inventory[]
  sessions     CashierSession[]
  transactions Transaction[]

  @@index([tenant_id])
  @@index([tenant_id, is_active])
}

// ─────────────────────────────────────────
// USER
// ─────────────────────────────────────────

model User {
  id          String    @id @default(uuid())
  tenant_id   String                          // ← tenant scope
  tenant      Tenant    @relation(fields: [tenant_id], references: [id])
  name        String
  username    String
  password    String    // bcrypt hash
  role        UserRole
  is_active   Boolean   @default(true)
  branch_id   String?
  branch      Branch?   @relation(fields: [branch_id], references: [id])
  created_at  DateTime  @default(now())
  updated_at  DateTime  @updatedAt
  deleted_at  DateTime?

  sessions        CashierSession[]
  transactions    Transaction[]
  stock_movements StockMovement[]
  refresh_tokens  RefreshToken[]

  @@unique([tenant_id, username])    // username unique per tenant, not globally
  @@index([tenant_id])
  @@index([tenant_id, role])
}

model RefreshToken {
  id         String   @id @default(uuid())
  user_id    String
  user       User     @relation(fields: [user_id], references: [id])
  token_hash String   @unique
  expires_at DateTime
  created_at DateTime @default(now())

  @@index([user_id])
}

// ─────────────────────────────────────────
// DRUG CATALOG
// ─────────────────────────────────────────

model Category {
  id        String  @id @default(uuid())
  tenant_id String                          // ← tenant scope
  tenant    Tenant  @relation(fields: [tenant_id], references: [id])
  name_en   String
  name_ar   String?
  drugs     Drug[]

  @@index([tenant_id])
}

model Manufacturer {
  id        String  @id @default(uuid())
  tenant_id String                          // ← tenant scope
  tenant    Tenant  @relation(fields: [tenant_id], references: [id])
  name      String
  country   String?
  drugs     Drug[]

  @@unique([tenant_id, name])
  @@index([tenant_id])
}

model Drug {
  id                    String        @id @default(uuid())
  tenant_id             String                        // ← tenant scope
  tenant                Tenant        @relation(fields: [tenant_id], references: [id])
  name_en               String
  name_ar               String?
  barcode               String
  generic_name          String?
  category_id           String?
  category              Category?     @relation(fields: [category_id], references: [id])
  manufacturer_id       String?
  manufacturer          Manufacturer? @relation(fields: [manufacturer_id], references: [id])
  unit                  DrugUnit      @default(TABLET)
  cost_price            Decimal       @db.Decimal(10, 2)
  sell_price            Decimal       @db.Decimal(10, 2)
  vat_included          Boolean       @default(true)
  requires_prescription Boolean       @default(false)
  description           String?
  image_url             String?
  is_active             Boolean       @default(true)
  created_by            String
  created_at            DateTime      @default(now())
  updated_by            String?
  updated_at            DateTime      @updatedAt
  deleted_at            DateTime?

  inventory             Inventory[]
  transaction_items     TransactionItem[]
  stock_movements       StockMovement[]
  purchase_order_items  PurchaseOrderItem[]
  grn_items             GRNItem[]
  substitutes           DrugSubstitute[] @relation("DrugSubstitutes")
  substitute_for        DrugSubstitute[] @relation("SubstituteFor")

  // Barcode unique per tenant — two pharmacies can register same barcode
  @@unique([tenant_id, barcode])
  @@index([tenant_id])
  @@index([tenant_id, barcode])        // critical: barcode lookup
  @@index([tenant_id, generic_name])   // substitute lookups
}

model DrugSubstitute {
  drug_id       String
  substitute_id String
  drug          Drug   @relation("DrugSubstitutes", fields: [drug_id], references: [id])
  substitute    Drug   @relation("SubstituteFor", fields: [substitute_id], references: [id])

  @@id([drug_id, substitute_id])
}

// ─────────────────────────────────────────
// INVENTORY
// ─────────────────────────────────────────

model Inventory {
  id             String   @id @default(uuid())
  tenant_id      String                          // ← tenant scope
  tenant         Tenant   @relation(fields: [tenant_id], references: [id])
  drug_id        String
  drug           Drug     @relation(fields: [drug_id], references: [id])
  branch_id      String
  branch         Branch   @relation(fields: [branch_id], references: [id])
  quantity       Int      @default(0)
  reorder_point  Int      @default(10)
  shelf_location String?
  updated_at     DateTime @updatedAt

  batches        InventoryBatch[]

  @@unique([tenant_id, drug_id, branch_id])
  @@index([tenant_id])
  @@index([tenant_id, branch_id])
  @@index([tenant_id, quantity])       // low-stock queries
}

model InventoryBatch {
  id           String    @id @default(uuid())
  tenant_id    String                          // ← tenant scope
  tenant       Tenant    @relation(fields: [tenant_id], references: [id])
  inventory_id String
  inventory    Inventory @relation(fields: [inventory_id], references: [id])
  batch_no     String
  quantity     Int
  cost_price   Decimal   @db.Decimal(10, 2)
  expiry_date  DateTime?
  received_at  DateTime  @default(now())

  @@index([tenant_id])
  @@index([tenant_id, expiry_date])    // expiry queries
}

model StockMovement {
  id              String            @id @default(uuid())
  tenant_id       String                              // ← tenant scope
  tenant          Tenant            @relation(fields: [tenant_id], references: [id])
  drug_id         String
  drug            Drug              @relation(fields: [drug_id], references: [id])
  branch_id       String
  movement_type   StockMovementType
  quantity        Int
  quantity_before Int
  quantity_after  Int
  reference_id    String?
  reference_type  String?
  notes           String?
  created_by      String
  created_by_user User              @relation(fields: [created_by], references: [id])
  created_at      DateTime          @default(now())

  @@index([tenant_id])
  @@index([tenant_id, drug_id, branch_id])
  @@index([tenant_id, created_at])
}

// ─────────────────────────────────────────
// SUPPLIERS & PURCHASING
// ─────────────────────────────────────────

model Supplier {
  id                 String          @id @default(uuid())
  tenant_id          String                          // ← tenant scope
  tenant             Tenant          @relation(fields: [tenant_id], references: [id])
  name               String
  contact_person     String?
  phone              String?
  email              String?
  address            String?
  payment_terms_days Int             @default(30)
  is_active          Boolean         @default(true)
  created_at         DateTime        @default(now())
  updated_at         DateTime        @updatedAt
  deleted_at         DateTime?

  purchase_orders    PurchaseOrder[]
  grns               GRN[]

  @@index([tenant_id])
}

model PurchaseOrder {
  id                     String              @id @default(uuid())
  tenant_id              String                          // ← tenant scope
  tenant                 Tenant              @relation(fields: [tenant_id], references: [id])
  supplier_id            String
  supplier               Supplier            @relation(fields: [supplier_id], references: [id])
  branch_id              String
  status                 PurchaseOrderStatus @default(DRAFT)
  expected_delivery_date DateTime?
  notes                  String?
  total_amount           Decimal             @db.Decimal(12, 2)
  created_by             String
  created_at             DateTime            @default(now())
  updated_at             DateTime            @updatedAt

  items                  PurchaseOrderItem[]
  grns                   GRN[]

  @@index([tenant_id])
  @@index([tenant_id, branch_id])
}

model PurchaseOrderItem {
  id                String        @id @default(uuid())
  purchase_order_id String
  purchase_order    PurchaseOrder @relation(fields: [purchase_order_id], references: [id])
  drug_id           String
  drug              Drug          @relation(fields: [drug_id], references: [id])
  quantity_ordered  Int
  agreed_cost_price Decimal       @db.Decimal(10, 2)
  quantity_received Int           @default(0)
}

model GRN {
  id                String         @id @default(uuid())
  tenant_id         String                         // ← tenant scope
  tenant            Tenant         @relation(fields: [tenant_id], references: [id])
  supplier_id       String
  supplier          Supplier       @relation(fields: [supplier_id], references: [id])
  purchase_order_id String?
  purchase_order    PurchaseOrder? @relation(fields: [purchase_order_id], references: [id])
  branch_id         String
  invoice_number    String?
  invoice_date      DateTime?
  total_cost        Decimal        @db.Decimal(12, 2)
  is_paid           Boolean        @default(false)
  payment_date      DateTime?
  created_by        String
  created_at        DateTime       @default(now())

  items             GRNItem[]

  @@index([tenant_id])
  @@index([tenant_id, branch_id])
  @@index([tenant_id, created_at])
}

model GRNItem {
  id          String   @id @default(uuid())
  grn_id      String
  grn         GRN      @relation(fields: [grn_id], references: [id])
  drug_id     String
  drug        Drug     @relation(fields: [drug_id], references: [id])
  batch_no    String?
  quantity    Int
  cost_price  Decimal  @db.Decimal(10, 2)
  expiry_date DateTime?
}

// ─────────────────────────────────────────
// POS
// ─────────────────────────────────────────

model CashierSession {
  id             String        @id @default(uuid())
  tenant_id      String                          // ← tenant scope
  tenant         Tenant        @relation(fields: [tenant_id], references: [id])
  cashier_id     String
  cashier        User          @relation(fields: [cashier_id], references: [id])
  branch_id      String
  branch         Branch        @relation(fields: [branch_id], references: [id])
  status         SessionStatus @default(OPEN)
  opening_float  Decimal       @db.Decimal(10, 2) @default(0)
  closing_float  Decimal?      @db.Decimal(10, 2)
  total_sales    Decimal       @db.Decimal(12, 2) @default(0)
  total_returns  Decimal       @db.Decimal(12, 2) @default(0)
  opened_at      DateTime      @default(now())
  closed_at      DateTime?
  notes          String?

  transactions   Transaction[]
  carts          Cart[]

  @@index([tenant_id])
  @@index([tenant_id, cashier_id, status])
  @@index([tenant_id, branch_id, opened_at])
}

model Cart {
  id              String     @id @default(uuid())
  tenant_id       String                         // ← tenant scope
  tenant          Tenant     @relation(fields: [tenant_id], references: [id])
  session_id      String
  session         CashierSession @relation(fields: [session_id], references: [id])
  status          CartStatus @default(ACTIVE)
  customer_name   String?
  discount_type   String?
  discount_value  Decimal?   @db.Decimal(10, 2)
  created_at      DateTime   @default(now())
  updated_at      DateTime   @updatedAt

  items           CartItem[]
  transaction     Transaction?

  @@index([tenant_id])
}

model CartItem {
  id               String  @id @default(uuid())
  cart_id          String
  cart             Cart    @relation(fields: [cart_id], references: [id])
  drug_id          String
  quantity         Int
  unit_price       Decimal @db.Decimal(10, 2)
  discount_percent Decimal @db.Decimal(5, 2) @default(0)

  @@index([cart_id])
}

model Transaction {
  id                      String          @id @default(uuid())
  tenant_id               String                          // ← tenant scope
  tenant                  Tenant          @relation(fields: [tenant_id], references: [id])
  receipt_number          String
  session_id              String
  session                 CashierSession  @relation(fields: [session_id], references: [id])
  cashier_id              String
  cashier                 User            @relation(fields: [cashier_id], references: [id])
  branch_id               String
  branch                  Branch          @relation(fields: [branch_id], references: [id])
  cart_id                 String?         @unique
  cart                    Cart?           @relation(fields: [cart_id], references: [id])
  type                    TransactionType @default(SALE)
  customer_name           String?
  subtotal                Decimal         @db.Decimal(12, 2)
  discount_total          Decimal         @db.Decimal(12, 2) @default(0)
  vat_total               Decimal         @db.Decimal(12, 2) @default(0)
  grand_total             Decimal         @db.Decimal(12, 2)
  notes                   String?
  original_transaction_id String?
  created_at              DateTime        @default(now())

  items    TransactionItem[]
  payments TransactionPayment[]

  // receipt_number unique per tenant
  @@unique([tenant_id, receipt_number])
  @@index([tenant_id])
  @@index([tenant_id, branch_id, created_at])
  @@index([tenant_id, session_id])
  @@index([tenant_id, created_at])
}

model TransactionItem {
  id               String      @id @default(uuid())
  transaction_id   String
  transaction      Transaction @relation(fields: [transaction_id], references: [id])
  drug_id          String
  drug             Drug        @relation(fields: [drug_id], references: [id])
  quantity         Int
  unit_price       Decimal     @db.Decimal(10, 2)
  cost_price       Decimal     @db.Decimal(10, 2)   // snapshot at sale time
  discount_percent Decimal     @db.Decimal(5, 2)    @default(0)
  discount_amount  Decimal     @db.Decimal(10, 2)   @default(0)
  vat_rate         Decimal     @db.Decimal(5, 2)
  vat_amount       Decimal     @db.Decimal(10, 2)
  line_total       Decimal     @db.Decimal(10, 2)

  @@index([transaction_id])
  @@index([drug_id])
}

model TransactionPayment {
  id             String        @id @default(uuid())
  transaction_id String
  transaction    Transaction   @relation(fields: [transaction_id], references: [id])
  method         PaymentMethod
  amount         Decimal       @db.Decimal(10, 2)

  @@index([transaction_id])
}
```

---

## Entity Relationship Summary

```
Tenant ──1── Subscription
Tenant ──< Branch ──< User
Tenant ──< Drug ──< Inventory ──< InventoryBatch
Tenant ──< CashierSession ──< Cart ──< CartItem
Tenant ──< Transaction ──< TransactionItem
                        └──< TransactionPayment
Tenant ──< Supplier ──< PurchaseOrder ──< PurchaseOrderItem
                    └──< GRN ──< GRNItem
Drug >──< DrugSubstitute (self many-to-many, within tenant)
```

---

## Key Design Decisions

### tenant_id on Every Table
Every model except `RefreshToken`, `CartItem`, `TransactionItem`, `TransactionPayment`, `PurchaseOrderItem`, and `GRNItem` carries `tenant_id` directly. Child records (items, payments) are implicitly scoped through their parent's tenant. The Prisma middleware covers all top-level models; children are unreachable without their parent.

### Username Unique Per Tenant
```prisma
@@unique([tenant_id, username])
```
Two different pharmacies can have a cashier named `ahmed.ali` — they don't conflict because the uniqueness constraint is scoped to the tenant, not globally.

### Barcode Unique Per Tenant
```prisma
@@unique([tenant_id, barcode])
```
Same reasoning — two pharmacies can register the same drug barcode independently. The barcode lookup query always includes `tenant_id`:
```sql
SELECT * FROM drugs WHERE tenant_id = ? AND barcode = ?
-- Both columns are indexed → composite index for fast lookup
```

### Receipt Number Unique Per Tenant
```prisma
@@unique([tenant_id, receipt_number])
```
Receipt numbers are generated as `{BRANCH_CODE}-{YEAR}-{SEQUENCE}` using a per-tenant DB sequence, preventing duplicates under concurrent load within the same tenant.

### Atomic Stock Decrement
```typescript
await prisma.$transaction([
  prisma.inventory.update({
    where: { tenant_id_drug_id_branch_id: { tenant_id, drug_id, branch_id } },
    data: { quantity: { decrement: qty } }
  }),
  prisma.transaction.create({ data: { tenant_id, ... } }),
  prisma.stockMovement.create({ data: { tenant_id, ... } })
]);
// DB constraint CHECK (quantity >= 0) is the final safety net
```

### Price Snapshots
`TransactionItem` stores `unit_price` and `cost_price` at the moment of sale. Historical revenue reports stay accurate even when the drug's price changes later.

### Soft Deletes
`deleted_at DateTime?` on all main entities. Prisma middleware filters `WHERE deleted_at IS NULL` on all reads. Financial records are never hard-deleted.
```

echo "Data Models done"