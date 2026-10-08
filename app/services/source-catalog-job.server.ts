import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import db from "../db.server.ts";
import { getCatalogSourceShop } from "./app-admin.server.ts";
import { catalogGraphql, type CatalogAdmin } from "./catalog-bulk.server.ts";
import { runDurableJobStep, prismaJobStore } from "./durable-job.server.ts";

export type CatalogCheckpoint = {
  phase: "count" | "products" | "verify";
  startedAt: string;
  after: string | null;
  expectedCount: number;
  scanned: number;
  pages: number;
  recentCursors: string[];
  pending: any[];
  finishedPages: boolean;
  lastProductId?: string;
};

export const newCatalogCheckpoint = (): CatalogCheckpoint => ({
  phase: "count", startedAt: new Date().toISOString(), after: null,
  expectedCount: 0, scanned: 0, pages: 0, recentCursors: [], pending: [], finishedPages: false,
});

const pageInfoFields = "pageInfo { hasNextPage endCursor }";
const countQuery = "query SourceCatalogCount { shop { myshopifyDomain } productsCount(limit: null) { count precision } }";
const productQuery = `query SourceCatalogPage($after: String) { products(first: 5, after: $after, sortKey: ID) { nodes {
  id title handle descriptionHtml status vendor productType tags createdAt updatedAt totalInventory
  variantsCount { count } mediaCount { count }
  priceRangeV2 { minVariantPrice { amount currencyCode } maxVariantPrice { amount currencyCode } }
  images(first: 50) { nodes { url altText } ${pageInfoFields} }
  collections(first: 50) { nodes { id title handle updatedAt } ${pageInfoFields} }
} ${pageInfoFields} } }`;

function nextCursor(page: any, previous: string | null) {
  if (typeof page?.hasNextPage !== "boolean") throw new Error("Missing catalog pagination");
  if (!page.hasNextPage) return null;
  if (!page.endCursor || page.endCursor === previous || page.endCursor.length > 4096) throw new Error("Catalog pagination stalled");
  return page.endCursor as string;
}

function normalize(product: any) {
  const range = product.priceRangeV2;
  const minimum = Number(range?.minVariantPrice?.amount), maximum = Number(range?.maxVariantPrice?.amount);
  if (!product.id?.startsWith("gid://shopify/Product/") || !Number.isFinite(minimum) || !Number.isFinite(maximum) || minimum < 0 || maximum < minimum || range.minVariantPrice.currencyCode !== range.maxVariantPrice.currencyCode) throw new Error("Invalid catalog product");
  return { ...product, images: product.images.nodes, collections: product.collections.nodes,
    priceRange: { minimum, maximum, currency: range.minVariantPrice.currencyCode },
    variantCount: product.variantsCount.count, imageCount: product.mediaCount.count };
}

export async function prepareCatalogStep(admin: CatalogAdmin, _shop: string, checkpoint: CatalogCheckpoint) {
  const state = structuredClone(checkpoint) as CatalogCheckpoint;
  if (state.phase === "count" || state.phase === "verify") {
    const data = await catalogGraphql<any>(admin, countQuery);
    if (data.shop.myshopifyDomain !== _shop || data.productsCount.precision !== "EXACT") throw new Error("Cannot verify catalog source/count");
    if (state.phase === "verify") {
      if (data.productsCount.count !== state.expectedCount || state.scanned !== state.expectedCount) throw new Error("Catalog changed during traversal; retry before removing products");
      return { state, done: true, effects: [] as any[] };
    }
    state.expectedCount = data.productsCount.count; state.phase = "products";
    return { state, done: false, effects: [] as any[] };
  }
  if (!state.pending.length && !state.finishedPages) {
    const data = await catalogGraphql<any>(admin, productQuery, { after: state.after });
    if (!Array.isArray(data.products?.nodes) || data.products.nodes.length > 5 || new Set(data.products.nodes.map((p: any) => p.id)).size !== data.products.nodes.length) throw new Error("Invalid product page");
    const cursor = nextCursor(data.products.pageInfo, state.after);
    if (cursor && (state.recentCursors.includes(cursor) || !data.products.nodes.length || state.pages >= 1e5)) throw new Error("Product pagination stalled");
    state.pending = data.products.nodes; state.after = cursor; state.finishedPages = !cursor; state.pages++;
    for (const product of state.pending) {
      if (!/^gid:\/\/shopify\/Product\/\d+$/.test(product.id)) throw new Error("Invalid product identifier");
      if (state.lastProductId && BigInt(product.id.split("/").pop()!) <= BigInt(state.lastProductId.split("/").pop()!)) throw new Error("Product traversal repeated or reversed");
      state.lastProductId = product.id;
    }
    if (cursor) state.recentCursors = [...state.recentCursors, cursor].slice(-32);
  }
  const incomplete = state.pending.find((p: any) => p.images.pageInfo.hasNextPage || p.collections.pageInfo.hasNextPage);
  if (incomplete) {
    const field = incomplete.images.pageInfo.hasNextPage ? "images" : "collections";
    const cursor = nextCursor(incomplete[field].pageInfo, null);
    const fields = field === "images" ? "url altText" : "id title handle updatedAt";
    const data = await catalogGraphql<any>(admin, `query SourceProductDetails($id: ID!, $after: String) { product(id:$id) { id ${field}(first:50,after:$after) { nodes { ${fields} } ${pageInfoFields} } } }`, { id: incomplete.id, after: cursor });
    if (!data.product || data.product.id !== incomplete.id) throw new Error("Product disappeared during traversal");
    const page = data.product[field];
    if (!Array.isArray(page?.nodes) || page.nodes.length > 50 || !page.nodes.length && page.pageInfo.hasNextPage) throw new Error("Invalid product details page");
    nextCursor(page.pageInfo, cursor);
    incomplete[field] = { nodes: [...incomplete[field].nodes, ...page.nodes], pageInfo: page.pageInfo };
    if (incomplete.images.nodes.length > 1e3 || incomplete.collections.nodes.length > 1e3) throw new Error("Product details exceed bounded sync limit");
  }
  const ready = state.pending.filter((p: any) => !p.images.pageInfo.hasNextPage && !p.collections.pageInfo.hasNextPage);
  state.pending = state.pending.filter((p: any) => !ready.includes(p));
  const products = ready.map(normalize); state.scanned += products.length;
  if (state.scanned > state.expectedCount) throw new Error("Catalog count changed during traversal");
  if (state.finishedPages && !state.pending.length) state.phase = "verify";
  if (JSON.stringify({ state, products }).length > 1e6) throw new Error("Product page exceeds bounded sync limit");
  return { state, done: false, effects: products };
}

export async function processSourceCatalogPage(admin: CatalogAdmin, shop: string) {
  if (shop !== getCatalogSourceShop()) throw new Error("Only the configured source can synchronize");
  const store = prismaJobStore(shop, "source-full", async (tx: Prisma.TransactionClient, _lease: any, step: any) => {
    for (const product of step.effects ?? []) {
      const descriptionText = product.descriptionHtml.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      const hash = createHash("sha256").update(JSON.stringify(product)).digest("hex");
      const record = { sourceShop: shop, title: product.title, handle: product.handle, status: product.status, vendor: product.vendor, productType: product.productType, category: product.productType || "General", descriptionHtml: product.descriptionHtml, descriptionText, collectionsJson: JSON.stringify(product.collections), imageUrlsJson: JSON.stringify(product.images.map((i: any) => i.url)), tagsJson: JSON.stringify(product.tags), priceMinimum: product.priceRange.minimum, priceMaximum: product.priceRange.maximum, currency: product.priceRange.currency, totalInventory: product.totalInventory, variantCount: product.variantCount, imageCount: product.imageCount, sourceCreatedAt: new Date(product.createdAt), sourceUpdatedAt: new Date(product.updatedAt), contentHash: hash, lastSyncedAt: new Date() };
      await tx.catalogKnowledgeProduct.upsert({ where: { sourceProductId: product.id }, create: { sourceProductId: product.id, ...record }, update: record });
      const document = { title: product.title, body: [product.title, product.productType, descriptionText].join("\n"), bodyHash: hash, metadataJson: JSON.stringify({ status: product.status, collections: product.collections }), lastSyncedAt: new Date() };
      await tx.knowledgeDocument.upsert({ where: { shop_domain_sourceKey: { shop, domain: "product", sourceKey: product.id } }, create: { shop, domain: "product", sourceKey: product.id, ...document }, update: document });
    }
    if (step.done) await tx.catalogKnowledgeProduct.updateMany({ where: { sourceShop: shop, lastSyncedAt: { lt: new Date(step.state.startedAt) } }, data: { status: "REMOVED" } });
    await tx.runtimeSourceState.upsert({ where: { shop_kind: { shop, kind: "sync-state" } }, create: { shop, kind: "sync-state", payloadJson: JSON.stringify({ status: step.done ? "COMPLETED" : "RUNNING", startedAt: step.state.startedAt, ...(step.done ? { finishedAt: new Date().toISOString() } : {}), products: step.state.scanned, message: `Catalog: ${step.state.scanned} / ${step.state.expectedCount} products synchronized` }) }, update: { payloadJson: JSON.stringify({ status: step.done ? "COMPLETED" : "RUNNING", startedAt: step.state.startedAt, ...(step.done ? { finishedAt: new Date().toISOString() } : {}), products: step.state.scanned, message: `Catalog: ${step.state.scanned} / ${step.state.expectedCount} products synchronized` }) } });
  });
  return runDurableJobStep(store, (lease) => prepareCatalogStep(admin, shop, lease.state as CatalogCheckpoint));
}
