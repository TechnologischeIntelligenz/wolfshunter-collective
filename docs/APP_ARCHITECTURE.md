# WOLFSHUNTER COLLECTIVE app architecture

## Product decision

WOLFSHUNTER COLLECTIVE is primarily a retailer app. The olive-green retailer
workspace stays the main product surface:

`Discover → Favorites → Import List → explicit approval → Shopify DRAFT`

The app never publishes a product automatically. A retailer owns the final
review and publication decision in Shopify Admin.

## Fixed surface and shop boundary

The public WOLFSHUNTER storefront moved from `www.worldshopstore.org` to
`www.wolfshunter.com`. The custom storefront hostname is not the canonical
Shopify app identity; OAuth and stored tenant records must use the shop identity
returned by Shopify.

| Surface | Canonical home | Authentication boundary |
| --- | --- | --- |
| WOLFSHUNTER storefront | `https://www.wolfshunter.com` | Public Shopify storefront; formerly `www.worldshopstore.org` |
| WOLFSHUNTER operator/admin | Embedded app in the Shopify Admin of `3ddd6b-2.myshopify.com` | Shopify admin session plus the server-side WOLFSHUNTER allowlist |
| Retailer | Current Collective app in `wolfshunter-ai-dev.myshopify.com` | Retailer-scoped Shopify session |
| Supplier | Separate Supplier Shopify app at `https://supplier.collective.wolfshunter.com` | Separate Shopify Partner app/client ID and supplier-scoped session |

`www.wolfshunter.com` remains the customer-facing storefront. Operator controls
must not be exposed as a public route on that hostname. The existing
`/app/admin` route belongs inside the authenticated Shopify Admin app context
for the WOLFSHUNTER production store.

The canonical integration identity is `3ddd6b-2.myshopify.com`, the technical
domain Shopify assigned before a custom domain was connected. Persist and
validate the shop value returned by Shopify OAuth against this identity.
`worldshoponlinestore.myshopify.com` is an additional/renamed Shopify domain
from the earlier branding and must not replace the canonical tenant key.

## Two external roles, one operator boundary

Every connected merchant is treated as exactly one commercial role:

- **Retailer**: discovers supplier products and imports approved products into
  the retailer's Shopify store as DRAFTs.
- **Supplier**: maintains an eligible catalog, wholesale rules, media, and
  inventory for the Collective network.

The app operator/admin is not a merchant role. Admin access is an explicit
server-side `APP_ADMIN_EMAILS` / `APP_ADMIN_SHOPS` allowlist layered on the
authenticated Shopify Admin session for the WOLFSHUNTER production store.
Retailer and supplier sessions never become operator sessions merely because
they can reach the same application host.

## Deployment boundary

The current Shopify app configuration serves the retailer/admin application.
`APP_ROLE=retailer` is the safe default; the WOLFSHUNTER production shop gains
operator behavior only through its explicit server-side admin allowlist. The
supplier surface is prepared in `shopify.app.supplier.toml`, but it needs a
second Shopify Partner app/client ID and its own production hostname before it
can be deployed.

This separation prevents supplier permissions, retailer product writes, and
operator controls from being mixed in one OAuth client or dashboard.

## Shared platform boundary

The future platform layer can be shared, but every record must carry its
tenant and role boundary. The minimum canonical objects are:

- supplier catalog product and variant;
- retailer catalog mapping and import approval;
- supplier price list and retailer margin policy;
- inventory snapshot with source and freshness;
- order/fulfillment events only after protected-data approval;
- audit and webhook delivery history.

AI may propose catalog text, mappings, diagnostics, and evidence-based risk
flags. It must not bypass tenant checks, Shopify authentication, retailer
approval, publication policy, human dispute review, or an appeal path. A
documented partner breach may trigger only the least-invasive reversible
protection permitted by a pre-approved policy; it may never be inferred from
protected characteristics or a black-box score.
