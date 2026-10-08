import { CatalogPagination } from "../../components/collective/catalog-pagination";
import type { CatalogPage } from "../../services/catalog-page";
import { useMemo, useState } from "react";
import { useFetcher, useLocation, useSearchParams } from "react-router";

import { FoundationNotice, PageHeader } from "../../components/collective/foundation";
import { ProductCard } from "../../components/collective/product-card";
import { ProductImageStage } from "../../components/collective/product-image-stage";
import { createPhaseOneFixtureState } from "../../services/merchandising/fixtures";
import { createRecommendationProvider } from "../../services/merchandising/rule-based-provider";
import {
  RECOMMENDATION_BUCKET_LABELS,
  type CatalogProduct,
  type CatalogSort,
  type RankedProduct,
  type RecommendationBucket,
  type TenantContext,
} from "../../services/merchandising/types";

const sortLabels: Record<CatalogSort, string> = {
  RECOMMENDED: "Recommended",
  HIGHEST_MARGIN: "Highest margin",
  FASTEST_DELIVERY: "Fastest delivery",
  HIGHEST_STOCK: "Highest stock",
  NEWEST: "Newest",
  LOWEST_WHOLESALE_PRICE: "Lowest wholesale price",
};

const bucketOrder: RecommendationBucket[] = [
  "RECOMMENDED_FOR_STORE",
  "FAST_SHIPPING",
  "HIGH_MARGIN",
  "NEW_ARRIVALS",
  "PREMIUM_SELECTION",
];

type CatalogBucket = RecommendationBucket | "ALL_PRODUCTS";
const ALL_COLLECTIONS = "ALL_COLLECTIONS";

export function DiscoverView({
  serverPage,
  compact = false,
  initialFavoriteIds = [],
  initialImportedIds = [],
  catalog,
  tenant,
  catalogSource = "fallback",
  catalogSyncedAt,
  catalogError = null,
  targetMarginPercent = 40,
}: {
  serverPage?: CatalogPage | null;
  compact?: boolean;
  initialFavoriteIds?: string[];
  initialImportedIds?: string[];
  catalog?: CatalogProduct[];
  tenant?: TenantContext;
  catalogSource?: "shopify" | "fallback";
  catalogSyncedAt?: string;
  catalogError?: string | null;
  targetMarginPercent?: number;
}) {
  const fallbackFixture = useMemo(() => createPhaseOneFixtureState(), []);
  const resolvedCatalog = catalog ?? fallbackFixture.catalog;
  const resolvedTenant = tenant ?? fallbackFixture.tenant;
  const provider = useMemo(() => createRecommendationProvider(), []);
  const [localSort, setLocalSort] = useState<CatalogSort>("RECOMMENDED");
  const [localBucket, setLocalBucket] = useState<CatalogBucket>("ALL_PRODUCTS");
  const [localCollection, setLocalCollection] = useState(ALL_COLLECTIONS);
  const [search, setSearch] = useState(serverPage?.search ?? "");
  const [favoriteIds, setFavoriteIds] = useState(initialFavoriteIds);
  const [stagedIds, setStagedIds] = useState(initialImportedIds);
  const [selectedProduct, setSelectedProduct] = useState<RankedProduct | null>(null);
  const fetcher = useFetcher();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const navigateFilter = (name: string, value: string) => {
    const next = new URLSearchParams(params); next.set(name, value); next.set("page", "1");
    setParams(next, { preventScrollReset: true });
  };
  const sort = (serverPage?.sort ?? localSort) as CatalogSort;
  const bucket = (serverPage?.bucket ?? localBucket) as CatalogBucket;
  const collectionId = serverPage?.collection ?? localCollection;
  const setSort = (value: CatalogSort) => serverPage ? navigateFilter("sort", value) : setLocalSort(value);
  const setBucket = (value: CatalogBucket) => serverPage ? navigateFilter("bucket", value) : setLocalBucket(value);
  const setCollectionId = (value: string) => serverPage ? navigateFilter("collection", value) : setLocalCollection(value);

  const persistWorkspaceChange = (
    intent: "favorite" | "import",
    productId: string,
    selected: boolean,
  ) => {
    fetcher.submit(
      { intent, productId, selected: String(selected) },
      {
        method: "post",
        action: `${location.pathname}${location.search}`,
      },
    );
  };

  const affinity = useMemo(
    () => ({ ...fallbackFixture.affinity, favoriteProductIds: favoriteIds }),
    [favoriteIds, fallbackFixture.affinity],
  );

  const collectionOptions = useMemo(() => {
    if (serverPage) return serverPage.collections;
    const options = new Map<
      string,
      { id: string; title: string; handle: string; count: number }
    >();

    for (const product of resolvedCatalog) {
      for (const collection of product.collections) {
        const current = options.get(collection.id);
        options.set(collection.id, {
          ...collection,
          count: (current?.count ?? 0) + 1,
        });
      }
    }

    return [...options.values()].sort((left, right) =>
      left.title.localeCompare(right.title),
    );
  }, [resolvedCatalog, serverPage]);

  const selectedCollection = collectionOptions.find(
    (collection) => collection.id === collectionId,
  );

  const collectionFilteredCatalog = useMemo(() => {
    if (serverPage || collectionId === ALL_COLLECTIONS) return resolvedCatalog;
    return resolvedCatalog.filter((product) =>
      product.collections.some((collection) => collection.id === collectionId),
    );
  }, [collectionId, resolvedCatalog, serverPage]);

  const searchedCatalog = useMemo(() => {
    if (serverPage) return resolvedCatalog;
    const query = search.trim().toLowerCase();
    if (!query) return collectionFilteredCatalog;
    return collectionFilteredCatalog.filter((product) =>
      `${product.title} ${product.category} ${product.collections
        .map((collection) => collection.title)
        .join(" ")}`.toLowerCase().includes(query),
    );
  }, [collectionFilteredCatalog, search, serverPage, resolvedCatalog]);

  const recommendations = useMemo(
    () =>
      provider.recommend({
        tenant: resolvedTenant,
        products: searchedCatalog,
        affinity,
        bucket: bucket === "ALL_PRODUCTS" ? undefined : bucket,
        sort,
      }),
    [affinity, bucket, provider, resolvedTenant, searchedCatalog, sort],
  );

  const bucketCounts = useMemo(
    () =>
      serverPage ? serverPage.bucketCounts : Object.fromEntries(
        bucketOrder.map((candidate) => [
          candidate,
          provider.recommend({
            tenant: resolvedTenant,
            products: resolvedCatalog,
            affinity,
            bucket: candidate,
            sort: "RECOMMENDED",
          }).products.length,
        ]),
      ) as Record<RecommendationBucket, number>,
    [affinity, provider, resolvedCatalog, resolvedTenant, serverPage],
  );

  const toggleFavorite = (id: string) => {
    const selected = !favoriteIds.includes(id);
    setFavoriteIds((current) =>
      selected
        ? [...current, id]
        : current.filter((candidate) => candidate !== id),
    );
    persistWorkspaceChange("favorite", id, selected);
  };

  const toggleImportList = (id: string) => {
    const selected = !stagedIds.includes(id);
    setStagedIds((current) =>
      selected
        ? [...current, id]
        : current.filter((candidate) => candidate !== id),
    );
    persistWorkspaceChange("import", id, selected);
  };

  return (
    <main className={`collective-page ${compact ? "collective-page-compact" : ""}`}>
      <PageHeader
        eyebrow="Curated supplier catalog"
        title="Discover products worth carrying."
        description="Transparent economics, delivery context, and evidence-based merchandising signals before anything reaches your store."
        actions={
          <div className="collective-header-statuses">
            <div className={`collective-live-badge ${catalogSource === "shopify" ? "is-live" : "is-fallback"}`}>
              <span aria-hidden="true" />
              <div>
                <small>Catalog source</small>
                <strong>{catalogSource === "shopify" ? "Shopify catalog" : "Safe preview"}</strong>
              </div>
            </div>
            <div className="collective-list-counter" aria-live="polite">
              <small>Import list</small>
              <strong>{stagedIds.length} staged</strong>
            </div>
          </div>
        }
      />

      <FoundationNotice>
        {catalogSource === "shopify"
          ? `Products and thumbnails are synchronized from the approved WOLFSHUNTER catalog. Target retail prices use your ${targetMarginPercent}% margin setting.`
          : catalogError ?? "Safe catalog preview is active while the Shopify source reconnects."}{" "}
        Shopify writes happen only through an explicit DRAFT action in Import Lists.
      </FoundationNotice>

      <section className="collective-catalog-toolbar" aria-label="Catalog controls">
        <label className="collective-catalog-search">
          <span>Search live catalog</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter" && serverPage) navigateFilter("q", search); }}
            placeholder="Product or collection"
          />
          {serverPage ? <button type="button" className="collective-button collective-button-secondary" onClick={() => navigateFilter("q", search)}>Search all products</button> : null}
        </label>
        <div className="collective-bucket-tabs" role="tablist" aria-label="Recommendation buckets">
          <button
            type="button"
            role="tab"
            aria-selected={bucket === "ALL_PRODUCTS"}
            className={bucket === "ALL_PRODUCTS" ? "is-active" : ""}
            onClick={() => setBucket("ALL_PRODUCTS")}
          >
            <span>All products</span>
            <small>{serverPage?.total ?? resolvedCatalog.length}</small>
          </button>
          {bucketOrder.map((candidate) => (
            <button
              key={candidate}
              type="button"
              role="tab"
              aria-selected={bucket === candidate}
              className={bucket === candidate ? "is-active" : ""}
              onClick={() => setBucket(candidate)}
            >
              <span>{RECOMMENDATION_BUCKET_LABELS[candidate]}</span>
              <small>{bucketCounts[candidate]}</small>
            </button>
          ))}
        </div>
        <div className="collective-catalog-selectors">
          <label className="collective-filter-control">
            <span>Collection</span>
            <select
              value={collectionId}
              onChange={(event) => setCollectionId(event.target.value)}
              disabled={!collectionOptions.length}
            >
              <option value={ALL_COLLECTIONS}>All collections</option>
              {collectionOptions.map((collection) => (
                <option key={collection.id} value={collection.id}>
                  {collection.title} ({collection.count})
                </option>
              ))}
            </select>
          </label>
          <label className="collective-sort-control">
            <span>Sort</span>
            <select value={sort} onChange={(event) => setSort(event.target.value as CatalogSort)}>
              {Object.entries(sortLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <div className="collective-catalog-meta">
        <span>
          Collection: {selectedCollection ? selectedCollection.title : "All collections"}
        </span>
        <span>
          {serverPage?.filteredTotal ?? recommendations.products.length} of {serverPage?.total ?? resolvedCatalog.length} products · {sortLabels[sort]}
        </span>
        <span>
          {catalogSource === "shopify" ? "Live sync" : "Preview"}
          {catalogSyncedAt ? ` · ${new Date(catalogSyncedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}
        </span>
      </div>

      {serverPage ? <CatalogPagination page={serverPage} /> : null}
      {recommendations.products.length ? (
        <section className="collective-product-grid" aria-label="Catalog products">
          {recommendations.products.map((rankedProduct) => (
            <ProductCard
              key={rankedProduct.product.id}
              rankedProduct={rankedProduct}
              favorite={favoriteIds.includes(rankedProduct.product.id)}
              staged={stagedIds.includes(rankedProduct.product.id)}
              onToggleFavorite={() => toggleFavorite(rankedProduct.product.id)}
              onToggleImportList={() => toggleImportList(rankedProduct.product.id)}
              onViewDetails={() => setSelectedProduct(rankedProduct)}
            />
          ))}
        </section>
      ) : (
        <div className="collective-inline-empty">
          <strong>No catalog products meet this rule.</strong>
          <span>Clear the search or select All products.</span>
        </div>
      )}

      {serverPage ? <CatalogPagination page={serverPage} /> : null}
      {selectedProduct ? (
        <div className="collective-detail-backdrop" role="presentation">
          <section
            className="collective-product-detail"
            role="dialog"
            aria-modal="true"
            aria-labelledby="collective-product-detail-title"
          >
            <button
              type="button"
              className="collective-detail-close"
              onClick={() => setSelectedProduct(null)}
              aria-label="Close product details"
            >
              ×
            </button>
            <ProductImageStage
              src={selectedProduct.product.imageUrl}
              alt={selectedProduct.product.title}
              imageCount={selectedProduct.product.imageCount}
              variantImageUrls={selectedProduct.product.variantImageUrls}
              eager
            />
            <div className="collective-detail-copy">
              <p className="collective-eyebrow">{selectedProduct.product.category}</p>
              <h2 id="collective-product-detail-title">
                {selectedProduct.product.title}
              </h2>
              <p>
                This product view exposes the exact evidence inputs. It never
                claims popularity, trending status, or sales performance without
                verified data.
              </p>
              <dl className="collective-score-breakdown">
                {Object.entries(selectedProduct.score.breakdown).map(([label, value]) => (
                  <div key={label}>
                    <dt>{label.replace(/([A-Z])/g, " $1")}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              <div className="collective-detail-reasons">
                {selectedProduct.score.reasons.map((reason) => (
                  <span key={reason}>{reason}</span>
                ))}
              </div>
              <p className="collective-detail-note">
                Imports are created as Shopify DRAFT products only after explicit review in Import Lists. Publication is never automatic.
              </p>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
