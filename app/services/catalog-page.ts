import { createRecommendationProvider } from "./merchandising/rule-based-provider.ts";
import type { CatalogProduct, CatalogSort, RecommendationBucket, RetailerAffinitySignals, TenantContext } from "./merchandising/types";

export interface CatalogPage {
  page: number; pageSize: number; pageCount: number; total: number; filteredTotal: number;
  search: string; collection: string; sort: string; bucket: string;
  collections: Array<{ id: string; title: string; handle: string; count: number }>;
  bucketCounts: Record<string, number>;
}
export function catalogPage<T extends { id: string; title: string; collections: Array<{ id: string; title: string; handle: string }> }>(
  products: T[], params: URLSearchParams,
) {
  const search = (params.get("q") ?? "").trim().slice(0, 200);
  const collection = params.get("collection") || "ALL_COLLECTIONS";
  const map = new Map<string, CatalogPage["collections"][number]>();
  for (const product of products) for (const item of product.collections) {
    const existing = map.get(item.id);
    map.set(item.id, { ...item, count: (existing?.count ?? 0) + 1 });
  }
  const filtered = products.filter(p =>
    (collection === "ALL_COLLECTIONS" || p.collections.some(c => c.id === collection)) &&
    (!search || [p.title, ...p.collections.map(c => c.title)].join(" ").toLowerCase().includes(search.toLowerCase())));
  const pageSize = 250;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const requested = Number(params.get("page") || 1);
  const page = Math.min(pageCount, Math.max(1, Number.isFinite(requested) ? Math.floor(requested) : 1));
  const meta: CatalogPage = {
    page, pageSize, pageCount, total: products.length, filteredTotal: filtered.length, search, collection,
    sort: params.get("sort") || "RECOMMENDED", bucket: params.get("bucket") || "ALL_PRODUCTS",
    collections: [...map.values()].sort((a,b) => a.title.localeCompare(b.title)), bucketCounts: {},
  };
  return { products: filtered.slice((page - 1) * pageSize, page * pageSize), meta };
}
export function retailerCatalogPage(products: CatalogProduct[], tenant: TenantContext, affinity: RetailerAffinitySignals, params: URLSearchParams) {
  const sorts: CatalogSort[] = ["RECOMMENDED", "HIGHEST_MARGIN", "FASTEST_DELIVERY", "HIGHEST_STOCK", "NEWEST", "LOWEST_WHOLESALE_PRICE"];
  const buckets: RecommendationBucket[] = ["RECOMMENDED_FOR_STORE", "FAST_SHIPPING", "HIGH_MARGIN", "NEW_ARRIVALS", "PREMIUM_SELECTION"];
  const sort = sorts.includes(params.get("sort") as CatalogSort) ? params.get("sort") as CatalogSort : "RECOMMENDED";
  const bucket = buckets.includes(params.get("bucket") as RecommendationBucket) ? params.get("bucket") as RecommendationBucket : undefined;
  const ranked = createRecommendationProvider().recommend({ products, tenant, affinity, sort }).products;
  const counts = Object.fromEntries(buckets.map(b => [b, ranked.filter(p => p.score.buckets.includes(b)).length]));
  const result = catalogPage(ranked.filter(p => !bucket || p.score.buckets.includes(bucket)).map(p => p.product), params);
  const all = catalogPage(products, new URLSearchParams());
  result.meta.total = products.length;
  result.meta.collections = all.meta.collections;
  result.meta.bucketCounts = counts;
  result.meta.sort = sort;
  result.meta.bucket = bucket ?? "ALL_PRODUCTS";
  return result;
}


export function catalogDisplayProducts(products: CatalogProduct[]): CatalogProduct[] {
  return products.map(p => ({ ...p, descriptionHtml: null, imageUrls: p.imageUrls.slice(0, 4) }));
}
