import fs from "node:fs/promises";
import { getCatalogSourceShop } from "./app-admin.server.ts";
import {
  getCompleteShopifyCatalog,
  type CatalogAdmin,
} from "./catalog-bulk.server.ts";
import { sourceDataPath, writeSourceData } from "./catalog-snapshot.server.ts";
import {
  syncCatalogKnowledgeFromSnapshot,
  syncShopPolicies,
} from "./knowledge-sync.server.ts";
import { syncSourceCommerce } from "./source-commerce.server.ts";

export interface SourceSyncState {
  status: "RUNNING" | "COMPLETED" | "FAILED";
  message: string;
  startedAt: string;
  finishedAt?: string;
  products?: number;
}
export async function readSourceSyncState(
  shop: string,
): Promise<SourceSyncState | null> {
  try {
    return JSON.parse(
      await fs.readFile(sourceDataPath(shop, "sync-state.json"), "utf8"),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}
export async function startSourceSync(
  admin: CatalogAdmin,
  shop: string,
  mode: "full" | "commerce" = "full",
) {
  if (shop !== getCatalogSourceShop())
    throw new Error("Only the configured source shop can synchronize");
  const lock = sourceDataPath(shop, "sync.lock");
  await fs.mkdir(sourceDataPath(shop, "."), { recursive: true });
  try {
    await fs.mkdir(lock);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST")
      throw new Error("A source synchronization is already running");
    throw error;
  }
  const state: SourceSyncState = {
    status: "RUNNING",
    message:
      mode === "full"
        ? "Preparing complete catalog export"
        : "Preparing shipping, markets and policies",
    startedAt: new Date().toISOString(),
  };
  try { await writeSourceData(shop, "sync-state.json", state); }
  catch (error) { await fs.rmdir(lock); throw error; }
  const completion = (async () => {
    try {
      if (mode === "full") {
        const catalog = await getCompleteShopifyCatalog(admin);
        state.message = `Indexing ${catalog.products.length} products`;
        await writeSourceData(shop, "sync-state.json", state);
        await syncCatalogKnowledgeFromSnapshot({
          catalog,
          sourceShop: shop,
          triggeredBy: "full-source-sync",
        });
        await writeSourceData(shop, "catalog.json", {
          sourceShop: shop,
          syncedAt: new Date().toISOString(),
          catalog,
        });
        state.products = catalog.products.length;
      }
      state.message = "Synchronizing markets, shipping and policies";
      await writeSourceData(shop, "sync-state.json", state);
      await syncSourceCommerce(admin, shop);
      await syncShopPolicies(admin, shop);
      state.status = "COMPLETED";
      state.message =
        mode === "full"
          ? `Synchronized ${state.products} products, collections, markets, shipping and policies`
          : "Synchronized markets, shipping and policies";
    } catch (error) {
      state.status = "FAILED";
      state.message =
        error instanceof Error
          ? error.message.slice(0, 400)
          : "Synchronization failed";
    } finally {
      state.finishedAt = new Date().toISOString();
      try {
        await writeSourceData(shop, "sync-state.json", state);
      } finally {
        await fs.rmdir(lock);
      }
    }
    return state;
  })();
  // Keep rejection handled when an HTTP action returns before the worker finishes.
  void completion.catch(() => {});
  return { completion };
}
