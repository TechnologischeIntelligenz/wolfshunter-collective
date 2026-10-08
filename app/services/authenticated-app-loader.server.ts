import { readSourceSyncState, type SourceSyncState } from "./source-sync.server";
import { readCatalogSnapshot } from "./catalog-snapshot.server";
import { catalogPage as paginateCatalog, catalogDisplayProducts, retailerCatalogPage, type CatalogPage } from "./catalog-page";
import { readSourceCommerce, type SourceCommerce } from "./source-commerce.server";
import { redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "react-router";

import { authenticate } from "../shopify.server";
import { getCatalogSourceShop, isAppAdminSession } from "./app-admin.server";
import { getAppRole, requireRetailerSession } from "./app-role.server";
import { createPhaseOneFixtureState } from "./merchandising/fixtures";
import {
  getRetailerWorkspace,
  updateRetailerWorkspace,
} from "./retailer-workspace.server";
import {
  getImportedProductPushes,
  getRetailerSettings,
} from "./retailer-commerce.server";
import {
  getReadOnlyDiagnostics,
  type ReadOnlyDiagnostics,
} from "./read-only-diagnostics.server";
import {
  getShopifyRetailerMetrics,
  type ShopifyRetailerMetrics,
} from "./shopify-retailer-metrics.server";
import {
  getShopifyCollectionOptions,
  type ShopifyCollectionOption,
} from "./shopify-collection-options.server";
import {

  type ShopifyAdminCatalog,
} from "./shopify-admin-catalog.server";
import { getRetailerCatalogSnapshot } from "./shopify-source-catalog.server";
import {
  getAdminSupportInsights,
  type AdminSupportInsights,
} from "./support-case.server";
import {
  getKnowledgeSyncSummary,
} from "./knowledge-sync.server";

export interface AuthenticatedAppLoaderData {
  authLink: string;
  sessionType: string;
  shop: string;
  favoriteProductIds: string[];
  importedProductIds: string[];
  catalog: ReturnType<typeof createPhaseOneFixtureState>["catalog"];
  tenant: ReturnType<typeof createPhaseOneFixtureState>["tenant"];
  catalogSource: "shopify" | "fallback";
  catalogSyncedAt: string;
  catalogError: string | null;
  catalogSourceProductCount: number;
  retailerSettings: Awaited<ReturnType<typeof getRetailerSettings>>;
  diagnostics: ReadOnlyDiagnostics;
  shopMetrics: ShopifyRetailerMetrics;
  collections: ShopifyCollectionOption[];
  collectiveImportDrafts: number;
  collectiveImportFailures: number;
  appRole: ReturnType<typeof getAppRole>;
  isAppAdmin: boolean;
  adminCatalog: ShopifyAdminCatalog | null;
  catalogPage: CatalogPage | null;
  sourceSyncState: SourceSyncState | null;
  sourceCommerce: SourceCommerce | null;
  supportInsights: AdminSupportInsights | null;
  knowledgeSummary: Awaited<ReturnType<typeof getKnowledgeSyncSummary>> | null;
}

export async function authenticatedAppLoader(
  { request }: LoaderFunctionArgs,
  options: { includeCollections?: boolean; requireRetailer?: boolean } = {},
) {
  const entryUrl = new URL(request.url);
  const { session, admin } = await authenticate.admin(request);
  const isAppAdmin = isAppAdminSession(session);
  if (options.requireRetailer) {
    if (isAppAdmin) throw redirect("/app");
    requireRetailerSession(session);
  }
  const fixture = createPhaseOneFixtureState(session.shop);
  const [workspace, retailerSettings] = await Promise.all([
    getRetailerWorkspace(session.shop),
    getRetailerSettings(session.shop),
  ]);
  const catalogPromise = isAppAdmin
    ? Promise.resolve({
        source: "fallback" as const,
        catalog: fixture.catalog,
        tenant: fixture.tenant,
        syncedAt: fixture.tenant.asOf,
        sourceProductCount: 0,
        error: null,
      })
    : getRetailerCatalogSnapshot(session.shop, retailerSettings);
  const [
    diagnostics,
    shopMetrics,
    pushes,
    adminCatalog,
    catalogSnapshot,
    collections,
    supportInsights,
    knowledgeSummary,
  ] = await Promise.all([
    getReadOnlyDiagnostics({ request, session, admin }),
    getShopifyRetailerMetrics(admin),
    getImportedProductPushes(session.shop),
    isAppAdmin ? readCatalogSnapshot(session.shop).then(snapshot => snapshot?.catalog ?? { source: "unavailable" as const, products: [], collections: [], error: "Synchronize the source catalog first." }) : Promise.resolve(null),
    catalogPromise,
    options.includeCollections
      ? getShopifyCollectionOptions(admin)
      : Promise.resolve([]),
    isAppAdmin ? getAdminSupportInsights() : Promise.resolve(null),
    isAppAdmin ? getKnowledgeSyncSummary(session.shop) : Promise.resolve(null),
  ]);


  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, "");
  const sourceShop = getCatalogSourceShop();
  const sourceCommerce = sourceShop && (path === "/app/settings" || path === "/app/admin")
    ? await readSourceCommerce(sourceShop) : null;
  let pageProducts = catalogSnapshot.catalog;
  if (path === "/app/favorites") pageProducts = pageProducts.filter(p => workspace.favoriteProductIds.includes(p.id));
  if (path === "/app/import-lists" || path === "/app/my-products") pageProducts = pageProducts.filter(p => workspace.importedProductIds.includes(p.id));
  const page = isAppAdmin && adminCatalog
    ? paginateCatalog(adminCatalog.products, url.searchParams)
    : retailerCatalogPage(pageProducts, catalogSnapshot.tenant, { favoriteProductIds: workspace.favoriteProductIds, importedProductIds: workspace.importedProductIds, orderedCategoryCounts: {} }, url.searchParams);
  const pagedAdminCatalog = adminCatalog ? { ...adminCatalog, products: page.products.map(product => {
    const safe = { ...product } as typeof product & { variants?: unknown[] };
    delete safe.variants;
    if ("descriptionHtml" in safe) safe.descriptionHtml = "";
    if ("images" in safe) safe.images = safe.images.slice(0, 4);
    return safe;
  }) as ShopifyAdminCatalog["products"] } : null;
  // Keep persisted affinity limited to products currently available in this
  // retailer's catalog boundary.
  const allowedProductIds = new Set(
    catalogSnapshot.catalog.map((product) => product.id),
  );

  return {
    authLink: `/auth/login?shop=${encodeURIComponent(session.shop)}`,
    sessionType: session.isOnline ? "Online session" : "Offline session",
    shop: session.shop,
    favoriteProductIds: workspace.favoriteProductIds.filter((id) => allowedProductIds.has(id)),
    importedProductIds: workspace.importedProductIds.filter((id) => allowedProductIds.has(id)),
    catalog: isAppAdmin ? [] : catalogDisplayProducts(page.products as AuthenticatedAppLoaderData["catalog"]),
    tenant: catalogSnapshot.tenant,
    catalogSource: catalogSnapshot.source,
    catalogSyncedAt: catalogSnapshot.syncedAt,
    catalogError: catalogSnapshot.error,
    catalogSourceProductCount: catalogSnapshot.sourceProductCount,
    retailerSettings,
    diagnostics,
    shopMetrics,
    collections,
    collectiveImportDrafts: pushes.filter((push) => push.status === "DRAFT_CREATED").length,
    collectiveImportFailures: pushes.filter((push) => push.status === "FAILED").length,
    appRole: getAppRole(),
    isAppAdmin,
    adminCatalog: pagedAdminCatalog,
    catalogPage: page.meta,
    sourceSyncState: isAppAdmin && sourceShop ? await readSourceSyncState(sourceShop) : null,
    sourceCommerce: sourceCommerce && !isAppAdmin ? { ...sourceCommerce, locations: [] } : sourceCommerce,
    supportInsights,
    knowledgeSummary,
  } satisfies AuthenticatedAppLoaderData;
}

export function authenticatedRetailerLoader(
  args: LoaderFunctionArgs,
  options: { includeCollections?: boolean } = {},
) {
  return authenticatedAppLoader(args, { ...options, requireRetailer: true });
}

export async function authenticatedWorkspaceAction({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  requireRetailerSession(session);
  const formData = await request.formData();
  const intent = formData.get("intent");
  const productId = formData.get("productId");
  const selected = formData.get("selected");

  if (
    (intent !== "favorite" && intent !== "import") ||
    typeof productId !== "string" ||
    (selected !== "true" && selected !== "false")
  ) {
    return new Response("Invalid workspace update", { status: 400 });
  }

  const settings = await getRetailerSettings(session.shop);
  const catalogSnapshot = await getRetailerCatalogSnapshot(session.shop, settings);
  const workspace = await updateRetailerWorkspace(session.shop, {
    intent,
    productId,
    selected: selected === "true",
    allowedProductIds: catalogSnapshot.catalog.map((product) => product.id),
  });

  return { ok: true, ...workspace };
}
