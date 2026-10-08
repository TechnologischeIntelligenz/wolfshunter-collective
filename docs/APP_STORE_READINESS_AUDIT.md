# App Store readiness audit

## Current verdict

Historical audit. Use [current post-deployment review](APP-STORE-REVIEW-CURRENT-20260918.md) and [release tracker](RELEASE-TRACKER.md). The SQLite, hosting and early scope statements below are no longer current.

Preparation in progress; not ready for the final review button yet. The
retailer shell, Shopify authentication, read-only diagnostics, support modes,
explicit DRAFT creation, public legal/support routes, billing flow, and admin
separation are implemented. The public v1 grant is intentionally limited to
`write_products`; order/customer access and order webhooks are deferred.

## Retailer MVP that must remain stable

- olive-green retailer dashboard;
- Shopify session/authentication without 410 on `/app`;
- Discover and Import List scoped to the authenticated shop;
- explicit Shopify DRAFT creation with retry-safe handles;
- no automatic publication;
- retailer settings separate from operator/admin settings;
- support bot with technical, product, returns/orders, and merchant modes;
- app-admin view separated by server-side email/shop allowlist;
- read-only live product/collection catalog for the allowlisted main shop;
- public privacy, app terms, and support routes.

## Blocking work before submission

1. Replace fixture catalog data with the approved supplier catalog and
   tenant-scoped persistence.
2. Keep Orders, Fulfillment, and Tracking out of the listing navigation until
   protected customer data and the corresponding scopes are separately
   approved. Analytics must make its limited current dataset explicit.
3. Finish Shopify billing configuration in Partner Dashboard. The local
   development flow is prepared for 99 EUR every 30 days with a 14-day trial
   in no-charge test mode; real production billing must be enabled and tested
   through Shopify's approved pricing flow.
4. Move the production database off local SQLite and deploy on durable,
   production-grade hosting.
5. Complete legal review of the app privacy/terms text. Protected customer-data
   review remains a future prerequisite before adding order/customer fields,
   addresses, or fulfillment operations. Replace the old public storefront
   contact `info@worldshopstore.org` with `info@wolfshunter.com` in Shopify
   Admin before review.
6. Create and configure the second Shopify Partner app and domain for the
   supplier portal; it is not represented by the retailer client ID.

The app should be submitted only after these are real product capabilities,
not just dashboard cards.
