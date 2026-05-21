# PRD.md — Pharmacy Management System (SaaS)
**Version:** 2.0 | **Status:** Draft | **Last Updated:** 2026-05-20

---

## 1. Project Overview

A multi-tenant SaaS pharmacy management backend serving a Flutter (Android + Web) frontend. Multiple independent pharmacy businesses (tenants) share one database with complete data isolation enforced via `tenant_id`. Each tenant manages their own drugs, inventory, staff, branches, POS operations, and financial analytics.

---

## 2. User Types

| Role | Scope | Description | Key Permissions |
|---|---|---|---|
| `super_admin` | Platform | SaaS platform owner | Manage all tenants, platform config |
| `tenant_owner` | Tenant | Pharmacy business owner | Full access within their tenant |
| `admin` | Tenant | Branch manager | Branch-level full access |
| `pharmacist` | Tenant | Licensed pharmacist | Drugs, prescriptions, inventory |
| `cashier` | Tenant | Point-of-sale operator | POS, sales, receipts |
| `viewer` | Tenant | Analyst / auditor | Read-only, reports |

---

## 3. Core Features

### 3.1 Tenant & Subscription Management
- Self-serve tenant registration (pharmacy business signs up)
- Plan tiers: Starter, Pro, Enterprise
- Plan limits enforced at API level (branches, users, drugs)
- Subscription status tracking (active, trial, suspended, cancelled)
- Billing integration hooks (Stripe-ready)
- Tenant onboarding flow (setup wizard via API)
- Tenant suspension (non-payment) — read-only mode, no new transactions

### 3.2 Drug Inventory Management
- Register drugs per tenant: name (Arabic + English), barcode, generic name, category, manufacturer, unit, price (cost + sell), VAT flag, requires-prescription flag
- Barcode is unique **per tenant** (two tenants can register the same barcode independently)
- Track stock quantities per branch, with low-stock alerts
- Manage expiry dates with automated expiry warnings (default 90 days)
- Support drug substitutes (same generic name, different brand)
- Bulk import via CSV
- Full audit trail for stock changes

### 3.3 Barcode & Search
- Lookup drug by barcode scoped to tenant (< 200ms)
- Search by name (Arabic/English), generic name, category, manufacturer
- Fuzzy search for near-match names
- Return substitute suggestions if not found or out of stock

### 3.4 Point of Sale (Cashier)
- Open/close cashier sessions
- Build carts: add by barcode scan or search, set quantity, apply discount
- Apply order-level discounts (percentage or fixed)
- Support multiple payment methods: cash, card, insurance, mixed
- Issue receipts (number, line items, VAT breakdown, cashier, branch, timestamp)
- Process returns: partial or full, linked to original receipt
- Prescription-required flag triggers pharmacist approval
- Hold/resume carts

### 3.5 Supplier & Purchasing
- Manage suppliers per tenant
- Create purchase orders
- Receive stock (GRN): validates quantities, updates inventory, records cost
- Track purchase invoices and payment status

### 3.6 Financial Analytics
- Daily / weekly / monthly / custom-range revenue reports
- Expenditure tracking (purchases, operational costs)
- Profit & loss per period
- Top-selling drugs (by revenue and quantity)
- Stock value at cost and sell price
- VAT report (collected vs paid)
- Cashier performance per session and per period
- Branch comparison (multi-branch tenants)

### 3.7 Inventory Analytics
- Current stock levels with reorder point alerts
- Expiry timeline (30 / 60 / 90 days)
- Stock movement history
- Dead stock (no movement in X days)

### 3.8 Staff & Branch Management
- Create/manage staff accounts with roles (scoped to tenant)
- Assign staff to branches within the same tenant
- View activity logs per staff member
- Multi-branch under one tenant account

### 3.9 Notifications
- Low stock alert
- Expiry alert
- Session not closed (end of day)
- Subscription expiry warning (7 days, 3 days, 1 day before)

---

## 4. Plan Limits

| Limit | Starter | Pro | Enterprise |
|---|---|---|---|
| Branches | 1 | 5 | Unlimited |
| Users | 5 | 25 | Unlimited |
| Drugs | 500 | 5000 | Unlimited |
| Data retention | 1 year | 3 years | Unlimited |
| API rate limit | 60 req/min | 300 req/min | Custom |
| Report export | CSV only | CSV + PDF | CSV + PDF |

---

## 5. Acceptance Criteria

### Tenant Isolation
- A request with `tenant_id = A` can never return, modify, or delete data belonging to `tenant_id = B`
- Prisma middleware injects `tenant_id` filter on every read/write — no service bypasses it
- Verified by E2E test: two tenants, same barcode registered by both, each only sees their own

### Drug Lookup
- `GET /drugs/barcode/:code` responds in < 200ms
- Scoped to requesting tenant automatically
- Returns 404 with substitute suggestions (within same tenant) if not found

### POS / Cashier
- Cart to receipt completes in < 2 seconds
- Stock decrements atomically (no race conditions)
- Receipt is immutable once issued

### Plan Enforcement
- Creating a branch beyond plan limit returns `403` with clear message
- Enforced at service layer, not just frontend
- Checked on every relevant `POST` operation

### Security
- All endpoints require valid JWT except `POST /auth/login` and `POST /tenants/register`
- JWT payload carries `tenant_id` — never trusted from request body
- Role-based guards at controller level
- Rate limiting on `/auth/login`: 10 attempts/min per IP
- Prisma middleware makes tenant cross-contamination structurally impossible
- No secrets in code

### Data Integrity
- All financial records include full audit fields
- Soft deletes only on financial records and drugs
- `CHECK (quantity >= 0)` constraint on inventory table

---

## 6. Non-Functional Requirements

| Concern | Requirement |
|---|---|
| Language | Arabic + English (bilingual drug names) |
| Timezone | Stored as UTC, displayed in local per branch |
| VAT | 15% default, configurable per tenant |
| Pagination | All list endpoints paginated (default 20, max 100) |
| Logging | All errors, auth events, stock mutations, tenant events |
| Backup | Daily automated DB backup |
| Uptime | 99.5% target |

---

## 7. Out of Scope (v1.0)
- Online pharmacy storefront
- Prescription image upload / OCR
- Insurance provider integration
- Loyalty/points system
- Multi-currency support
- Per-tenant custom domains
