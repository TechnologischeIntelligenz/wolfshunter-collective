import { DiscoverView } from "../features/discover/discover-view";
import { useLoaderData } from "react-router";
import {
  authenticatedRetailerLoader,
  authenticatedWorkspaceAction,
} from "../services/authenticated-app-loader.server";

export { authenticatedRetailerLoader as loader };
export { authenticatedWorkspaceAction as action };

export default function DiscoverRoute() {
  const loaderData = useLoaderData<typeof authenticatedRetailerLoader>();

  return (
    <DiscoverView
      serverPage={loaderData.catalogPage}
      initialFavoriteIds={loaderData.favoriteProductIds}
      initialImportedIds={loaderData.importedProductIds}
      catalog={loaderData.catalog}
      tenant={loaderData.tenant}
      catalogSource={loaderData.catalogSource}
      catalogSyncedAt={loaderData.catalogSyncedAt}
      catalogError={loaderData.catalogError}
      targetMarginPercent={loaderData.retailerSettings.marginPercent}
    />
  );
}
