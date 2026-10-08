import fs from "node:fs/promises";
import path from "node:path";
import type { ShopifyAdminCatalog } from "./shopify-admin-catalog.server";

export interface CatalogSnapshot {
  sourceShop: string;
  syncedAt: string;
  catalog: ShopifyAdminCatalog;
}

export function sourceDataPath(shop: string, name: string) {
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop)) throw new Error("Invalid source shop");
  return path.resolve(process.env.SOURCE_DATA_DIR || "data", shop, name);
}

export async function writeSourceData(shop: string, name: string, value: unknown) {
  if (name === "catalog.json") {
    const generation = `catalog-${Date.now()}-${crypto.randomUUID()}.json`;
    await writeSourceData(shop, generation, value);
    await writeSourceData(shop, "catalog-current.json", { file: generation });
    return;
  }
  const target = sourceDataPath(shop, name);
  await fs.mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(value));
  for (let attempt = 0; ; attempt++) {
    try { await fs.rename(temporary, target); break; }
    catch (error) {
      if (attempt >= 12 || !["EPERM", "EACCES", "EBUSY"].includes((error as NodeJS.ErrnoException).code ?? "")) throw error;
      await new Promise(resolve => setTimeout(resolve, Math.min(1000, 100 * (attempt + 1))));
    }
  }
}

const cache = new Map<string, { mtime: number; size: number; snapshot: CatalogSnapshot }>();

export async function readCatalogSnapshot(shop: string): Promise<CatalogSnapshot | null> {
  try {
    let file = sourceDataPath(shop, "catalog.json");
    try {
      const pointer = JSON.parse(await fs.readFile(sourceDataPath(shop, "catalog-current.json"), "utf8")) as { file: string };
      if (!/^catalog-[0-9]+-[a-f0-9-]+\.json$/.test(pointer.file)) throw new Error("Invalid catalog generation");
      file = sourceDataPath(shop, pointer.file);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    const stat = await fs.stat(file);
    const existing = cache.get(shop);
    if (existing?.mtime === stat.mtimeMs && existing.size === stat.size) return existing.snapshot;
    const result = JSON.parse(await fs.readFile(file, "utf8")) as CatalogSnapshot;
    if (result.sourceShop !== shop || result.catalog.source !== "shopify" || result.catalog.error) return null;
    cache.set(shop, { mtime: stat.mtimeMs, size: stat.size, snapshot: result });
    return result;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export function invalidateCatalogSnapshot(shop: string) { cache.delete(shop); }
