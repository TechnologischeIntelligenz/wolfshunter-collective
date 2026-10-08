Current implementation update: see [Orders, policies and privacy](ORDER-POLICY-SYNC-20260918.md). Order pagination/webhooks, privacy request workflows and expanded shop deletion were implemented after the review below. Remaining live release gates still apply.

# Release readiness — 18 September 2026

HISTORICAL: use [current post-deployment review](APP-STORE-REVIEW-CURRENT-20260918.md). Hosting, database, stock and variant evidence below is superseded where noted there.

Verdict: NOT READY FOR PUBLIC SUBMISSION. Local preparation only; no production deployment, submission, or charge performed.

## Verified

- Typecheck, ESLint, 21 automated tests and production build passed.
- After targeted changes: typecheck, ESLint and production build passed again.
- Compiled import-list component renders with current catalog data; authenticated browser workflow still needs confirmation.
- Invalid webhook HMAC rejected with HTTP 401.
- Signed customer topics now dispatch correctly; acknowledgement alone does NOT complete the required data processing.
- Signed shop/redact deletes the target workspace and preserves another tenant in an isolated migrated SQLite database.
- Configurable SOURCE_DATA_DIR write/read tested; compose maps it to /data/source on its durable volume.
- Local dev and temporary HTTPS tunnel respond 200. collective.wolfshunter.com fails DNS resolution (ENOTFOUND).

## Changes in this pass

- Corrected SDK webhook topic comparisons to CUSTOMERS_DATA_REQUEST, CUSTOMERS_REDACT, SHOP_REDACT and APP_UNINSTALLED.
- Corrected privacy page's false assertion that the app does not request/store order data. The text now discloses actual order metadata and support-message processing. Legal review is still required.
- Added SOURCE_DATA_DIR support and configured /data/source in compose. Existing local data remains in ./data unless configured otherwise. The production volume still needs to be populated; no transfer was performed.

## Submission blockers / required evidence

1. Permanent HTTPS hosting and DNS for collective.wolfshunter.com; install, callback, legal pages and authenticated retailer/admin routes must work there. Shopify CLI deploy alone does not host the application.
2. Privacy processing: customer request/redact branches only acknowledge requests. Implement durable processing/export/redaction for retained order metadata and support data. Shop deletion also omits CatalogKnowledgeProduct, CatalogSyncRun, KnowledgeDocument, RetailerProductRelease and source files/cache. Cover retries and concurrent sync before public use.
3. Production auth.login renders a manual shop-domain field; installation must originate on Shopify. Provide the appropriate Shopify-owned install entry and verify install/reinstall/incognito navigation.
4. Billing: validate accept/decline/reinstall and test-mode behaviour in the dev shop. Do not enable real charges during testing. The implementation currently advertises EUR 99 / 30 days with 14-day trial.
5. Functional scope: fulfillment is an explicit lifecycle preview and tracking is a placeholder. Product drafts do not clone the entire source variant matrix. No complete supplier fulfillment/payment/tracking workflow is demonstrated. Do not advertise those as shipping functionality.
6. Order access / protected customer data approval must be confirmed in Developer Dashboard. An order webhook endpoint exists, but subscriptions are not configured in shopify.app.toml. Current order sync is manual and limited to recent records.
7. Source synchronization uses verified snapshots with manual/operator triggers; ongoing automatic price, inventory and deletion synchronization is not yet proven for imported retailer products.
8. Listing, pricing consistency, support contact, reviewer instructions, screencast, legal texts and dashboard automated checks remain unverified.

## Shopify local-code review

Live requirements fetched on 18 September 2026 from:
https://shopify.dev/docs/apps/launch/app-store-review/app-store-ai-self-review-requirements
Saved at _recovery/shopify-review-requirements.html (plain text response).

Summary of applicable general requirements: 25 likely passing, 2 likely failing, 4 need review. 10 category groups skipped under the source's applicability/opt-in rules. These counts cover only Shopify's selected code-checkable requirements, not all submission requirements; operational blockers above take precedence.

| Requirement | Assessment | Evidence / limit |
| --- | --- | --- |
| 1.1.1 | Needs review | SDK session-token authentication present; incognito browser path not tested. |
| 1.1.2 | Likely passing | No external checkout/payment processing implemented. |
| 1.1.3 | Likely passing | No theme download/installation functionality. |
| 1.1.4 | Likely passing | Real source catalog; development preview explicitly labelled and unavailable in production. Listing not reviewed. |
| 1.1.6 | Likely passing | Retailers source a single authorized operator catalog; no multi-seller marketplace checkout. |
| 1.1.7 | Likely passing | No payment gateway implementation. |
| 1.1.8 | Likely passing | No third-party POS integration. |
| 1.1.9 | Likely passing | No automatic checkout surcharges. |
| 1.1.10 | Likely passing | Reads shipping profiles; does not reorder checkout rates. |
| 1.1.13 | Likely passing | User authorizes own catalog; configured source shop; no arbitrary-site importer. |
| 1.1.14 | Likely passing | Own support only; no agency marketplace. |
| 1.1.15 | Likely passing | No refund-processing implementation. |
| 1.1.16 | Likely passing | No lending feature. |
| 1.2.1 | Likely passing | Shopify billing.check/request and configured recurring plan. |
| 1.2.2 | Needs review | Charge acceptance, decline, reinstall and production settings not verified. |
| 1.2.3 | Likely passing | One plan; no multi-plan switching requirement triggered. |
| 2.2.1 | Likely passing | Shopify Admin GraphQL used for catalog and drafts. |
| 2.2.3 | Likely passing | Official embedded AppProvider and App Bridge React used. |
| 2.2.4 | Likely passing | Admin operations use GraphQL, not legacy REST. |
| 2.2.6 | Likely passing | No advertising in admin extensions detected. |
| 2.2.7 | Likely passing | No automatically opened Max modal detected. |
| 2.3.1 | Likely failing | auth.login still requests manual shop-domain entry in production. |
| 2.3.2 | Likely passing | Functional child loaders/actions authenticate with Shopify SDK before accessing tenant data. |
| 2.3.3 | Needs review | Production callback/app redirect cannot be verified while hostname is unavailable. |
| 2.3.4 | Needs review | SDK session persistence exists; reinstall flow not exercised. |
| 3.1.1 | Likely failing | Permanent configured HTTPS hostname does not resolve. Temporary tunnel is not the deployment. |
| 3.2.1 | Likely passing | read_all_orders not requested. |
| 3.2.2 | Likely passing | write_payment_mandate not requested. |
| 3.2.3 | Likely passing | write_checkout_extensions_apis not requested. |
| 3.2.4 | Likely passing | read_advanced_dom_pixel_events not requested. |
| 3.2.5 | Likely passing | read_checkout_extensions_chat not requested. |

Skipped groups: 5.1 Online store (no theme extension), 5.2 Payment (no payment extension/scopes), 5.3 Payment facilitator (opt-in not requested), 5.4 Purchase option (no subscription-contract/payment-mandate scopes), 5.5 Product sourcing (source explicitly requires opt-in; not included in formal counts; operational gaps recorded above), 5.6 Checkout customization (no checkout extension), 5.7 Sales channel (no channel_config extension), 5.8 Post purchase (no post-purchase extension), 5.9 Mobile app builders (opt-in not requested), 5.10 Donation (opt-in not requested).

Resources:
- https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements
- https://shopify.dev/docs/apps/launch/shopify-app-store/best-practices
- https://shopify.dev/docs/apps/launch/billing
- https://shopify.dev/docs/apps/launch/app-store-review/submit-app-for-review

