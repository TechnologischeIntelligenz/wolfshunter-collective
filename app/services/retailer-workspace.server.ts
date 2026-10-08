import db from "../db.server";

export interface RetailerWorkspaceState {
  favoriteProductIds: string[];
  importedProductIds: string[];
}

const parseProductIds = (value: string | null | undefined) => {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every((id) => typeof id === "string")
      ? parsed
      : [];
  } catch {
    return [];
  }
};

const toJson = (productIds: string[]) => JSON.stringify([...new Set(productIds)]);

export async function getRetailerWorkspace(shop: string): Promise<RetailerWorkspaceState> {
  const workspace = await db.retailerWorkspace.upsert({
    where: { shop },
    create: { shop },
    update: {},
  });

  return {
    favoriteProductIds: parseProductIds(workspace.favoriteProductIds),
    importedProductIds: parseProductIds(workspace.importedProductIds),
  };
}

export async function setRetailerWorkspaceState(
  shop: string,
  state: RetailerWorkspaceState,
) {
  const workspace = await db.retailerWorkspace.upsert({
    where: { shop },
    create: {
      shop,
      favoriteProductIds: toJson(state.favoriteProductIds),
      importedProductIds: toJson(state.importedProductIds),
    },
    update: {
      favoriteProductIds: toJson(state.favoriteProductIds),
      importedProductIds: toJson(state.importedProductIds),
    },
  });

  return {
    favoriteProductIds: parseProductIds(workspace.favoriteProductIds),
    importedProductIds: parseProductIds(workspace.importedProductIds),
  } satisfies RetailerWorkspaceState;
}

export async function updateRetailerWorkspace(
  shop: string,
  input: {
    intent: "favorite" | "import";
    productId: string;
    selected: boolean;
    allowedProductIds: string[];
  },
) {
  if (!input.allowedProductIds.includes(input.productId)) {
    throw new Error("Product is not available to this retailer");
  }

  const current = await getRetailerWorkspace(shop);
  const key = input.intent === "favorite" ? "favoriteProductIds" : "importedProductIds";
  const nextIds = input.selected
    ? [...current[key], input.productId]
    : current[key].filter((id) => id !== input.productId);

  return setRetailerWorkspaceState(shop, {
    ...current,
    [key]: nextIds,
  });
}
