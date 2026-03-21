# Workspace Billing and Mayar Design

## Summary

Add a workspace billing domain that keeps `workspaces.plan` as the single authoritative plan field while introducing a dedicated subscription and invoice lifecycle for paid workspace access.

The approved v1 billing model is:

- `free` is the default workspace plan.
- `pro` is a one-time Mayar payment that grants 30 rolling days of access.
- `enterprise` is a manual internal activation flow and is not self-serve.
- Only the workspace `superadmin` can create or refresh a payment.
- Billing entry points are dashboard-only.
- Mayar integration uses invoice creation plus polling and cron reconciliation, not webhooks.

The approved downgrade behavior is intentionally non-destructive:

- when a paid `pro` period expires, `workspaces.plan` drops to `free`
- member and device records are preserved
- attendance operations continue working for existing members and devices
- `superadmin` and `admin` are blocked from normal dashboard usage if the workspace is over free-plan member or device limits after expiry
- recovery happens through a mandatory overlay that forces the workspace back into free-plan compliance or sends the `superadmin` into a new payment flow

## Goals

- Keep plan gating simple by preserving `workspaces.plan` as the only plan field.
- Add a clean billing lifecycle model without duplicating plan state across tables.
- Support real invoice history and transparent payment status for the workspace `superadmin`.
- Ensure one workspace cannot create multiple simultaneous pending Mayar checkouts.
- Keep the app operational when a paid plan expires, while forcing admin-side compliance.
- Make the integration safe without webhooks by using idempotent polling and reconciliation.

## Non-Goals

- Build a public pricing page in v1.
- Build recurring or automatic monthly renewal in v1.
- Allow non-`superadmin` roles to pay for a workspace.
- Route `enterprise` through Mayar checkout.
- Delete members, devices, or premium configuration on downgrade.
- Make `workspace_subscriptions` the source of truth for plan names.

## Current State

The repository already has centralized workspace plan gating in `convex/plans.js` and server-side enforcement across workspace creation, members, devices, settings, reports, and dashboard summary queries.

Current relevant files include:

- `convex/plans.js`
- `convex/workspaces.js`
- `convex/settings.js`
- `convex/reports.js`
- `convex/schema.js`
- `app/api/workspaces/current/route.ts`
- `app/api/admin/workspace/route.ts`

Important current product decision confirmed during brainstorming:

- `free.features.attendanceSchedule === true` in `convex/plans.js` is intentional and should remain that way.

The codebase currently has plan gating but no billing domain, no provider customer mapping, no invoice ledger, no payment polling, and no subscription lifecycle storage.

## Research Notes

Mayar documentation and exploration support the approved v1 architecture:

- customer creation is available through the customer API
- invoice creation and invoice status lookup are available through the invoice API
- paid and unpaid flows can be inferred through provider invoice status polling
- webhooks exist in the platform, but they are intentionally not used in this design

Relevant documentation reviewed during exploration:

- `https://docs.mayar.id/llms.txt`
- `https://docs.mayar.id/api-reference/customer/create`
- `https://docs.mayar.id/api-reference/invoice/detail`
- `https://docs.mayar.id/api-reference/licensecode/verifylicense`

Convex research confirmed that actions, scheduled jobs, and internal mutations are the right primitives for provider calls, polling, and idempotent background reconciliation.

## Approved Product Rules

### Plans

- `free` is the default plan for all workspaces.
- `pro` is purchased by one-time payment and grants 30 rolling days of access.
- `enterprise` is activated manually through internal admin flow.

### Billing Surface

- v1 is dashboard-only.
- There is no public `/pricing` page in v1.
- Checkout entry points live inside workspace dashboard billing and recovery flows.

### Role Rules

- only `superadmin` may create a checkout, continue a pending payment, or refresh payment status
- `admin` may not pay
- `karyawan` and `device-qr` may not access billing
- payment history is visible to `superadmin` only

### One Pending Checkout Rule

- one workspace may not have multiple simultaneous pending Mayar checkouts
- if a valid pending invoice already exists, the system must return that invoice instead of creating a new one
- the `superadmin` must be redirected to continue the pending payment until it becomes `paid`, `failed`, `canceled`, or `expired`

## Source of Truth

`workspaces.plan` remains the only authoritative plan field.

This is the most important modeling decision in the design.

Rules:

- `workspaces.plan` is the field used by runtime plan gating
- `workspace_subscriptions` does not contain a `plan` column
- plan changes must happen through application mutations and internal billing flows, not through ad hoc manual table edits

This keeps plan filtering operationally simple while preserving a focused billing lifecycle model in separate tables.

## Data Model

### `workspaces`

Existing table retained as the authoritative plan source.

Required field behavior:

- `plan = free | pro | enterprise`
- all server-side entitlement checks continue to derive from this field

No billing lifecycle duplication should be added here beyond the plan field itself.

### `workspace_subscriptions`

Purpose:

- store workspace-level paid or manual entitlement periods
- represent lifecycle state for paid access
- provide a clean boundary between plan gating and billing history

Approved fields:

- `workspaceId`
- `status = pending | active | expired | canceled`
- `provider = mayar | manual`
- `kind = pro_one_time | enterprise_manual`
- `startedAt`
- `activatedAt`
- `currentPeriodStartsAt`
- `currentPeriodEndsAt`
- `expiredAt`
- `canceledAt`
- `createdByUserId`
- `updatedAt`

Rules:

- no `plan` column exists here
- `pro_one_time` rows model Mayar-paid access periods
- `enterprise_manual` rows model internal enterprise lifecycle
- only one active subscription row may exist for a workspace at a time
- pending rows are allowed for payment initialization, but they must be kept consistent with invoice state

Timestamp semantics:

- `startedAt` = when the local subscription lifecycle row was first created
- `activatedAt` = when the row first transitioned to `active`
- `currentPeriodStartsAt` = when the currently active entitlement period begins
- `currentPeriodEndsAt` = when the currently active entitlement period ends

For `pro_one_time`, `activatedAt` and `currentPeriodStartsAt` will usually be the same timestamp.

For `enterprise_manual`, `activatedAt` may match `currentPeriodStartsAt`, but the model stays flexible enough for future scheduled manual activation if needed.

### `workspace_billing_customers`

Purpose:

- map a workspace to a reusable Mayar customer record

Approved fields:

- `workspaceId`
- `provider = mayar`
- `providerCustomerId`
- `name`
- `email`
- `phone`
- `createdAt`
- `updatedAt`

### `workspace_billing_invoices`

Purpose:

- store every payment attempt shown to the user as transparent payment history
- anchor payment status to real provider data
- provide the audit trail for checkout, payment success, failure, expiry, and re-purchase flows

Approved fields:

- `workspaceId`
- `subscriptionId`
- `provider = mayar`
- `providerInvoiceId`
- `providerTransactionId`
- `status = pending_initializing | pending | paid | expired | canceled | failed`
- `amount`
- `currency = IDR`
- `paymentUrl`
- `issuedAt`
- `expiresAt`
- `paidAt`
- `coveredPeriodStartsAt`
- `coveredPeriodEndsAt`
- `lastPolledAt`
- `pollAttempts`
- `providerStatusText`
- `rawProviderSnapshot`

Rules:

- one checkout attempt creates one invoice row
- invoice rows are append-first and never deleted as part of normal flows
- pending, failed, canceled, expired, and paid attempts all remain visible in history
- invoice status shown to the user must be based on provider-confirmed data once a provider invoice has been created successfully
- local terminal failure states are allowed before provider invoice creation succeeds, for example when checkout initialization fails and no provider invoice was created

### `workspace_subscription_events`

Purpose:

- maintain internal audit and debugging context for important billing transitions

Approved event examples:

- `checkout_started`
- `invoice_created`
- `invoice_paid`
- `invoice_expired`
- `subscription_activated`
- `subscription_expired`
- `plan_changed`
- `enterprise_activated`

This table is not the source of truth for plan or payment state.

Approved fields:

- `workspaceId`
- `subscriptionId`
- `invoiceId`
- `eventType`
- `eventKey`
- `actorUserId`
- `payload`
- `createdAt`

Recommended indexes:

- by workspace and creation time
- by subscription and creation time
- by invoice and creation time
- by `eventKey` for idempotent event emission where needed

## State Model

### Workspace Plan States

- `free`
- `pro`
- `enterprise`

### Subscription States

- `pending`
- `active`
- `expired`
- `canceled`

### Invoice States

- `pending_initializing`
- `pending`
- `paid`
- `expired`
- `canceled`
- `failed`

### Invariants

- `workspaces.plan = free` means the workspace currently has no active paid or manual entitlement
- `workspaces.plan = pro` means the workspace has an active `workspace_subscriptions` row with `provider = mayar` and `kind = pro_one_time`
- `workspaces.plan = enterprise` means the workspace has an active `workspace_subscriptions` row with `provider = manual` and `kind = enterprise_manual`
- a paid invoice may activate a subscription period only once
- a subscription period may expire only once

## End-to-End Billing Flow

### `free -> pro`

1. `superadmin` opens billing from the dashboard.
2. `superadmin` requests checkout.
3. Backend checks for an existing valid pending invoice and for any active paid or manual entitlement.
4. If a valid pending invoice exists, it is returned and reused.
5. If no valid pending invoice exists:
    - create or reuse the Mayar customer mapping
    - create a `workspace_subscriptions` row with `status = pending` and `kind = pro_one_time`
    - create a local invoice row with `status = pending_initializing`
   - call Mayar to create the invoice
   - update the local invoice to `pending` with provider identifiers and `paymentUrl`
6. Frontend redirects the `superadmin` to `paymentUrl`.

Checkout initialization failure rules:

- `pending_initializing` counts as an open checkout and blocks creation of any new checkout for the same workspace
- if provider invoice creation fails definitively, mark the local invoice `failed` and mark the pending subscription `canceled`
- if provider communication is ambiguous, the provider adapter must retry or reconcile before allowing a replacement checkout so the system does not accidentally create duplicates
- a new checkout may only be created after the prior open checkout is no longer `pending_initializing` or `pending`
- a new self-serve `pro` checkout may not be created while any active entitlement already exists, including an active `pro` entitlement or an active `enterprise` entitlement

### Return From Mayar

1. User returns to the dashboard billing page.
2. The billing page requests a refresh of the pending invoice status.
3. Backend queries Mayar for invoice status.
4. If paid:
   - mark invoice `paid`
   - set `paidAt`
   - set `coveredPeriodStartsAt`
   - set `coveredPeriodEndsAt = paidAt + 30 rolling days`
   - mark subscription `active`
   - set subscription period fields
   - set `workspaces.plan = pro`
5. If still pending, display the pending invoice and allow the user to continue payment.
6. If expired, canceled, or failed, update the invoice and cancel or expire the pending subscription accordingly.

### Pro Expiry

1. Background reconciliation checks active subscription periods.
2. When `currentPeriodEndsAt` is in the past:
   - mark the subscription `expired`
   - set `expiredAt`
   - set `workspaces.plan = free`
3. If the workspace is over free-plan member or device limits after downgrade, restricted expired mode becomes active.

### Re-purchase After Expiry

- the workspace may purchase a new `pro` period through a new Mayar invoice
- old invoices remain in history
- the new period creates a new subscription row and a new invoice row
- invoices are never reused across entitlement periods

### Early Re-purchase Rule

V1 does not support stacking or extending active `pro` periods ahead of time.

Rules:

- a workspace with an already active `pro` period may not create a new `pro` checkout
- a new one-time payment is allowed only when the workspace no longer has an active paid `pro` entitlement
- this keeps period math, invoice history, and expiry behavior unambiguous in v1

### Enterprise Activation

- `enterprise` never uses Mayar in v1
- an internal admin flow creates an `enterprise_manual` subscription row
- that flow sets `workspaces.plan = enterprise`
- manual enterprise changes must still emit subscription events and update lifecycle timestamps consistently

### Enterprise Deactivation

- enterprise lifecycle is managed only through internal admin flow in v1
- internal admin flow may cancel an enterprise entitlement immediately or set an end date if business process needs one
- immediate deactivation marks the active enterprise row `canceled`, sets `canceledAt`, and sets `workspaces.plan = free`
- if an enterprise entitlement uses `currentPeriodEndsAt`, the same expiry job may mark it `expired` and set `workspaces.plan = free` when that period ends
- if a workspace downgraded from enterprise to `free` is above free-plan member or device limits, the same restricted expired mode rules apply

## Restricted Expired Mode

### Trigger

Restricted expired mode is a derived operational state, not a new plan.

It becomes active when all of the following are true:

- the workspace was previously operating under a paid or manual entitlement
- that entitlement ended or was removed and `workspaces.plan` has been downgraded to `free`
- the workspace has more than 5 active members or more than 1 active device

### Behavior

- `karyawan` may continue attendance flows
- existing devices may continue attendance device flows
- premium configuration remains stored and is not deleted
- premium runtime behavior that depends on premium plan access remains locked by normal plan gating

### Admin Experience

`superadmin` and `admin` see a mandatory blocking gate or overlay when opening dashboard surfaces.

The overlay must:

- explain that the workspace no longer has an active paid entitlement
- explain that attendance operations still work, but dashboard access is blocked until the workspace complies with free-plan limits or purchases paid access again
- include a table of active members
- include a table of active devices
- show compliance targets of `members <= 5` and `devices <= 1`

Role differences:

- `superadmin` may remove or deactivate members from the overlay and may remove or deactivate devices from the overlay
- `admin` sees the same overlay as read-only and may not perform removal actions

The overlay disappears only after both conditions are met:

- active members are `<= 5`
- active devices are `<= 1`

## Access Control

### Billing Access

- `superadmin` only:
  - view payment history
  - create checkout
  - continue pending payment
  - refresh invoice status
- `admin`:
  - no checkout
  - no payment history
  - read-only restricted overlay if applicable
- `karyawan` and `device-qr`:
  - no billing access

### Restricted Recovery Access

While restricted expired mode is active, server-side allow only the actions needed for recovery:

- `superadmin` may:
  - view billing summary
  - create or continue payment
  - refresh payment status
  - list members and devices for the overlay
  - remove or deactivate members
  - remove or deactivate devices
  - logout
- `admin` may:
  - view restriction context needed for the read-only overlay
  - list members and devices for the overlay
  - logout

All other dashboard management mutations for `superadmin` and `admin` should be blocked until the workspace is compliant again or the plan is upgraded again.

## Module Boundaries

### Convex Domain Modules

Recommended domain split:

- `convex/workspaceBilling.js`
  - public queries and actions for workspace billing summary, checkout creation, invoice history, and restricted state, plus internal mutations for lifecycle writes
- `convex/workspaceBillingMayar.js`
  - provider adapter and provider-specific actions for customer creation, invoice creation, and invoice status fetch
- `convex/crons.js`
  - reconciliation and expiry jobs

### Recommended Convex Functions

`workspaceBilling.js`:

- query `getWorkspaceBillingSummary`
- query `listWorkspaceBillingInvoices`
- query `getWorkspaceRestrictedExpiredState`
- action `createWorkspaceCheckout`
- action `refreshWorkspacePendingInvoice`
- internal mutation `markInvoiceFromProvider`
- internal mutation `activatePaidWorkspacePeriod`
- internal mutation `expireWorkspacePeriod`
- internal mutation `syncWorkspacePlanFromLifecycle`

`workspaceBillingMayar.js`:

- internal action `createMayarCustomerIfNeeded`
- internal action `createMayarInvoice`
- internal action `fetchMayarInvoiceStatus`

This keeps provider details isolated from workspace billing domain logic.

Because Mayar calls are external I/O, checkout creation and invoice refresh orchestration must happen in actions, with all durable state transitions written through internal mutations.

## Next.js API Surface

Recommended dashboard-facing wrappers:

- `GET /api/workspaces/current/billing`
  - `superadmin` only
  - returns current plan, current entitlement period, pending invoice summary, restricted state, and allowed actions
- `GET /api/workspaces/current/billing/invoices`
  - returns payment history for `superadmin` only
- `POST /api/workspaces/current/billing/checkout`
  - creates a new checkout or reuses an existing pending checkout for `superadmin`
- `POST /api/workspaces/current/billing/refresh`
  - refreshes the current pending invoice status for `superadmin`
- `GET /api/workspaces/current/restrictions`
  - `superadmin` and `admin` only
  - returns member and device data needed for the mandatory restricted overlay
  - when the workspace is not currently restricted, it returns a non-restricted response instead of an error so the client can safely decide whether to render the overlay

These routes should follow the repository's existing authenticated API wrapper patterns.

## Invoice History Design

`workspace_billing_invoices` is the source for user-visible payment history.

Each row must support transparent user-facing history:

- created date
- amount
- invoice status
- provider invoice reference
- transaction reference if available
- entitlement period covered by the payment
- paid date or expiry date
- a continue-payment action if the invoice is still pending and usable

The history must retain:

- paid invoices
- pending invoices
- expired invoices
- canceled invoices
- failed invoices

No normal flow should delete invoice history rows.

## Mayar Without Webhooks

### Polling Strategy

- refresh pending invoice state when the billing page loads after return from Mayar
- allow explicit manual refresh by `superadmin`
- run background reconciliation to poll pending invoices and expire active paid periods

### Cron Jobs

Recommended scheduled jobs:

- `reconcile_pending_workspace_invoices`
- `expire_active_workspace_periods`

### Provider Failure Handling

- if invoice creation fails, the system must not leave a seemingly valid pending checkout without a provider invoice behind
- if Mayar is temporarily unavailable during refresh, keep the last known status and show that synchronization is delayed
- if the user pays but never returns to the app, background reconciliation must still activate the paid period

## Idempotency and Concurrency

Approved idempotency rules:

- a workspace cannot create multiple simultaneous pending checkouts
- an existing valid pending invoice must be reused
- invoice activation from `paid` must happen only once
- subscription expiry must happen only once
- repeated refresh or cron executions must be safe and produce the same final state

Recommended implementation checks:

- guard checkout creation with a lookup for valid pending invoice rows before provider calls
- treat both `pending_initializing` and `pending` as open-checkout states
- add schema indexes that support open-checkout lookup by workspace and status, plus provider invoice lookup by provider invoice id
- check current local invoice state before applying provider updates
- check current subscription state before activation and expiry writes
- only change `workspaces.plan` inside internal billing lifecycle mutations

Because Convex does not provide relational transactions across arbitrary external calls, the design depends on:

- deterministic open-checkout lookup before every checkout attempt
- a single internal mutation that atomically checks for any open checkout or active entitlement and reserves the pending subscription plus `pending_initializing` invoice before any Mayar call
- idempotent lifecycle mutations
- provider-reconciliation-first handling for ambiguous failures

## Error Codes

Recommended billing and restriction error codes:

- `BILLING_PENDING_INVOICE_EXISTS`
- `BILLING_FORBIDDEN`
- `BILLING_INVOICE_NOT_FOUND`
- `BILLING_SYNC_FAILED`
- `WORKSPACE_RESTRICTED_EXPIRED`
- `PLAN_RECOVERY_REQUIRED`

These should preserve domain meaning through API wrappers so the frontend can render the correct billing and recovery states.

## Testing Strategy

### Billing Flow Tests

- creating checkout creates a new pending invoice only when no valid pending invoice exists
- creating checkout reuses an existing valid pending invoice
- creating checkout is rejected when any active entitlement already exists, including `enterprise`
- refreshing a paid invoice activates `pro` exactly once
- refreshing an expired or failed invoice does not activate `pro`
- repurchase after expiry creates a new invoice and a new entitlement period

### Expiry and Restriction Tests

- an active `pro` period expires exactly once when its period ends
- expiry downgrades `workspaces.plan` to `free`
- expired workspaces with over-limit members or devices enter restricted expired mode
- restricted expired mode remains active until both member and device counts are compliant

### Access Control Tests

- only `superadmin` can create checkout or refresh payment
- only `superadmin` can view payment history
- `admin` sees restricted overlay data as read-only
- `karyawan` and `device-qr` cannot access billing surfaces

### History Tests

- payment history retains pending, paid, expired, canceled, and failed invoice rows
- covered entitlement periods are stored on paid rows
- provider identifiers and last synced metadata are preserved

### Idempotency Tests

- repeated refresh calls do not double-activate a period
- repeated expiry jobs do not double-expire a period
- pending invoice reuse remains stable under repeated checkout requests

## Rollout Plan

Recommended implementation sequence:

1. Add schema tables for subscriptions, billing customers, invoices, and billing events.
2. Add internal billing lifecycle helpers and state transitions.
3. Add Mayar provider adapter actions.
4. Add checkout creation and pending invoice reuse.
5. Add invoice refresh and activation flow.
6. Add active-period expiry and reconciliation cron jobs.
7. Add restricted expired mode query and server-side recovery guard.
8. Add dashboard billing page, payment history, and mandatory restricted overlay.
9. Add tests for role access, idempotency, history, expiry, and restricted recovery.

## Acceptance Criteria

This design is successful when:

- `workspaces.plan` remains the only plan field in the system
- `workspace_subscriptions` tracks lifecycle without duplicating plan names
- `superadmin` can see transparent real payment history anchored to provider-backed invoice data
- a workspace cannot open a second checkout while a valid pending checkout already exists
- paid `pro` periods activate for 30 rolling days exactly once per successful invoice
- expired `pro` periods downgrade to `free` automatically
- workspaces that are over free-plan limits after expiry enter restricted expired mode without losing operational attendance data
- `superadmin` can recover either by paying again or by reducing active members and devices to free-plan limits

## Next Step

The next step after user review is to write the implementation plan for schema, Convex billing lifecycle, Mayar adapter calls, API wrappers, restricted recovery overlays, and verification.
