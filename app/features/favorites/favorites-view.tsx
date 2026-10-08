import { useMemo, useState } from "react";
import { useFetcher, useLocation } from "react-router";

import { EmptyState, FoundationNotice, PageHeader } from "../../components/collective/foundation";
import { ProductCard } from "../../components/collective/product-card";
import { createPhaseOneFixtureState } from "../../services/merchandising/fixtures";
import { createRecommendationProvider } from "../../services/merchandising/rule-based-provider";
import type { CatalogProduct, TenantContext } from "../../services/merchandising/types";

export function FavoritesView({
  initialFavoriteIds = [],
  initialImportedIds = [],
  catalog,
  tenant,
}: {
  initialFavoriteIds?: string[];
  initialImportedIds?: string[];
  catalog?: CatalogProduct[];
  tenant?: TenantContext;
}) {
  const fixture = useMemo(() => createPhaseOneFixtureState(), []);
  const resolvedCatalog = catalog ?? fixture.catalog;
  const resolvedTenant = tenant ?? fixture.tenant;
  const provider = useMemo(() => createRecommendationProvider(), []);
  const [favoriteIds, setFavoriteIds] = useState(initialFavoriteIds);
  const [stagedIds, setStagedIds] = useState(initialImportedIds);
  const fetcher = useFetcher();
  const location = useLocation();

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

  const products = useMemo(
    () =>
      provider
        .recommend({
          tenant: resolvedTenant,
          products: resolvedCatalog.filter((product) => favoriteIds.includes(product.id)),
          affinity: { ...fixture.affinity, favoriteProductIds: favoriteIds },
          sort: "RECOMMENDED",
        })
        .products,
    [favoriteIds, fixture.affinity, provider, resolvedCatalog, resolvedTenant],
  );

  return (
    <main className="collective-page">
      <PageHeader
        eyebrow="Retailer shortlist"
        title="Favorites"
        description="A quiet place to collect products before building a deliberate assortment."
      />
      <FoundationNotice>
        Favorites and Import List selections are saved to this retailer workspace. Product creation still requires an explicit DRAFT action in Import Lists.
      </FoundationNotice>

      {products.length ? (
        <section className="collective-product-grid collective-product-grid-favorites">
          {products.map((rankedProduct) => (
            <ProductCard
              key={rankedProduct.product.id}
              rankedProduct={rankedProduct}
              favorite
              staged={stagedIds.includes(rankedProduct.product.id)}
              onToggleFavorite={() =>
                (() => {
                  setFavoriteIds((current) =>
                    current.filter((id) => id !== rankedProduct.product.id),
                  );
                  persistWorkspaceChange("favorite", rankedProduct.product.id, false);
                })()
              }
              onToggleImportList={() =>
                (() => {
                  const selected = !stagedIds.includes(rankedProduct.product.id);
                  setStagedIds((current) =>
                    selected
                      ? [...current, rankedProduct.product.id]
                      : current.filter((id) => id !== rankedProduct.product.id),
                  );
                  persistWorkspaceChange("import", rankedProduct.product.id, selected);
                })()
              }
            />
          ))}
        </section>
      ) : (
        <EmptyState
          eyebrow="Your private edit"
          title="Save only what earns a second look."
          description="Favorite products in Discover to build a focused shortlist. Nothing is imported or pushed to Shopify."
          actionLabel="Discover products"
          actionHref="/app/discover"
        />
      )}
    </main>
  );
}
