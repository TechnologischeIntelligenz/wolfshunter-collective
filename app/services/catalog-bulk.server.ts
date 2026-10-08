import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import type { ShopifyAdminCatalog, ShopifyAdminCollection, ShopifyAdminProduct } from "./shopify-admin-catalog.server";

export type CatalogAdmin = { graphql: (query: string, options?: { variables?: Record<string, unknown> }) => Promise<Response> };

export const BULK_CATALOG_QUERY = `{
  products {
    edges { node {
      __typename id title handle descriptionHtml status vendor productType tags createdAt updatedAt totalInventory
      variantsCount { count } mediaCount { count }
      priceRangeV2 { minVariantPrice { amount currencyCode } maxVariantPrice { amount currencyCode } }
      images { edges { node { __typename id url altText } } }
      collections { edges { node { __typename id title handle updatedAt } } }
      variants { edges { node { __typename id title sku price compareAtPrice inventoryQuantity selectedOptions { name value } image { url altText } } } }
    } }
  }
}`;

export async function catalogGraphql<T>(admin: CatalogAdmin, query: string, variables?: Record<string, unknown>): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await admin.graphql(query, { variables });
    const result = await response.json() as { data?: T; errors?: Array<{ message: string; extensions?: { code?: string } }> };
    if ((response.status === 429 || result.errors?.some(e => e.extensions?.code === "THROTTLED")) && attempt < 4) {
      await new Promise(resolve => setTimeout(resolve, 1000 * 2 ** attempt));
      continue;
    }
    if (!response.ok || result.errors?.length || !result.data) {
      throw new Error(result.errors?.map(e => e.message).join("; ") || `Shopify HTTP ${response.status}`);
    }
    return result.data;
  }
  throw new Error("Shopify rate limit exhausted");
}

// Keep every variant in the private export. Retailer mapping explicitly selects
// customer-facing fields and never exposes SKU or supplier identity.
export type BulkProduct = ShopifyAdminProduct & { variants: Array<Record<string, unknown>> };
type BulkRow = Record<string, unknown> & { id: string; __typename: string; __parentId?: string };

export async function parseCatalogLines(lines: AsyncIterable<string> | Iterable<string>): Promise<BulkProduct[]> {
  const products = new Map<string, BulkProduct>();
  for await (const line of lines) {
    if (!line.trim()) continue;
    const row = JSON.parse(line) as BulkRow;
    if (row.__typename === "Product") {
      if (products.has(row.id)) throw new Error("Duplicate product in bulk export");
      const raw = row as unknown as ShopifyAdminProduct & {
        variantsCount?: { count: number }; mediaCount?: { count: number };
        priceRangeV2?: { minVariantPrice: { amount: string; currencyCode: string }; maxVariantPrice: { amount: string } };
      };
      const range = raw.priceRangeV2;
      products.set(row.id, {
        id: raw.id, title: raw.title, handle: raw.handle, descriptionHtml: raw.descriptionHtml ?? "",
        status: raw.status, vendor: raw.vendor ?? "", productType: raw.productType ?? "", tags: raw.tags ?? [],
        createdAt: raw.createdAt, updatedAt: raw.updatedAt, totalInventory: raw.totalInventory ?? 0,
        variantCount: raw.variantsCount?.count ?? 0, imageCount: raw.mediaCount?.count ?? 0,
        priceRange: range ? { minimum: Number(range.minVariantPrice.amount), maximum: Number(range.maxVariantPrice.amount), currency: range.minVariantPrice.currencyCode } : null,
        images: [], collections: [], variants: [],
      });
    } else {
      const parent = row.__parentId ? products.get(row.__parentId) : undefined;
      if (!parent) throw new Error("Bulk export contains a child without a product");
      if (row.__typename === "Image") parent.images.push({ url: String(row.url), altText: row.altText == null ? null : String(row.altText) });
      else if (row.__typename === "Collection") parent.collections.push({ id: row.id, title: String(row.title), handle: String(row.handle), updatedAt: String(row.updatedAt) });
      else if (row.__typename === "ProductVariant") parent.variants.push(row);
      else throw new Error(`Unexpected bulk row type: ${row.__typename}`);
    }
  }
  for (const product of products.values()) {
    if (product.variants.length !== product.variantCount) throw new Error(`Incomplete variants for ${product.id}`);
  }
  return [...products.values()];
}

export async function getCompleteShopifyCatalog(admin: CatalogAdmin, progress: (message: string) => void = () => {}): Promise<ShopifyAdminCatalog> {
  const countQuery = `query { productsCount(limit: null) { count precision } }`;
  const before = await catalogGraphql<{ productsCount: { count: number; precision: string } }>(admin, countQuery);
  const start = await catalogGraphql<{ bulkOperationRunQuery: { bulkOperation: { id: string } | null; userErrors: Array<{ message: string }> } }>(admin,
    `mutation CatalogExport($query: String!) { bulkOperationRunQuery(query: $query) { bulkOperation { id } userErrors { message } } }`,
    { query: BULK_CATALOG_QUERY });
  if (start.bulkOperationRunQuery.userErrors.length || !start.bulkOperationRunQuery.bulkOperation) throw new Error(start.bulkOperationRunQuery.userErrors.map(e => e.message).join("; ") || "Bulk export did not start");
  const id = start.bulkOperationRunQuery.bulkOperation.id;
  progress(`Bulk export started: ${before.productsCount.count} products`);
  const deadline = Date.now() + 30 * 60_000;
  let products: BulkProduct[] | null = null;
  while (Date.now() < deadline) {
    const { node } = await catalogGraphql<{ node: { status: string; errorCode: string | null; url: string | null; rootObjectCount: string } }>(admin,
      `query CatalogExportStatus($id: ID!) { node(id: $id) { ... on BulkOperation { status errorCode url rootObjectCount } } }`, { id });
    if (!node) throw new Error("Bulk export could not be found");
    if (node.status === "COMPLETED") {
      if (!node.url) {
        if (before.productsCount.count !== 0) throw new Error("Completed export has no download URL");
        products = [];
      } else {
        const response = await fetch(node.url, { signal: AbortSignal.timeout(300_000) });
        if (!response.ok || !response.body) throw new Error(`Bulk download HTTP ${response.status}`);
        const stream = Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]);
        products = await parseCatalogLines(createInterface({ input: stream, crlfDelay: Infinity }));
      }
      if (products.length !== Number(node.rootObjectCount)) throw new Error("Bulk export root count does not match downloaded products");
      break;
    }
    if (["FAILED", "CANCELED", "CANCELING", "EXPIRED"].includes(node.status)) throw new Error(`Bulk export ${node.status}: ${node.errorCode ?? "unknown"}`);
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  if (!products) throw new Error("Bulk export timed out; the previous catalog remains available");
  const after = await catalogGraphql<typeof before>(admin, countQuery);
  if (before.productsCount.precision !== "EXACT" || after.productsCount.precision !== "EXACT" || before.productsCount.count !== products.length || after.productsCount.count !== products.length) {
    throw new Error("Product count changed during export or differs from Shopify; retry synchronization");
  }
  const collections: ShopifyAdminCollection[] = [];
  let cursor: string | null = null;
  do {
    const page: { collections: { nodes: ShopifyAdminCollection[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } } } = await catalogGraphql(admin,
      `query CatalogCollections($after: String) { collections(first: 250, after: $after) { nodes { id title handle updatedAt } pageInfo { hasNextPage endCursor } } }`, { after: cursor });
    collections.push(...page.collections.nodes);
    if (!page.collections.pageInfo.hasNextPage) break;
    if (!page.collections.pageInfo.endCursor || page.collections.pageInfo.endCursor === cursor) throw new Error("Collection pagination stalled");
    cursor = page.collections.pageInfo.endCursor;
  } while (cursor);
  progress(`Verified ${products.length} products, ${products.reduce((n, p) => n + p.variants.length, 0)} variants, ${collections.length} collections`);
  return { source: "shopify", products, collections, error: null };
}
