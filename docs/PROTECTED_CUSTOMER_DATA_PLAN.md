# WOLFSHUNTER COLLECTIVE protected customer data plan

Status: design only; do not request production access yet  
Reviewed: 2026-08-12 against current official Shopify documentation

## Decision

Collective's order-routing and fulfillment workflow will require protected customer data. Orders and shipping/fulfillment resources are protected customer data even when direct identifiers are excluded. A shipping workflow that uses recipient name and delivery address requires Shopify Level 2 protected customer data review.

OAuth scope authorization and protected customer data approval are separate controls:

1. The merchant grants `read_orders` and the relevant fulfillment-order scope through installation.
2. Shopify separately approves a public app's access to protected customer data and, individually, the name, address, email, and phone fields it requests.
3. Until both layers allow a field, production responses can be redacted or rejected even though the OAuth scope appears granted.

No production protected-data request is authorized by this document. Shopify currently requires a distribution method to be selected before requesting access; distribution selection is intentionally outside this task.

## Minimum data purpose

Purpose: create and route an internal Network Order for only the mapped Collective line items that a retailer has accepted, send the minimum shipping instructions to the responsible supplier/fulfillment party, and synchronize fulfillment/tracking status back to that retailer's Shopify store.

Collective must not use order data for customer profiling, advertising, cross-retailer identity matching, model training, unrelated analytics, lead generation, or supplier marketing.

## Minimum field set

### Required for routing and fulfillment

- tenant/shop identifier;
- Shopify order ID and display name/reference;
- fulfillment order ID and fulfillment-order line item IDs;
- mapped Shopify product/variant/inventory item IDs and Collective mapping IDs;
- SKU/product description needed by the supplier, quantity, and fulfillment status;
- shipping/delivery method and approved destination country/region where needed for eligibility;
- recipient first and last name;
- shipping address line 1 and, only when present, line 2;
- city, province/state code, postal/ZIP code, and country code.

Orders and fulfillment data trigger Level 1 requirements. Recipient name and shipping address trigger Level 2 requirements and field-specific approval.

### Conditional, not collected by default

- Phone: only when the selected carrier, customs process, or last-mile delivery genuinely requires it for that shipment. Do not fetch, send, or retain it merely because Shopify exposes it.
- Email: default to no access. Prefer Shopify's own customer-notification behavior when creating/updating fulfillment. Request and process email only if a later fulfillment workflow proves that direct customer contact is necessary and the merchant enables it.

Each conditional field requires purpose documentation, a field-level feature flag, policy-gateway approval, supplier contract coverage, and a new protected-data review justification before production use.

### Explicitly excluded from MVP

- general Customer profile queries and `read_customers`;
- billing address;
- marketing consent/state, tags, segments, browsing/journey data, IP address, fraud/risk data, and customer notes;
- payment methods, transactions, and financial credentials;
- unrelated line items or fulfillment orders;
- historical orders older than Shopify's default 60-day window;
- full raw webhook or GraphQL payload retention;
- use of protected data in AI prompts, embeddings, model training, analytics events, logs, traces, or error reports.

## Data-flow controls

1. Verify Shopify authentication/HMAC before parsing or enqueueing data.
2. Resolve the tenant from the authenticated shop on the server; never accept a client-supplied tenant as authority.
3. Use webhook/event identifiers to trigger a server-side fetch of only the approved fields when possible; do not persist broad payloads.
4. Filter to mapped Collective line items before reading or copying destination data.
5. Run tenant, entitlement, scope, protected-field approval, mapping, stock, margin, and order-state checks.
6. Create an encrypted tenant-scoped Network Order containing only the approved minimum.
7. Disclose only the shipment subset to the specifically assigned supplier/fulfillment party under a data-processing agreement.
8. Update tracking through the correct Shopify Fulfillment Order; prefer Shopify customer notifications over copying email.
9. Verify the mutation, write a redacted audit record, and schedule field-level deletion.

If no mapped line item remains after filtering, discard the protected payload and create no Network Order.

## Tenant isolation

- Every protected record must include an immutable internal tenant ID and Shopify shop ID.
- Every lookup/update/delete must use a composite tenant key; globally addressable order IDs alone are forbidden.
- Repository/service methods derive tenant context from an authenticated server session or verified webhook, not request parameters.
- Database row-level controls or equivalent mandatory query guards deny cross-tenant access.
- Supplier users can access only explicitly assigned Network Orders and shipment fields, never retailer-wide order/customer data.
- Background jobs carry a signed/validated tenant context and re-check tenant ownership before every read or mutation.
- Cache keys, object-storage prefixes, queues, exports, audit queries, and observability dimensions must be tenant-scoped.
- Cross-retailer search, aggregation, joins on customer identifiers, or shared AI context are prohibited.
- Automated tests must include hostile cross-tenant ID substitution and confirm fail-closed behavior.

## Security controls

### Encryption and secrets

- TLS in transit for Shopify, supplier, database, queue, storage, and internal service connections.
- Encryption at rest for databases, queues, object storage, and all backups.
- Field-level authenticated encryption for name, address, phone, and email, with keys stored in a managed KMS/secret manager outside the database.
- Separate keys and datasets for development, staging, and production; production data is never copied to test environments.
- Rotate keys and tokens; record rotation without logging secret values.
- Never print Shopify client secrets, access/refresh tokens, raw addresses, email, or phone.

### Access control and monitoring

- Least-privilege RBAC with MFA/strong-password controls for staff and supplier accounts.
- Default deny for staff access; time-bound audited support elevation for a specific tenant/order only.
- Append-only access logs record actor, tenant, reason, record ID, fields/classes accessed, and time, but no raw PII.
- Alert on bulk reads, repeated denials, cross-tenant attempts, unusual exports, and high-volume supplier access.
- Maintain a data-loss-prevention strategy, dependency/security patch process, vulnerability response process, and incident-response runbook with merchant/Shopify notification paths.
- Perform periodic access review and immediately revoke access on role termination or supplier reassignment.

These controls align with Shopify's Level 1 and Level 2 requirements, including minimization, transparency, purpose limitation, retention, encryption, encrypted backups, environment separation, DLP, staff access limits, access logging, and incident response.

## Retention and deletion

The following are conservative engineering defaults subject to legal review before production:

| Data | Default retention | End action |
|---|---|---|
| Raw webhook/API payload | Do not persist. If a durable encrypted retry envelope is unavoidable, retain no more than 24 hours. | Secure delete; preserve only a redacted event/audit ID. |
| Name and shipping address | Until delivery/cancellation plus 30 days for operational exceptions. | Field-level redact/delete; keep only non-identifying status and financial/accounting references where legally justified. |
| Phone/email when conditionally approved | Until delivery/cancellation plus 7 days. | Field-level redact/delete. |
| Supplier disclosure copy | No longer than Collective's corresponding field retention, contractually enforced. | Supplier deletion confirmation/audit. |
| Redacted policy/mutation audit | Defined security/accountability period, proposed 24 months. | Delete or aggregate; must contain no raw PII. |

Legal requirements can justify a documented exception, but the exception must be field-specific, tenant-specific, time-bounded, access-restricted, and recorded. It must not become a blanket retention rule.

## Privacy and deletion requests

Before App Store publication, implement, HMAC-verify, test, and configure Shopify's mandatory compliance webhooks:

- `customers/data_request`: locate and export the customer's protected data for the merchant;
- `customers/redact`: delete or irreversibly redact the referenced customer/order data unless a documented legal retention duty applies;
- `shop/redact`: delete or irreversibly redact the uninstalled shop's data, tenant keys, supplier access, queued work, caches, and exports.

Shopify requires actions on compliance webhooks to be completed within 30 days. The current repository does not yet declare these compliance topics; that is a production/App Store readiness blocker, not a scope to add in this audit. No webhook configuration is deployed by this task.

Also provide merchant-facing export/delete controls for Network Orders where appropriate, and cascade deletions through database replicas, search indexes, queues, object storage, caches, analytics systems, and suppliers. Backups should expire by policy and prevent normal application restoration of redacted records.

## Protected-data approval plan (later, not now)

After an owner-approved distribution decision and before production merchant use:

1. Finalize the exact GraphQL fields and supplier/carrier requirements.
2. Implement all controls in this document plus mandatory compliance webhook handlers.
3. Test redaction behavior, field omission, cross-tenant denial, access logs, retention jobs, backups, and incident response.
4. Prepare a public privacy policy and merchant disclosure that names each data class, purpose, processor category, retention period, and deletion path.
5. Request protected customer data (Level 1) plus only `name` and `address` fields (Level 2) in the Shopify Dev/Partner Dashboard.
6. Request phone and/or email only if evidence proves they are necessary; otherwise leave them unrequested.
7. Document screenshots/test evidence for Shopify's data protection review.
8. Make production features fail closed when Shopify redacts an unapproved field.

OAuth scope approval must not be treated as evidence that protected fields are approved. The policy gateway must check both current granted scopes and Collective's field-approval configuration before fetching or disclosing data.

## Incident response minimum

1. Contain affected tenant(s), revoke credentials, and stop related queues/mutations.
2. Preserve redacted security evidence without spreading PII.
3. Determine fields, merchants, customers, suppliers, systems, and time window affected.
4. Rotate relevant access tokens/keys and repair the tenant-boundary or authorization fault.
5. Notify the security/privacy owner and follow contractual, Shopify, and legal notification duties.
6. Document root cause, corrective action, validation, and follow-up controls.

AI systems must never receive raw protected customer data unless a future narrowly scoped, separately reviewed purpose proves it unavoidable. Confidence scores cannot override protected-data or tenant controls.

## Official Shopify sources

- [Work with protected customer data](https://shopify.dev/docs/apps/launch/protected-customer-data)
- [Shopify API access scopes and protected-data permissions](https://shopify.dev/docs/api/usage/access-scopes)
- [Order fields, scope, and 60-day window](https://shopify.dev/docs/api/admin-graphql/latest/objects/Order)
- [Fulfillment Service data model](https://shopify.dev/docs/apps/build/orders-fulfillment/fulfillment-service-apps)
- [Privacy law compliance and mandatory webhooks](https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance)
- [Manage required and optional scopes](https://shopify.dev/docs/apps/build/authentication-authorization/app-installation/manage-access-scopes)
