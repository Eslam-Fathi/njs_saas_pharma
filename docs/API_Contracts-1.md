# API_Contracts.md — Pharmacy Management System (SaaS)

**Base URL:** `https://api.yourdomain.com/v1`  
**Auth:** Bearer JWT in `Authorization` header (all routes unless marked `[PUBLIC]`)  
**Tenant Scope:** `tenant_id` is NEVER passed in request body or query params — always extracted from JWT by the server  
**Content-Type:** `application/json`  
**Pagination:** All list responses: `{ data: [], meta: { total, page, limit, totalPages } }`

---

## Tenants Module `/tenants`

### POST `/tenants/register` [PUBLIC]
Register a new pharmacy business (creates tenant + owner account + trial subscription).

**Request:**
```json
{
  "business_name": "Al Shifa Pharmacy",
  "owner_name": "Ahmed Ali",
  "username": "ahmed.ali",
  "password": "string",
  "phone": "string",
  "email": "string"
}
```
**Response 201:**
```json
{
  "tenant_id": "uuid",
  "business_name": "Al Shifa Pharmacy",
  "access_token": "string",
  "refresh_token": "string",
  "trial_ends_at": "ISO8601",
  "user": {
    "id": "uuid",
    "name": "string",
    "role": "TENANT_OWNER"
  }
}
```
**Errors:** `409` username already exists

---

### GET `/tenants/me`
Get current tenant details and subscription status.
**Roles:** `tenant_owner`, `admin`

**Response 200:**
```json
{
  "id": "uuid",
  "business_name": "string",
  "is_active": true,
  "subscription": {
    "plan": "starter | pro | enterprise",
    "status": "trial | active | suspended | cancelled",
    "trial_ends_at": "ISO8601",
    "current_period_end": "ISO8601",
    "limits": {
      "max_branches": 1,
      "max_users": 5,
      "max_drugs": 500,
      "current_branches": 1,
      "current_users": 3,
      "current_drugs": 120
    }
  }
}
```

---

### PATCH `/tenants/me`
Update tenant business details.
**Roles:** `tenant_owner`

---

### POST `/tenants/me/upgrade`
Upgrade subscription plan.
**Roles:** `tenant_owner`

**Request:**
```json
{ "plan": "pro | enterprise" }
```

---

## Auth Module `/auth`

### POST `/auth/login` [PUBLIC]

**Request:**
```json
{
  "username": "string",
  "password": "string"
}
```
**Response 200:**
```json
{
  "access_token": "string",
  "refresh_token": "string",
  "user": {
    "id": "uuid",
    "name": "string",
    "role": "string",
    "branch_id": "uuid",
    "tenant_id": "uuid"
  }
}
```
**Errors:** `401` invalid credentials | `403` tenant suspended | `429` rate limit

---

### POST `/auth/refresh`
**Request:** `{ "refresh_token": "string" }`  
**Response 200:** Same shape as login.

---

### POST `/auth/logout`
**Response:** `204 No Content`

---

## Users Module `/users`
**Roles:** `tenant_owner`, `admin`
> All queries automatically scoped to requesting tenant.

### GET `/users`
Query: `?page=1&limit=20&branch_id=uuid&role=cashier`

**Response 200:**
```json
{
  "data": [{
    "id": "uuid",
    "name": "string",
    "username": "string",
    "role": "string",
    "branch_id": "uuid",
    "is_active": true,
    "created_at": "ISO8601"
  }],
  "meta": { "total": 0, "page": 1, "limit": 20, "totalPages": 1 }
}
```

### POST `/users`
**Errors:** `403` if plan user limit reached

**Request:**
```json
{
  "name": "string",
  "username": "string",
  "password": "string",
  "role": "admin | pharmacist | cashier | viewer",
  "branch_id": "uuid"
}
```

### PATCH `/users/:id`
### DELETE `/users/:id` → `204 No Content`

---

## Branches Module `/branches`
**Roles:** `tenant_owner`, `admin`
> Scoped to tenant automatically.

### GET `/branches`
**Response 200:** Paginated list of tenant's branches.

### POST `/branches`
**Errors:** `403` if plan branch limit reached

**Request:**
```json
{
  "name": "string",
  "address": "string",
  "phone": "string",
  "vat_number": "string",
  "vat_rate": 15.0,
  "timezone": "Asia/Riyadh"
}
```

### PATCH `/branches/:id`

---

## Drugs Module `/drugs`
> All drug data is scoped to tenant. Two tenants can register the same barcode independently.

**GET routes:** all roles | **POST/PATCH/DELETE:** `pharmacist`, `admin`, `tenant_owner`

### GET `/drugs/barcode/:barcode`
⚡ Critical path — < 200ms. Scoped to tenant from JWT.

**Response 200:**
```json
{
  "id": "uuid",
  "name_en": "Paracetamol 500mg",
  "name_ar": "باراسيتامول",
  "barcode": "6281234567890",
  "generic_name": "Paracetamol",
  "category": "Analgesic",
  "manufacturer": "string",
  "unit": "tablet",
  "sell_price": 12.50,
  "vat_included": true,
  "requires_prescription": false,
  "stock": {
    "quantity": 150,
    "reorder_point": 20,
    "location": "Shelf A3"
  },
  "expiry_batches": [
    { "batch_no": "B001", "expiry_date": "2027-06-01", "quantity": 100 }
  ]
}
```
**Response 404:**
```json
{
  "message": "Drug not found",
  "substitutes": [
    { "id": "uuid", "name_en": "string", "sell_price": 0, "stock_quantity": 0 }
  ]
}
```

---

### GET `/drugs`
Query: `?search=para&category=analgesic&requires_prescription=false&page=1&limit=20`

### POST `/drugs`
**Errors:** `403` if plan drug limit reached | `409` barcode already exists within this tenant

**Request:**
```json
{
  "name_en": "string",
  "name_ar": "string",
  "barcode": "string",
  "generic_name": "string",
  "category_id": "uuid",
  "manufacturer_id": "uuid",
  "unit": "tablet",
  "cost_price": 8.00,
  "sell_price": 12.50,
  "vat_included": true,
  "requires_prescription": false,
  "reorder_point": 20,
  "description": "string"
}
```

### PATCH `/drugs/:id`
### DELETE `/drugs/:id` → `204 No Content`

---

## Inventory Module `/inventory`
**Roles:** `pharmacist`, `admin`, `tenant_owner`

### GET `/inventory`
Query: `?branch_id=uuid&low_stock=true&expiring_in_days=90`

**Response 200:**
```json
{
  "data": [{
    "drug_id": "uuid",
    "drug_name_en": "string",
    "drug_name_ar": "string",
    "barcode": "string",
    "quantity": 150,
    "reorder_point": 20,
    "is_low_stock": false,
    "batches": [
      { "batch_no": "B001", "expiry_date": "2027-06-01", "quantity": 100 }
    ]
  }],
  "meta": { ... }
}
```

### POST `/inventory/receive`
Receive stock (GRN).

**Request:**
```json
{
  "supplier_id": "uuid",
  "purchase_order_id": "uuid",
  "invoice_number": "string",
  "invoice_date": "2026-05-20",
  "items": [
    {
      "drug_id": "uuid",
      "batch_no": "B001",
      "quantity": 200,
      "cost_price": 8.00,
      "expiry_date": "2027-06-01"
    }
  ]
}
```

### POST `/inventory/adjust`
**Request:**
```json
{
  "drug_id": "uuid",
  "branch_id": "uuid",
  "adjustment_type": "increase | decrease | correction",
  "quantity": 10,
  "reason": "string",
  "batch_no": "string"
}
```

### GET `/inventory/movements/:drug_id`
Query: `?from=2026-01-01&to=2026-05-20`

---

## POS Module `/pos`
**Roles:** `cashier`, `pharmacist`, `admin`

### POST `/pos/sessions/open`
**Request:** `{ "opening_float": 500.00 }`

**Response 201:**
```json
{
  "session_id": "uuid",
  "cashier_id": "uuid",
  "cashier_name": "string",
  "branch_id": "uuid",
  "opened_at": "ISO8601",
  "opening_float": 500.00
}
```

### POST `/pos/sessions/:sessionId/close`
**Request:**
```json
{ "closing_float": 480.00, "notes": "string" }
```
**Response 200:**
```json
{
  "session_id": "uuid",
  "opened_at": "ISO8601",
  "closed_at": "ISO8601",
  "opening_float": 500.00,
  "closing_float": 480.00,
  "total_sales": 3250.00,
  "total_returns": 75.00,
  "transaction_count": 42,
  "cash_expected": 480.00,
  "cash_variance": 0.00
}
```

### GET `/pos/sessions/current`

### POST `/pos/cart`
**Response 201:**
```json
{
  "cart_id": "uuid",
  "session_id": "uuid",
  "items": [],
  "subtotal": 0,
  "discount_amount": 0,
  "vat_amount": 0,
  "total": 0
}
```

### POST `/pos/cart/:cartId/items`
**Request:**
```json
{
  "drug_id": "uuid",
  "quantity": 2,
  "discount_percent": 0
}
```
**Response 200:** Updated cart.  
**Errors:** `422` insufficient stock | `403` prescription required

### PATCH `/pos/cart/:cartId/items/:itemId`
### DELETE `/pos/cart/:cartId/items/:itemId`

### POST `/pos/checkout`
**Request:**
```json
{
  "cart_id": "uuid",
  "payment_method": "cash | card | insurance | mixed",
  "payments": [
    { "method": "cash", "amount": 100.00 },
    { "method": "card", "amount": 50.00 }
  ],
  "customer_name": "string",
  "notes": "string"
}
```
**Response 201:**
```json
{
  "receipt_id": "uuid",
  "receipt_number": "SHA01-2026-00042",
  "items": [
    {
      "drug_id": "uuid",
      "name_en": "string",
      "quantity": 2,
      "unit_price": 12.50,
      "discount_amount": 0,
      "vat_amount": 1.63,
      "line_total": 26.63
    }
  ],
  "subtotal": 25.00,
  "discount_total": 0,
  "vat_total": 3.26,
  "grand_total": 28.26,
  "payments": [],
  "change_due": 0,
  "cashier_name": "string",
  "branch_name": "string",
  "issued_at": "ISO8601"
}
```

### POST `/pos/returns`
**Request:**
```json
{
  "original_receipt_id": "uuid",
  "items": [
    { "receipt_item_id": "uuid", "quantity": 1, "reason": "Damaged" }
  ],
  "refund_method": "cash | card | store_credit"
}
```

---

## Suppliers Module `/suppliers`
**Roles:** `pharmacist`, `admin`, `tenant_owner`

### GET `/suppliers`
### POST `/suppliers`
```json
{
  "name": "string",
  "contact_person": "string",
  "phone": "string",
  "email": "string",
  "address": "string",
  "payment_terms_days": 30
}
```
### PATCH `/suppliers/:id`
### GET `/suppliers/:id/purchase-orders`
### POST `/suppliers/purchase-orders`
```json
{
  "supplier_id": "uuid",
  "expected_delivery_date": "2026-06-01",
  "items": [
    { "drug_id": "uuid", "quantity": 200, "agreed_cost_price": 8.00 }
  ]
}
```

---

## Analytics Module `/analytics`
**Roles:** `admin`, `tenant_owner`, `viewer`
> All data scoped to tenant. Cross-tenant analytics impossible.

### GET `/analytics/revenue`
Query: `?from=2026-01-01&to=2026-05-20&branch_id=uuid&group_by=day|week|month`

**Response 200:**
```json
{
  "total_revenue": 125000.00,
  "total_cost": 80000.00,
  "gross_profit": 45000.00,
  "gross_margin_percent": 36.0,
  "vat_collected": 16304.35,
  "transaction_count": 1250,
  "chart_data": [
    { "period": "2026-01-01", "revenue": 4500.00, "cost": 2900.00, "profit": 1600.00 }
  ]
}
```

### GET `/analytics/drugs/top-selling`
Query: `?from=&to=&limit=10&sort_by=revenue|quantity`

### GET `/analytics/inventory/expiry`
Query: `?days=90&branch_id=uuid`

### GET `/analytics/inventory/low-stock`
Query: `?branch_id=uuid`

### GET `/analytics/cashier/performance`
Query: `?from=&to=&cashier_id=uuid`

### GET `/analytics/dashboard`
Cached 5 min per tenant+branch.

**Response 200:**
```json
{
  "today": {
    "revenue": 4500.00,
    "transactions": 42,
    "returns": 2
  },
  "alerts": {
    "low_stock_count": 5,
    "expiring_soon_count": 12,
    "open_sessions": 1
  },
  "stock_value": {
    "at_cost": 85000.00,
    "at_sell": 135000.00
  },
  "subscription": {
    "plan": "starter",
    "status": "active",
    "days_until_renewal": 14
  }
}
```

---

## Reports Module `/reports`
**Roles:** `admin`, `tenant_owner`, `viewer`

### GET `/reports/sales`
Query: `?from=&to=&format=csv|pdf&branch_id=uuid`

### GET `/reports/inventory`
### GET `/reports/vat`
### GET `/reports/purchases`

---

## Common Response Shapes

### Error Response
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": ["barcode must not be empty"],
  "timestamp": "ISO8601",
  "path": "/v1/drugs"
}
```

### Plan Limit Error
```json
{
  "statusCode": 403,
  "message": "Your Starter plan allows 1 branch. Upgrade to Pro to add more.",
  "upgrade_url": "/tenants/me/upgrade"
}
```

### Paginated Response
```json
{
  "data": [],
  "meta": { "total": 100, "page": 1, "limit": 20, "totalPages": 5 }
}
```

---

## HTTP Status Codes

| Code | Meaning |
|---|---|
| 200 | OK |
| 201 | Created |
| 204 | No Content |
| 400 | Validation Error |
| 401 | Invalid / expired token |
| 403 | Forbidden (role or plan limit) |
| 404 | Not Found |
| 409 | Conflict (e.g. duplicate barcode within tenant) |
| 422 | Business logic failure (e.g. insufficient stock) |
| 429 | Rate limit exceeded |
| 500 | Internal Server Error |
