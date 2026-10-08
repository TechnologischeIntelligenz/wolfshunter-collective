import { readCatalogSnapshot } from "./catalog-snapshot.server.ts";
import { readSourceCommerce } from "./source-commerce.server.ts";
import { getCatalogSourceShop } from "./app-admin.server.ts";
import { createPhaseOneFixtureState } from "./merchandising/fixtures.ts";
import type {
  CatalogProduct,
  TenantContext,
} from "./merchandising/types";
import type { RetailerSettingsState } from "./retailer-commerce.server";
import {
  type ShopifyAdminCatalog,
  type ShopifyAdminProduct,
} from "./shopify-admin-catalog.server.ts";

export interface RetailerCatalogSnapshot {
  source: "shopify" | "fallback";
  catalog: CatalogProduct[];
  tenant: TenantContext;
  syncedAt: string;
  sourceProductCount: number;
  error: string | null;
}

interface CachedSourceCatalog {
  expiresAt: number;
  syncedAt: string;
  catalog: ShopifyAdminCatalog;
}

const sourceCatalogCache = new Map<string, CachedSourceCatalog>();

const cacheMilliseconds = () => {
  const seconds = Number(process.env.CATALOG_CACHE_SECONDS ?? "30");
  return Number.isFinite(seconds) && seconds >= 5
    ? Math.min(seconds, 300) * 1000
    : 30_000;
};

const roundMoney = (value: number) => Math.round(value * 100) / 100;

const normalizeCurrency = (value: string | undefined) =>
  /^[A-Z]{3}$/.test(value ?? "") ? (value as string) : "EUR";

const deriveSelection = (
  tags: string[],
): CatalogProduct["selection"] => {
  const normalized = tags.map((tag) => tag.trim().toLowerCase());
  if (normalized.some((tag) => tag === "exclusive" || tag === "collective:exclusive")) {
    return "exclusive";
  }
  if (normalized.some((tag) => tag === "premium" || tag === "collective:premium")) {
    return "premium";
  }
  return "standard";
};

export function mapShopifyProductToRetailerCatalog(
  product: ShopifyAdminProduct,
  input: {
    tenantId: string;
    settings: RetailerSettingsState;
    sourceCountry: string;
  },
): CatalogProduct | null {
  if (product.status !== "ACTIVE" || !product.priceRange) return null;

  const sourcePrice = Math.max(0, product.priceRange.minimum);
  const safeMargin = Math.min(95, Math.max(0, input.settings.marginPercent));
  const recommendedRetailPrice =
    safeMargin > 0
      ? roundMoney(sourcePrice / (1 - safeMargin / 100))
      : sourcePrice;
  const imageUrls = product.images.map((image) => image.url);
  const category = product.productType.trim() || "General";
  const completenessSignals = [
    Boolean(product.title.trim()),
    Boolean(category),
    imageUrls.length > 0,
    product.variantCount > 0,
    sourcePrice > 0,
  ];
  const completeness =
    completenessSignals.filter(Boolean).length / completenessSignals.length;

  return {
    id: product.id,
    tenantId: input.tenantId,
    title: product.title,
    category,
    descriptionHtml: product.descriptionHtml.trim() || null,
    collections: product.collections.map((collection) => ({
      id: collection.id,
      title: collection.title,
      handle: collection.handle,
    })),
    wholesalePrice: sourcePrice,
    recommendedRetailPrice,
    currency: normalizeCurrency(product.priceRange.currency),
    imageUrl: imageUrls[0] ?? null,
    imageUrls,
    imageCount: product.imageCount,
    variantImageUrls: imageUrls.slice(1, 4),
    variantCount: product.variantCount,
    warehouse: "Shopify fulfillment",
    shipFromCountry: "",
    estimatedDeliveryDays: null,
    dispatchDays: null,
    availableToSell: product.totalInventory,
    stockConfidence: 1,
    primaryImageAvailable: imageUrls.length > 0,
    variantCompleteness: product.variantCount > 0 ? 1 : 0,
    categoryAvailable: Boolean(product.productType.trim()),
    mappingQuality: completeness,
    dataCompleteness: completeness,
    selection: deriveSelection(product.tags),
    createdAt: product.createdAt,
  };
}

async function readSourceCatalog(sourceShop: string) {
  const cached = sourceCatalogCache.get(sourceShop);
  if (cached && cached.expiresAt > Date.now()) return cached;

  const snapshot = await readCatalogSnapshot(sourceShop);
  if (!snapshot) throw new Error("The source catalog must be synchronized first");
  const catalog = snapshot.catalog;
  const entry = {
    catalog,
    syncedAt: snapshot.syncedAt,
    expiresAt: Date.now() + cacheMilliseconds(),
  };

  if (catalog.source === "shopify") sourceCatalogCache.set(sourceShop, entry);
  return entry;
}

export async function getRetailerCatalogSnapshot(
  retailerShop: string,
  settings: RetailerSettingsState,
): Promise<RetailerCatalogSnapshot> {
  const fixture = createPhaseOneFixtureState(retailerShop);
  const tenant: TenantContext = {
    ...fixture.tenant,
    destinationCountry: settings.marketCountry,
    compatibleWarehouses: [settings.warehouse],
    asOf: new Date().toISOString(),
  };
  const sourceShop = getCatalogSourceShop();

  if (!sourceShop) {
    return {
      source: "fallback",
      catalog: [],
      tenant,
      syncedAt: tenant.asOf,
      sourceProductCount: 0,
      error: "Der Live-Katalogshop ist noch nicht konfiguriert.",
    };
  }

  try {
    const source = await readSourceCatalog(sourceShop);
    const commerce = await readSourceCommerce(sourceShop);
    const sourceCountry = (
      process.env.CATALOG_SOURCE_COUNTRY?.trim().toUpperCase() || "AT"
    ).slice(0, 2);
    const catalog = source.catalog.products
      .map((product) =>
        mapShopifyProductToRetailerCatalog(product, {
          tenantId: tenant.tenantId,
          settings,
          sourceCountry,
        }),
      )
      .filter((product): product is CatalogProduct => Boolean(product))
      .map(product => ({ ...product, warehouse: "Shopify fulfillment", shipFromCountry: "", estimatedDeliveryDays: null, dispatchDays: null, deliveryEstimateLabel: commerce?.processingLabel ?? "Delivery estimate at checkout" }));

    if (source.catalog.source !== "shopify" || !catalog.length) {
      return {
        source: "fallback",
        catalog: [],
        tenant,
        syncedAt: source.syncedAt,
        sourceProductCount: source.catalog.products.length,
        error:
          source.catalog.error ??
          "Im Hauptshop wurden noch keine aktiven, bepreisten Produkte gefunden.",
      };
    }

    return {
      source: "shopify",
      catalog,
      tenant,
      syncedAt: source.syncedAt,
      sourceProductCount: source.catalog.products.length,
      error: null,
    };
  } catch (error) {
    console.error("[source-catalog] Live catalog bridge failed", {
      name: error instanceof Error ? error.name : "unknown",
      message: error instanceof Error ? error.message.slice(0, 180) : "unknown",
    });
    return {
      source: "fallback",
      catalog: [],
      tenant,
      syncedAt: tenant.asOf,
      sourceProductCount: 0,
      error: "Der Live-Katalog ist momentan nicht erreichbar; bitte den Hauptkatalog synchronisieren.",
    };
  }
}

export function clearSourceCatalogCache() {
  sourceCatalogCache.clear();
}
