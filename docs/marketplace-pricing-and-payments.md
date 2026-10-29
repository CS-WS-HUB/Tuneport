# Marketplace pricing and payment contract

## Seller-funded commission

The initial default commission is 12% (configurable with `MARKETPLACE_COMMISSION_BPS`, where 1200 = 12%). The buyer-facing total remains the listed price. The commission is deducted from the seller's payout; ordinary card processing is not added as a separate buyer surcharge.

The pricing quote reports:

- `buyerTotalCents`: listed amount charged to the buyer.
- `sellerCommissionCents`: rounded commission deducted from the seller's share.
- `sellerPayoutCents`: listed amount less commission.
- `estimatedCardProcessingCents`: planning estimate only, using configurable `STRIPE_CARD_PROCESSING_ESTIMATE_BPS` (default 290) and `STRIPE_CARD_PROCESSING_FIXED_ESTIMATE_CENTS` (default 30).
- `estimatedPlatformContributionCents`: commission less the estimated processing cost. A negative value flags an uneconomic price at the configured assumptions.

Processing defaults are estimates, not a representation of a Stripe contract or the final fee charged. Configure them to match the actual account, payment method mix, and Connect setup. Reconcile actual Stripe balance transactions before treating contribution as realized margin.

## API

- `GET /api/marketplace/pricing` returns the active public pricing configuration.
- `POST /api/marketplace/quote` accepts JSON `{"listingAmountCents": 10000}` and returns a quote. Amounts must be integer cents from $1.00 through $100,000.00.

## Production payment launch gates

These endpoints calculate pricing only. They do not create charges, authorize funds, transfer funds, or represent escrow. Before enabling real payments, implement and verify all of the following against the deployed database and Stripe account:

1. Authenticated buyer and tenant membership/role checks; never accept a client-supplied user or tenant ID as proof of identity.
2. Stripe Connect onboarding and capability checks for the receiving shop.
3. Server-created Checkout Session / PaymentIntent with idempotency keys and an immutable server-side price snapshot.
4. Signed Stripe webhook verification using the raw request body; deduplicate events by Stripe event ID and apply state transitions transactionally.
5. Explicit authorization/capture/cancellation/expiry handling, transfer eligibility rules, refunds/disputes, and reconciliation against Stripe balance transactions.
6. Integration tests for duplicate webhooks, retries, amount/currency mismatch, unauthorized tenant access, failed transfers, refunds, and authorization expiry.

Do not describe delayed transfers as regulated escrow. The legal and product characterization depends on the actual funds flow, Stripe agreement, and jurisdiction.
