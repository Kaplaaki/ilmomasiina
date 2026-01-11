# Payment State Machine

This document describes the state machine for Stripe Checkout Session payments.

## States

| State | Description |
|-------|-------------|
| `CREATING` | Payment record created locally, Stripe API call in progress |
| `PENDING` | Checkout Session created in Stripe, awaiting user payment |
| `PAID` | Payment completed successfully |
| `EXPIRED` | Checkout Session expired without payment |
| `CREATION_FAILED` | Stripe API rejected the session creation |
| `REFUNDED` | Payment refunded by an admin |

## State Diagram

```mermaid
stateDiagram-v2
    [*] --> CREATING: User initiates payment

    CREATING --> PENDING: Stripe accepts session
    CREATING --> CREATION_FAILED: Stripe rejects (non-network error)
    CREATING --> CREATING: Network error (retry with idempotency key)

    PENDING --> PAID: Webhook or return URL confirmation
    PENDING --> EXPIRED: Webhook or session check reveals expiry

    PAID --> REFUNDED: Admin-initiated refund

    CREATION_FAILED --> [*]: User retries → new payment created
    EXPIRED --> [*]: User retries → new payment created
    REFUNDED --> [*]: User retries → new payment created
```

## Data Model

### Signup

| Field | Description |
|-------|-------------|
| `price` | Total price the user agreed to pay at confirmation time |
| `currency` | Currency code (e.g., `EUR`) |
| `products` | Snapshot of selected products/quantities at confirmation |
| `manualPaymentStatus` | Payment status set manually by admin (PAID, REFUNDED), or NULL |

These fields are updated when the user confirms their signup or modifies it.

### Payment

| Field | Description |
|-------|-------------|
| `status` | Current state (CREATING, PENDING, PAID, EXPIRED, CREATION_FAILED, REFUNDED) |
| `amount` | Amount charged, copied from signup at payment creation |
| `currency` | Currency code, copied from signup |
| `products` | Products snapshot, copied from signup at payment creation |
| `stripeCheckoutSessionId` | Stripe Checkout Session ID (set on transition to PENDING) |
| `expiresAt` | When the Checkout Session expires |
| `completedAt` | When payment was completed (for PAID status) |

The payment's `amount` and `products` provide an audit trail of what was actually charged, independent of any later signup modifications.

## Payment Flow

### Initial Payment Creation

1. User initiates payment
2. Backend creates a `Payment` record in `CREATING` state
3. Backend calls Stripe API to create a Checkout Session (with idempotency key)
4. On success: transition to `PENDING`, store Checkout Session ID
5. On definite failure (Stripe rejects): transition to `CREATION_FAILED`
6. On network error: leave in `CREATING` (will be retried)

### Payment Completion

Payments transition from `PENDING` to terminal states via:

- **Webhook**: Stripe sends `checkout.session.completed` or `checkout.session.expired`
- **Return URL**: User returns from Stripe, backend verifies session status

Use `UPDATE ... WHERE status = 'pending'` and check the affected row count to handle races between webhook and return URL.

### Handling Existing Payments

When a user attempts to pay and a payment record already exists:

| Current State | Action |
|---------------|--------|
| `PAID` | No action needed; update UI to reflect paid status |
| `PENDING` | Check session status in Stripe. If valid, redirect. If expired, create new payment. |
| `EXPIRED` | Create a new payment |
| `CREATION_FAILED` | Create a new payment |
| `CREATING` | Reattempt Stripe API call with same idempotency key, then transition accordingly |
| `REFUNDED` | Create a new payment |

### Refunds

Refunds are handled manually by an admin through the Stripe dashboard. The admin then updates the payment status to `REFUNDED`. There is no automated refund flow.

### Manual Payments

For events with manual payment handling (e.g., cash, invoice, bank transfer), admins can set `manualPaymentStatus` on the signup directly without creating a `Payment` record. This field uses `ManualPaymentStatus` enum: `PAID` or `REFUNDED`.

When an admin marks a signup as manually paid, any existing Checkout Session must be expired to prevent double payment. This transitions the `Payment` record to `EXPIRED`.

### Effective Payment Status

The `Signup.effectivePaymentStatus` getter determines the signup's payment status:

1. If paid via online payment OR manually → `PAID`
2. If signup has no price → `null`
3. If an active `Payment` record exists → map its status via `paymentStatusMap`
4. If `manualPaymentStatus` is set → map via `manualPaymentStatusMap`
5. Otherwise (has price but no payment) → `PENDING`

## Database Constraints

The following constraints are enforced at the database level:

- **Unique active payment**: A partial unique index on `signupId` for payments in CREATING, PENDING, or PAID states. Only one "active" payment can exist per signup. Multiple EXPIRED, CREATION_FAILED, or REFUNDED records are permitted.

- **Session ID consistency**: A CHECK constraint ensures `stripeCheckoutSessionId` is set if and only if `status IN ('pending', 'paid', 'expired', 'refunded')`. Payments in CREATING or CREATION_FAILED states must have a NULL session ID.

- **State transition validation**: A trigger enforces valid state transitions:
  - `CREATING` → `PENDING` or `CREATION_FAILED`
  - `PENDING` → `PAID` or `EXPIRED`
  - `PAID` → `REFUNDED`
  - Terminal states (`EXPIRED`, `CREATION_FAILED`, `REFUNDED`) cannot transition further

- **Immutable fields**: A trigger prevents updates to `id`, `signupId`, `amount`, `currency`, `products`, `expiresAt`, `completedAt`, and `createdAt`.

- **Session ID set once**: A trigger allows `stripeCheckoutSessionId` to be set once (NULL → value) but prevents changes.

- **No deletions**: A trigger prevents all DELETE operations on the payment table.

## Idempotency

The Stripe API idempotency key format is `ilmomasiina_${signup.id}_${payment.id}`.

- Each payment record produces a unique key
- Retrying a CREATING payment reuses the same key (safe retry semantics)
- New payment records (after EXPIRED/CREATION_FAILED/REFUNDED) get fresh keys

## Background Jobs

### Stale PENDING Polling

- Finds payments in `PENDING` state past their `expiresAt` time
- Queries Stripe for the actual session status
- Transitions to `PAID` or `EXPIRED` accordingly
- Catches webhook delivery failures

## Current Limitations

- **Modifying signups after payment**: Once a signup is paid, the user cannot edit it. This avoids complexity around partial refunds and price recalculations.
- **Automated refunds**: Not supported. Refunds must be processed manually via Stripe dashboard.

## Edge Cases

### Stuck in CREATING State

If the server crashes after creating the payment record but before completing the Stripe call, the payment remains in `CREATING`. When the user returns, we reattempt with the idempotency key. If they never return, a new payment attempt will find and handle the existing CREATING record.

### Webhook Delivery Failures

Stripe webhooks can be delayed or fail. Mitigations:
- The return URL flow provides a backup check
- The background job polls Stripe for stale PENDING payments
- Stripe retries webhooks, so transient failures self-heal

### Duplicate Webhooks

Stripe may send the same webhook multiple times. The `UPDATE ... WHERE status = 'pending'` pattern ensures only the first attempt transitions the state; subsequent attempts see zero affected rows and are no-ops.

### Session Expiry During Payment

If the user is on Stripe's payment page when the session expires, Stripe handles this gracefully. On return, we check status and create a new session if needed.

### Network Error vs. Rejection

The Stripe Node.js SDK throws typed exceptions:
- `StripeInvalidRequestError` → definite rejection → `CREATION_FAILED`
- `StripeAPIError` → Stripe-side issue, unknown state → stay `CREATING`
- `StripeConnectionError` → network failure, unknown state → stay `CREATING`

When uncertain, stay `CREATING` and rely on idempotency retry.

### Signup Deletion with Active Payment

The foreign key constraint (ON DELETE RESTRICT) prevents deleting a signup that has any payment records. To delete such a signup, the admin must first handle the payment situation (e.g., refund if paid, or wait for expiry if pending).

### Zero Price Signups

If a signup's total price is zero (e.g., free event or 100% discount), no payment should be created. This is handled at the application layer before initiating the payment flow.

### Concurrent Admin Actions

If two admins try to refund the same payment simultaneously, the `UPDATE ... WHERE status = 'paid'` pattern ensures only one succeeds. The other sees zero affected rows and should report the payment was already refunded.
