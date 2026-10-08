import { CatalogPagination } from "../components/collective/catalog-pagination";
import { FavoritesView } from "../features/favorites/favorites-view";
import { useLoaderData } from "react-router";
import {
  authenticatedRetailerLoader,
  authenticatedWorkspaceAction,
} from "../services/authenticated-app-loader.server";

export { authenticatedRetailerLoader as loader };
export { authenticatedWorkspaceAction as action };

export default function FavoritesRoute() {
  const loaderData = useLoaderData<typeof authenticatedRetailerLoader>();

  return (
    <>
    <CatalogPagination page={loaderData.catalogPage} />
    <FavoritesView
      initialFavoriteIds={loaderData.favoriteProductIds}
      initialImportedIds={loaderData.importedProductIds}
      catalog={loaderData.catalog}
      tenant={loaderData.tenant}
    />
    <CatalogPagination page={loaderData.catalogPage} />
    </>
  );
}
