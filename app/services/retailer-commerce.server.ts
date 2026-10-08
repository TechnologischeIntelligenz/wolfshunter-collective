import { getCatalogSourceShop } from "./app-admin.server";
import { readSourceCommerce } from "./source-commerce.server";
import db from "../db.server";
import type { CatalogProduct } from "./merchandising/types";

export interface RetailerSettingsState {
  marketCountry: string;
  warehouse: string;
  marginPercent: number;
  requireApproval: boolean;
  autoPublish: boolean;
}

const DEFAULT_SETTINGS: RetailerSettingsState = {
  marketCountry: "AT",
  warehouse: "Shopify fulfillment",
  marginPercent: 40,
  requireApproval: true,
  autoPublish: false,
};

export async function getRetailerSettings(
  shop: string,
): Promise<RetailerSettingsState> {
  const settings = await db.retailerSettings.upsert({
    where: { shop },
    create: { shop },
    update: {},
  });

  return {
    marketCountry: settings.marketCountry,
    warehouse: ["Vienna Atelier", "Central Europe", "Northern Europe", "Eastern Europe"].includes(settings.warehouse) ? "Shopify fulfillment" : settings.warehouse,
    marginPercent: settings.marginPercent,
    requireApproval: settings.requireApproval,
    autoPublish: settings.autoPublish,
  };
}

export async function updateRetailerSettings(
  shop: string,
  input: Partial<RetailerSettingsState>,
) {
  const source = getCatalogSourceShop();
  const commerce = source ? await readSourceCommerce(source) : null;
  const current = await getRetailerSettings(shop);
  const next = {
    marketCountry: input.marketCountry ?? current.marketCountry,
    warehouse: input.warehouse ?? current.warehouse,
    marginPercent: input.marginPercent ?? current.marginPercent,
    requireApproval: input.requireApproval ?? current.requireApproval,
    // Automatic publication stays disabled until publication scopes and a
    // separate merchant approval flow exist.
    autoPublish: false,
  } satisfies RetailerSettingsState;

  if (
    !commerce?.eligibleCountries.some(c => c.code === next.marketCountry) ||
    next.warehouse !== "Shopify fulfillment" ||
    next.marketCountry.length !== 2 ||
    next.warehouse.length < 2 ||
    next.marginPercent < 0 ||
    next.marginPercent > 100
  ) {
    throw new Error("Invalid retailer settings");
  }

  await db.retailerSettings.upsert({
    where: { shop },
    create: { shop, ...next },
    update: next,
  });

  return next;
}

export interface ImportedProductPushState {
  id: number;
  sourceProductId: string;
  sourceTitle: string;
  sourceCategory: string;
  retailPrice: number;
  currency: string;
  status: string;
  shopifyProductId: string | null;
  shopifyVariantId: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

const toPushState = (push: {
  id: number;
  sourceProductId: string;
  sourceTitle: string;
  sourceCategory: string;
  retailPrice: number;
  currency: string;
  status: string;
  shopifyProductId: string | null;
  shopifyVariantId: string | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}): ImportedProductPushState => ({
  id: push.id,
  sourceProductId: push.sourceProductId,
  sourceTitle: push.sourceTitle,
  sourceCategory: push.sourceCategory,
  retailPrice: push.retailPrice,
  currency: push.currency,
  status: push.status,
  shopifyProductId: push.shopifyProductId,
  shopifyVariantId: push.shopifyVariantId,
  errorMessage: push.errorMessage,
  createdAt: push.createdAt.toISOString(),
  updatedAt: push.updatedAt.toISOString(),
});

export async function getImportedProductPushes(shop: string) {
  const pushes = await db.importedProductPush.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" },
  });

  return pushes.map(toPushState);
}

export async function getImportedProductPush(shop: string, sourceProductId: string) {
  const push = await db.importedProductPush.findUnique({
    where: { shop_sourceProductId: { shop, sourceProductId } },
  });

  return push ? toPushState(push) : null;
}

export async function markImportedProductPushing(
  shop: string,
  product: CatalogProduct,
) {
  const push = await db.importedProductPush.upsert({
    where: { shop_sourceProductId: { shop, sourceProductId: product.id } },
    create: {
      shop,
      sourceProductId: product.id,
      sourceTitle: product.title,
      sourceCategory: product.category,
      retailPrice: product.recommendedRetailPrice,
      currency: product.currency,
      idempotencyKey: `${shop}:${product.id}`,
      status: "PUSHING",
      errorMessage: null,
    },
    update: {
      sourceTitle: product.title,
      sourceCategory: product.category,
      retailPrice: product.recommendedRetailPrice,
      currency: product.currency,
      status: "PUSHING",
      errorMessage: null,
    },
  });

  return toPushState(push);
}

export async function markImportedProductDraftCreated(
  shop: string,
  sourceProductId: string,
  shopifyProductId: string,
  shopifyVariantId: string | null,
  warning: string | null = null,
) {
  const push = await db.importedProductPush.update({
    where: { shop_sourceProductId: { shop, sourceProductId } },
    data: {
      status: "DRAFT_CREATED",
      shopifyProductId,
      shopifyVariantId,
      errorMessage: warning,
    },
  });

  return toPushState(push);
}

export async function markImportedProductPushFailed(
  shop: string,
  sourceProductId: string,
  errorMessage: string,
) {
  const push = await db.importedProductPush.update({
    where: { shop_sourceProductId: { shop, sourceProductId } },
    data: { status: "FAILED", errorMessage: errorMessage.slice(0, 500) },
  });

  return toPushState(push);
}

export { DEFAULT_SETTINGS };
