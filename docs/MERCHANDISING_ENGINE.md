# WOLFSHUNTER COLLECTIVE merchandising engine

Status: Phase 1 deterministic foundation; fixture data only  
Reviewed: 2026-08-12 against current official Shopify documentation

## Purpose

Collective ranks supplier-catalog products for a specific retailer tenant before any product is imported into Shopify. The engine answers a merchandising question:

> Which eligible supplier products best fit this retailer's market, delivery promise, economics, inventory position, catalog standards, and recorded preferences?

It does not predict popularity and does not create, update, publish, or fulfill anything. A recommendation is a transparent proposal, never mutation authority.

## Phase 1 provider architecture

`RecommendationProvider` is the stable boundary for recommendation sources:

```text
RecommendationProvider
├── RULE_BASED            implemented in Phase 1
├── SHOPIFY_SUPPORTED     future complementary signal
├── LOCAL_MODEL           future optional, proposal-only
└── OPTIONAL_EXTERNAL_AI  future opt-in, proposal-only
```

The Phase 1 provider is `RuleBasedRecommendationProvider`. It requires a `TenantContext`, catalog records stamped with the same `tenantId`, explicit retailer-affinity signals, a bucket, and a sort order. A tenant mismatch throws and fails closed.

No OpenAI API, paid AI service, API key, randomized rank, or recurring AI cost is used.

## Deterministic score

The score is a maximum of 100 points. Every component is derived from stored input fields and can be shown to the merchant.

| Dimension | Maximum | Inputs |
|---|---:|---|
| Market fit | 20 | Retailer destination country, ship-from country, approved warehouse compatibility |
| Delivery | 18 | Estimated delivery days, dispatch days |
| Economics | 22 | Derived gross-margin amount and percentage from wholesale and recommended retail prices |
| Inventory | 16 | Available-to-sell stock, stock-confidence signal |
| Catalog quality | 16 | Primary image, variant completeness, category, mapping quality, data completeness |
| Retailer affinity | 5 | Preferred categories and, later, tenant-recorded favorites, imports, and actual ordered categories |
| Recency | 3 | Product creation date within a strict 30-day window relative to the scoring timestamp |

The score is stable for identical inputs. Ties are resolved by stable product ID ordering. Scores must be recomputed when a relevant source value or scoring-policy version changes.

### Economics

Potential gross margin is descriptive, not a guarantee:

```text
gross margin amount = recommended retail - wholesale price
gross margin %      = gross margin amount / recommended retail
```

Future landed-cost logic must include shipping, duties, taxes, payment fees, returns allowance, subscription rules, and negotiated supplier costs before the value can be treated as a commercial decision.

### Inventory

Low ATS or low source confidence reduces rank. A future inventory source must include freshness and provenance. Missing, stale, conflicting, or tenant-mismatched stock must block inventory-dependent actions rather than merely reduce a score.

### Recency

“New arrival” is permitted only when a stored product creation/onboarding timestamp falls within the configured new-arrival window. Editing a product does not make it new. There are no “Best Seller,” “Trending,” “Popular,” or “Hot” labels without actual, tenant-appropriate recorded evidence.

## Recommendation buckets

| Bucket | Deterministic eligibility |
|---|---|
| Recommended for your store | Overall score meets the published threshold. |
| Fast shipping to your market | Delivery estimate is seven days or less and country/approved-warehouse compatibility is present. |
| High margin | Derived margin is at least 35% and at least 20 currency units. |
| New arrivals | Genuinely created/onboarded within the last 30 days. |
| Premium selection | Supplier selection is premium/exclusive and data completeness meets the quality floor. |

Bucket membership and sort order are separate. Merchants can sort any resulting set by:

- Recommended
- Highest margin
- Fastest delivery
- Highest stock
- Newest
- Lowest wholesale price

## Retailer affinity

Affinity signals are always tenant-scoped. Phase 1 defines the inputs but uses fixture favorites only. Future signals can include:

- favorites created by users of the same retailer tenant;
- products deliberately staged or imported by that tenant;
- explicitly selected retailer categories;
- actual mapped order lines for that tenant.

Cross-retailer behavior, customer identity, private order data, or pooled merchant behavior must not be used unless a separately reviewed, privacy-preserving aggregate is proven legitimate. Store A must never influence Store B through identifiable records or leaked preferences.

## Product presentation normalization

Collective normalizes only its catalog UI. It never modifies an original Shopify or supplier image in Phase 1.

Implemented presentation rules:

- fixed 4:5 product-card image stage;
- consistent neutral background;
- responsive `object-fit: cover` presentation without altering the source asset;
- lazy loading and asynchronous decoding;
- skeleton state while a remote fixture loads;
- typographic fallback when an image is absent or fails;
- image-count badge;
- compact variant-image previews where fixture/source data supplies them;
- stable card geometry across mixed supplier photography.

Prepared future inputs include image availability, image count, variant completeness, data completeness, and mapping quality. Later non-mutating analysis may add image-quality scoring, background-consistency checks, duplicate detection, and optional local enhancement proposals. Original assets remain unchanged unless a merchant separately approves an explicit media workflow.

## How Shopify `productRecommendations` may complement Collective

Shopify's current Storefront API `productRecommendations` query returns up to ten products for a specific product ID or handle. It accepts two intents:

- `RELATED`: Shopify auto-generates related recommendations using signals such as sales data, product descriptions, and collection relationships.
- `COMPLEMENTARY`: complementary products must be configured through Shopify Search & Discovery.

Shopify also exposes the online-store Ajax Product Recommendations API and Liquid `recommendations` object for theme product-recommendation sections. Its response URLs contain tracking parameters for Shopify recommendation-conversion reporting.

This is a storefront, product-to-product recommendation surface for products that already belong to and, for Ajax use, are published in a merchant's Shopify catalog. It is not a supplier-catalog sourcing or pre-import ranking API.

### Appropriate future use

After a Collective product has been imported and deliberately published, a future `SHOPIFY_SUPPORTED` adapter may use Shopify recommendations as one optional signal for:

- showing related products already present in the retailer's store;
- suggesting store-catalog cross-sells around a selected imported product;
- comparing Collective's product similarity with Shopify's storefront relationships;
- preserving Shopify's provided tracking URLs in a storefront integration.

It must not:

- rank unimported supplier products as though Shopify evaluated them;
- replace Collective's market, delivery, inventory, quality, mapping, or margin checks;
- label a supplier product popular or trending;
- silently publish products to make the API usable;
- leak one retailer's Shopify recommendations into another retailer tenant.

Collective therefore remains the source of truth for supplier-catalog merchandising. Shopify recommendations can later complement post-import, within-store presentation.

## AI-ready safety boundary

Future model-backed providers may help with category suggestions, title cleanup, description drafts, SEO suggestions, color normalization, similarity, and retailer recommendations. Their output must use the same proposal contract and include:

- tenant and shop context;
- source product and input versions;
- provider and model/version identity;
- proposed values or ranking;
- confidence and explanation;
- validation result;
- expiry/freshness timestamp.

AI or Sidekick integration never gains a raw Shopify mutation client. Any accepted proposal must pass the existing Collective policy flow:

```text
PROPOSAL
→ POLICY CHECK
→ TENANT CHECK
→ ENTITLEMENT CHECK
→ SCOPE CHECK
→ MAPPING CHECK
→ VALIDATION
→ DRY RUN / PREVIEW
→ REQUIRED HUMAN APPROVAL
→ IDEMPOTENT MUTATION
→ VERIFY
→ AUDIT
```

Phase 1 contains no mutation stage.

## Shopify AI tooling distinction

The Shopify AI Toolkit is development tooling for coding agents: documentation/schema retrieval, code validation, and supported Shopify CLI tasks under developer control. It is not a runtime recommendation API for Collective.

Shopify documents Sidekick as Shopify's built-in merchant assistant and provides Sidekick app extensions for safely exposing app data and scoped actions while merchants remain in control. That extension surface does not turn Shopify Magic or Sidekick into an unrestricted public runtime model API for supplier-catalog ranking. No Magic or Sidekick runtime dependency is used in Phase 1.

## Files

- `app/services/merchandising/types.ts` — tenant, product, score, bucket, sort, and provider contracts.
- `app/services/merchandising/rule-based-provider.ts` — deterministic scoring, bucketing, sorting, and fail-closed tenant check.
- `app/services/merchandising/fixtures.ts` — local fixture factory with an explicit tenant/shop context.
- `app/services/merchandising/rule-based-provider.test.ts` — deterministic, tenant-boundary, bucket, margin, and sorting tests.

## Official Shopify sources

- [Shopify AI Toolkit](https://shopify.dev/docs/apps/build/ai-toolkit)
- [Storefront API `productRecommendations`](https://shopify.dev/docs/api/storefront/latest/queries/productRecommendations)
- [Recommendation intents and tracking](https://shopify.dev/docs/storefronts/themes/product-merchandising/recommendations)
- [Ajax Product Recommendations API](https://shopify.dev/docs/api/ajax/reference/product-recommendations)
- [Liquid `recommendations` object](https://shopify.dev/docs/api/liquid/objects/recommendations)
- [Sidekick app extensions](https://shopify.dev/docs/apps/build/sidekick/index)
