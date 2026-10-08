# WOLFSHUNTER COLLECTIVE Shopify scope architecture

## Current retailer app grant

The App Store v1 retailer app requests only `write_products`. The product write
grant covers the product/catalog reads needed by the explicit DRAFT import
flow. Order/customer access and order webhooks are deferred until a later
protected-customer-data review. The app does not request customer, inventory,
fulfillment, publication, order, or historical `read_all_orders` access.

Status: App Store v1 configuration prepared; deployment pending  
Reviewed: 2026-08-21 against current official Shopify documentation  
Target Admin API: 2026-07 (the app currently uses `ApiVersion.July26`)

## Decision

Use Shopify managed installation for App Store v1 with this least-privilege
declaration:

```toml
[access_scopes]
scopes = "write_products"
```

Inventory, orders, fulfillment, and optional publication scopes in the matrix
below describe a future separately reviewed architecture; they are not part of
the current installation grant.

Shopify states that a write scope includes the corresponding read permission. Therefore, do not separately declare `read_products`, `read_inventory`, `read_merchant_managed_fulfillment_orders`, or `read_publications` beside their write scopes. Shopify's managed-install documentation specifically shows that `write_products` grants `read_products` and rejects a redundant implicit scope configuration.

This proposal intentionally supports an MVP in which Collective manages only fulfillment orders assigned to merchant-managed locations. It does not authorize Collective to manage locations owned by another fulfillment service and does not register Collective as a Shopify Fulfillment Service.

## Current-scope audit

| Current scope | Decision | Evidence and rationale |
|---|---|---|
| `write_products` | Keep | Required to create and update imported products, variants, prices, product options, SEO fields, and product media associations. It includes product read access. |
| `write_metaobjects` | Remove | The only current use is the generated `$app:example` app-owned metaobject. Admin API 2026-04 and later allows an owning app to read and write app-owned metaobjects without metaobject scopes. |
| `write_metaobject_definitions` | Remove | The current definition is declarative and app-owned (`[metaobjects.app.example]`). It does not justify merchant-owned definition access. Use the Collective database for central cross-merchant mappings and Network Orders; use app-owned metaobjects only for store-local app data when useful. |

No merchant-owned metaobject feature exists in the repository. If one is designed later, it must undergo a new scope review; it must not inherit access merely because the generated template once requested it.

## Scope matrix

| SCOPE | FEATURE | READ/WRITE | REQUIRED/OPTIONAL | WHY REQUIRED | WHEN REQUESTED | PROTECTED DATA? | REVIEW RISK |
|---|---|---|---|---|---|---|---|
| `write_products` | Catalog import/push | Write + implicit read | Required | Creates/updates products, initial and bulk variants, prices, options, SEO data, and media associations. | Installation | No | Medium: broad product mutation; restrict writes to mapped Collective products. |
| `read_products` | Catalog inspection/mapping | Read | Required, implicit; do not declare | Needed to detect existing products and verify mutations, but is granted by `write_products`. | With `write_products` | No | Low; redundant declaration would add no access. |
| `write_inventory` | Inventory synchronization | Write + implicit read | Required | Reads mapped inventory and changes inventory quantities only for eligible mapped variants at approved locations. | Installation | No | High: stock changes affect sellability; require source freshness, compare-and-set, idempotency, and mapping checks. |
| `read_inventory` | Inventory inspection | Read | Required, implicit; do not declare | Needed for reconciliation and mutation verification, but is granted by `write_inventory`. | With `write_inventory` | No | Low as an implicit grant. |
| `read_locations` | Location resolution | Read | Required | Resolves the exact retailer location used by mappings and inventory/fulfillment checks. No location mutation is needed. | Installation | No | Low. |
| `read_orders` | Order intake and Network Order creation | Read | Required | Reads recent retailer orders and line items to detect mapped Collective variants and create internal Network Orders. Default access is limited to the most recent 60 days. | Installation; usable on production only after applicable protected-data approval | Yes | High: Orders are protected customer data; identifiable fields require Level 2 review. |
| `write_merchant_managed_fulfillment_orders` | Fulfillment and tracking at merchant-managed locations | Write + implicit read | Required for the chosen MVP architecture | Reads eligible merchant-managed fulfillment orders, creates fulfillments for mapped lines, and updates tracking. It does not authorize fulfillment of orders assigned to app-managed or other third-party locations. | Installation; mutation feature remains policy-gated | Yes | High: can change fulfillment state and expose fulfillment-required PII. |
| `read_merchant_managed_fulfillment_orders` | Fulfillment-order inspection | Read | Required, implicit; do not declare | Needed to inspect fulfillment orders, but is granted by the corresponding write scope. | With write scope | Yes | Low as an implicit grant. |
| `write_publications` | Optional “Publish Active” feature | Write + implicit read | Optional | Publishes an eligible imported product to a merchant-selected publication. Import remains DRAFT/unpublished by default. | Only after the merchant explicitly activates publishing and accepts the permission prompt | No | Medium: affects storefront visibility and sales channels; require preview and explicit merchant approval. |
| `read_publications` | List/select publications | Read | Optional, implicit; do not declare with write | Listing publications is needed by the publishing feature, but `write_publications` includes read permission. A future read-only channel browser could request only this scope instead. | With `write_publications` | No | Low as an implicit grant. |
| `read_files` | Browse Shopify Files | Read | Not requested | Product media can be associated from permitted supplier CDN URLs through product mutations. | Only if a later, separately approved feature browses/selects existing store Files without writing them | No | Medium: unnecessary access to merchant assets for MVP. |
| `write_files` | Create/manage Shopify Files | Write + implicit read | Not requested | The Files API is not needed for URL-based product media. | Only if a later feature must create reusable Files assets, upload binaries/staged assets, or manage non-product files | No | Medium/high: broad merchant asset mutation. |
| `read_assigned_fulfillment_orders` | Collective Fulfillment Service | Read | Future architecture alternative; implicit if write is granted | Would read only fulfillment orders assigned to Collective-owned fulfillment-service locations. | Only after Collective deliberately implements and registers a Shopify Fulfillment Service | Yes | High. |
| `write_assigned_fulfillment_orders` | Collective Fulfillment Service lifecycle | Write + implicit read | Future architecture alternative, not additive to MVP | Would accept/reject requests, create fulfillments, and update tracking for Collective-assigned fulfillment orders. Replace merchant-managed scopes where that architecture applies; do not request both by default. | Only on explicit migration to a Fulfillment Service architecture | Yes | High. |
| `write_fulfillments` | Register a Fulfillment Service | Write + implicit read | Future architecture prerequisite; not requested | `fulfillmentServiceCreate` requires it and creates a dedicated app-managed location. | Only during an approved Fulfillment Service rollout | No by itself | High: changes store fulfillment configuration. |
| `read_third_party_fulfillment_orders` | Inspect orders assigned to another fulfillment service | Read | Not requested | Needed only for an order-management feature that must inspect fulfillment orders at locations owned by other fulfillment apps. | Only after a concrete cross-3PL workflow and merchant opt-in | Yes | High. |
| `write_third_party_fulfillment_orders` | Manage workflow at another fulfillment service | Write + implicit read | Not requested | Relevant only to an order-management architecture coordinating other fulfillment services. Since API 2024-10 it cannot be used by an order-management app to create fulfillments for orders assigned to a different fulfillment-service app. | Only after a concrete cross-3PL workflow and separate review | Yes | Very high. |
| `read_customers` | Customer profile access | Read | Not requested | Order and fulfillment resources provide the minimum order-specific fulfillment data. Collective must not query the customer's general profile. | Never by default; only for a separately justified customer-profile feature | Yes | Very high. |
| `write_orders` | Edit retailer orders | Write + implicit read | Not requested | Internal Network Orders live in Collective storage, and fulfillment/tracking uses Fulfillment Order scopes. No MVP feature edits Shopify orders. | Only after a concrete, separately reviewed order-edit mutation exists | Yes | Very high. |
| `read_all_orders` | Orders older than 60 days | Read | Not requested | Real-time routing and reconciliation fit Shopify's default 60-day order window. Historical import is not an MVP requirement and this scope requires separate Shopify permission. | Only after a proven historical-order feature and approval | Yes | Very high. |
| `write_metaobjects` / `write_metaobject_definitions` | Merchant-owned structured data | Write + implicit read | Removed | Current data is app-owned or belongs in Collective's tenant-isolated database. | Only if a real merchant-owned, cross-app/Admin-managed data feature is approved | Potentially, depending on contents | Medium. |

## Capability-to-scope mapping

### A. Product import / push

`write_products` is sufficient for the planned product workflow and includes product reads. `productCreate`, `productUpdate`/`productSet`, and bulk variant mutations cover product data, variants, prices, options, SEO fields, and media associations.

Product media should use supported supplier CDN URLs through product media inputs. Shopify's current `productCreate` example associates an image by `originalSource` under `write_products`; the Files API is not involved. Use `read_files`/`write_files` only if Collective later needs the merchant's Files library as a first-class feature.

Mappings belong in the Collective database because they span multiple merchants and must be centrally tenant-isolated. App-owned Shopify metafields/metaobjects may hold store-local pointers or display data but must not become the cross-merchant source of truth.

### B. Inventory

`write_inventory` provides inventory write and read access; `read_locations` identifies approved locations. Every write must be limited to a healthy mapping `(tenant, retailer shop, Collective product, Shopify variant, inventory item, location)`.

For Admin API 2026-04+, inventory mutations that support Shopify's `@idempotent` directive require an idempotency key. Absolute writes must use compare-and-set where supported. A stale supplier snapshot, missing mapping, wrong location, tenant mismatch, or negative/invalid quantity is a hard denial.

### C. Orders

`read_orders` is required to receive/query recent orders and inspect mapped line items. It supports creating an internal Network Order; it does not authorize a Shopify order mutation. The default 60-day order window is adequate for MVP event handling and reconciliation, so `read_all_orders` is excluded.

The system must process only mapped line items. Unmapped line items, payment data, customer profile history, marketing state, fraud data, browsing data, and billing address are outside the MVP purpose.

### D. Fulfillment and tracking

For MVP, `write_merchant_managed_fulfillment_orders` is the narrowest usable model if imported inventory is assigned to a merchant-managed location. Shopify's `fulfillmentCreate` and `fulfillmentTrackingInfoUpdate` accept this scope. The write permission includes read access, so its read counterpart is not declared.

Hard boundary: if a target fulfillment order is assigned to an app-managed or third-party fulfillment-service location, Collective must stop and ask the merchant to resolve routing. It must not request broader scopes as an automatic fallback.

### E. Product publication

Product creation remains DRAFT/unpublished by default. Publishing is a separate feature using optional `write_publications`, which includes publication reads. Granting the scope does not itself authorize a publication; the merchant must select the feature/product/channel and approve a preview.

### F. Files

No Files scope is required for MVP. Supplier CDN URL ingestion through the product API is preferred. File access needs a new review if CDN hotlinking, availability, content rights, supported media type, or Shopify ingestion constraints make a dedicated Files workflow necessary.

## Fulfillment architecture recommendation

### MVP: order-management behavior at merchant-managed locations

Use only `write_merchant_managed_fulfillment_orders`. This minimizes implementation and scope surface while the product/import, mapping, inventory, Network Order, and supplier-routing models are being proven.

MVP eligibility must explicitly require that every routed fulfillment-order line belongs to a mapped Collective variant and is assigned to an approved merchant-managed location. Split orders must be handled by fulfillment order and line item, never by treating the entire Shopify Order as a single fulfillment unit.

### Future: Collective as a Shopify Fulfillment Service

If Collective operationally owns the fulfillment workflow and inventory location, the Fulfillment Service model is semantically stronger and narrows access to work assigned to Collective's own location. A deliberate migration would:

1. Add `write_fulfillments` to register/configure the service and its dedicated location.
2. Replace merchant-managed fulfillment-order access with `write_assigned_fulfillment_orders` (read is implicit).
3. Implement request acceptance/rejection, cancellation requests, callbacks/webhooks, assigned-order queries, and tracking/fulfillment creation.
4. Migrate mappings and inventory ownership deliberately, with merchant consent and rollback procedures.
5. Reassess whether `read_orders` remains required for fields not available in assigned fulfillment orders.

Do not request assigned and merchant-managed architectures together merely for future flexibility.

### Third-party fulfillment locations

Use third-party fulfillment-order scopes only if Collective becomes an order-management layer that coordinates fulfillment orders assigned to other fulfillment-service apps. `read_third_party_fulfillment_orders` enables inspection; `write_third_party_fulfillment_orders` enables supported management actions. It does not allow an order-management app to create a fulfillment for another service's assigned order as of API 2024-10. This is not part of MVP.

## Managed installation and progressive permissions

Required scopes are granted at installation. Optional scopes are declared in `optional_scopes` but are not requested during installation. They can be requested after installation and can later be revoked by the merchant.

For “Publish imported products automatically”:

1. Authenticate the retailer and resolve the tenant server-side.
2. Verify subscription/trial entitlement and feature availability.
3. Query currently granted, required, and optional scopes.
4. Explain the exact channel-visibility effect and ask the merchant to activate the feature.
5. If absent, request only `write_publications` through Shopify's App Bridge scopes API (or the React Router `scopes.request()` server helper where appropriate).
6. After grant, show a dry-run preview and require product/publication confirmation.
7. If denied or later revoked, leave imported products DRAFT and disable publishing without breaking core features.

The existing `app/scopes_update` webhook must invalidate cached grant state. Scope declarations do nothing until deployed, and optional scopes cannot be requested until their declaration has been deployed. Deployment and dynamic requests are explicitly outside this task.

## Collective decision and mutation policy gateway

No AI model, agent, browser client, webhook payload, queue worker, or rule engine receives a raw Shopify mutation client. They can only submit immutable proposals to a server-side policy gateway.

```text
AI / RULE ENGINE
  -> PROPOSAL
  -> POLICY CHECK
  -> TENANT CHECK
  -> ENTITLEMENT CHECK
  -> SCOPE CHECK
  -> MAPPING CHECK
  -> VALIDATION
  -> DRY RUN / PREVIEW
  -> OWNER OR MERCHANT APPROVAL (where required)
  -> IDEMPOTENT MUTATION
  -> VERIFY
  -> AUDIT
```

### Confidence policy

| Score | Label | Effect |
|---|---|---|
| `>= 0.95` | High confidence | Eligible to continue through the same hard policy gates; never permission to mutate by itself. |
| `0.80-0.949` | Review recommended | Queue for owner/merchant review unless a deterministic, pre-approved policy explicitly handles it. |
| `< 0.80` | Manual review | No mutation; require a human decision or better evidence. |

Confidence never overrides tenant isolation, missing entitlement/scope, mapping failures, stock/margin rules, validation errors, protected-data restrictions, approval requirements, or idempotency controls.

### Central permissions

| Permission | Minimum policy conditions |
|---|---|
| `CAN_READ_CATALOG` | Authenticated retailer tenant; product read grant present implicitly or explicitly; tenant-scoped query. |
| `CAN_FAVORITE` | Authenticated tenant; write only to Collective storage; no Shopify mutation. |
| `CAN_IMPORT_STAGE` | Retailer selected supplier item; entitlement active; eligibility/margin/media checks pass; stage only in Collective storage. |
| `CAN_PUSH_PRODUCT` | Merchant approved import or explicit automation policy; `write_products`; eligible source; valid margin; unique/healthy mapping; idempotency key; preview accepted. |
| `CAN_SYNC_INVENTORY` | `write_inventory`; approved location; healthy exact mapping; fresh source stock; valid quantity; compare-and-set/idempotency; mapped item only. |
| `CAN_ROUTE_ORDER` | `read_orders`; protected-data approval for requested fields; accepted order state; mapped lines only; tenant match; supplier/stock/margin policy passes. |
| `CAN_UPDATE_TRACKING` | Correct fulfillment write scope; fulfillment order and lines match the tenant/mapping; supplier shipment evidence valid; tracking validates; no previously conflicting mutation. |
| `CAN_PUBLISH` | Optional `write_publications` currently granted; merchant enabled feature; product is eligible/ACTIVE; target publication belongs to tenant; preview/approval recorded. |
| `CAN_BULK_PUSH` | All `CAN_PUSH_PRODUCT` checks per item; explicit batch approval; plan limit; bounded batch size; dry run; partial-failure and rollback strategy. |

Permissions also depend on retailer approval, subscription/trial state, current Shopify grants, product eligibility, mapping health, stock availability, margin policy, and tenant identity. A missing or stale fact fails closed.

### Mutation envelope and audit

Every accepted proposal should carry:

- proposal ID, tenant ID, shop ID, actor type/ID, requested permission, and feature entitlement;
- target Shopify resource IDs plus mapping version/hash;
- source evidence and freshness, before/expected-after state, validation result, and confidence;
- required and currently granted scopes, protected-data classification, approval record, and policy version;
- deterministic idempotency key, attempt number, Shopify request ID, mutation result, verification result, and timestamp.

Never log access tokens, client secrets, raw protected payloads, full addresses, emails, or phone numbers. Audit records should reference encrypted records by opaque ID and store only redacted summaries.

## Official Shopify sources

- [Shopify API access scopes](https://shopify.dev/docs/api/usage/access-scopes)
- [Manage access scopes with Shopify managed installation](https://shopify.dev/docs/apps/build/authentication-authorization/app-installation/manage-access-scopes)
- [App-owned metaobjects no longer require scopes in API 2026-04+](https://shopify.dev/changelog/metaobject-scopes-not-required-for-app-metaobjects)
- [About metaobject ownership](https://shopify.dev/docs/apps/build/metaobjects/index)
- [Product creation and URL-based media association](https://shopify.dev/docs/api/admin-graphql/latest/mutations/productCreate)
- [Inventory quantity mutation and idempotency guidance](https://shopify.dev/docs/api/admin-graphql/latest/mutations/inventorySetQuantities)
- [Location access](https://shopify.dev/docs/apps/build/orders-fulfillment/inventory-management-apps/migrate-to-read-locations)
- [Order object, scope, and default 60-day window](https://shopify.dev/docs/api/admin-graphql/latest/objects/Order)
- [Fulfillment Order scopes and architecture](https://shopify.dev/docs/api/admin-graphql/latest/queries/fulfillmentOrder)
- [Fulfillment creation scopes](https://shopify.dev/docs/api/admin-graphql/latest/mutations/fulfillmentCreate)
- [Tracking update scopes](https://shopify.dev/docs/api/admin-graphql/latest/mutations/fulfillmentTrackingInfoUpdate)
- [Fulfillment Service architecture](https://shopify.dev/docs/apps/build/orders-fulfillment/fulfillment-service-apps)
- [Create a Fulfillment Service](https://shopify.dev/docs/api/admin-graphql/latest/mutations/fulfillmentServiceCreate)
- [Publication read scope](https://shopify.dev/docs/api/admin-graphql/latest/queries/publications)
- [Publication write scope](https://shopify.dev/docs/api/admin-graphql/latest/mutations/publishablePublish)
- [Files API write scope](https://shopify.dev/docs/api/admin-graphql/latest/mutations/fileCreate)
- [Protected customer data](https://shopify.dev/docs/apps/launch/protected-customer-data)
