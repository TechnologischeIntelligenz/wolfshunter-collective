# Orders, policies and privacy — 18 September 2026

## Delivered locally

- Orders: canonical Shopify GIDs, legacy-ID deduplication, protection against stale/duplicate events, pagination across the standard 60-day access window, incremental updates with a five-minute overlap and last-successful-run checkpoint.
- UI: Orders navigation for retailers/admin, 100 saved orders per page, background reconciliation with status polling, explicit retry and visible sync failures. Orders remain shop-scoped; this does not route retailer orders to suppliers or create fulfillments.
- Webhook subscriptions configured for orders/create, updated, paid, cancelled, fulfilled, partially_fulfilled and delete. Signed events after uninstall are ignored; deleted orders are suppressed from future imports.
- Privacy: durable access/erasure requests, authenticated shop-scoped JSON exports, automatic removal of referenced orders, replay suppression, explicit merchant completion after support-record review, tenant-scoped support deletion UI. No email is sent automatically. The merchant must deliver access results and review unstructured support content before completing a request.
- Shop erasure now covers app-owned database models, source snapshot files and in-memory catalog cache. Active source sync holds deletion for retry; active order reconciliation is cancelled before deletion. These process-local order job controls assume one app instance; multi-instance deployment needs durable distributed job coordination.
- Policies: rejects incomplete/foreign-shop responses, replaces current policies transactionally, removes withdrawn policies from knowledge storage, provides an admin shipping/markets/policies-only refresh and npm run sync:commerce. No storefront policies were modified.
- Catalog remains 8,237 source products / 63 collections; no repeated bulk product export was required for policy refresh.

## Live evidence

- Source commerce refresh COMPLETED at 2026-09-18T02:35:18Z: 6 policies, 17 markets, 12 shipping profiles, 65 shipping countries/territories.
- Dev app order API read succeeded: zero orders available.
- The connected Shopify tool confirmed 3ddd6b-2.myshopify.com / WOLFSHUNTER and returned two orders in the last 60 days. Both were idempotently imported into the local app database.
- The restored main-shop app session still failed authentication. Connected Shopify access is a separate credential and does not repair that app session. Continuous main-shop API reconciliation needs successful app authentication and permanent hosting.
- New dev preview is ready with scopes auto-granted. /healthz, /support and /privacy each returned HTTP 200 at https://episode-sorted-rating-through.trycloudflare.com.
- Dev CLI session 34684 remains running. Open the app through Shopify Admin, not an uncontextualized /app URL.

## Verification

29 automated tests passed; typecheck and ESLint passed; production build passed. Tests use isolated newly migrated SQLite databases, never real customer data.

Additional signed webhook integration checks against the compiled build passed: invalid HMAC=401, duplicate/stale order events, deletion replay suppression, ignoring events after uninstall, customer request dispatch and shop-scoped deletion. Import-list component render also passed. No authenticated browser walkthrough or live customer event was manufactured.

## Remaining release work

Permanent hosting/DNS and main-shop app reauthentication; live installation/reinstallation and billing acceptance/decline tests; Developer Dashboard order/protected-data access checks; reviewer materials and legal review; final merchant privacy workflow test; backup retention/redaction-restoration procedures. Production webhook delivery is not proven by isolated signed tests or local TOML configuration.

Orders older than 60 days require the appropriate Shopify historical-order access; no read_all_orders permission was added. Fulfillment execution, carrier tracking, and automatic propagation of source inventory/prices into retailer products remain separate unfinished capabilities.

Sources checked:
- https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance
- https://shopify.dev/docs/api/admin-graphql/latest/queries/orders
