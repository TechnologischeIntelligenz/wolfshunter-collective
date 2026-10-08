import fs from "node:fs/promises";
import path from "node:path";
import db from "../db.server.ts";
import { cancelOrderSync } from "./retailer-orders.server.ts";
import {
  sourceDataPath,
  invalidateCatalogSnapshot,
} from "./catalog-snapshot.server.ts";

/** Idempotent, tenant-scoped deletion. Uses the same lock as source synchronization. */
export async function deleteShopData(shop: string) {
  if (cancelOrderSync(shop))
    throw new Response("Order synchronization stopping; retry deletion", {
      status: 503,
    });
  const directory = sourceDataPath(shop, ".");
  await fs.mkdir(directory, { recursive: true });
  const root = await fs.realpath(path.dirname(directory));
  const resolved = await fs.realpath(directory);
  if (
    path.dirname(resolved).toLowerCase() !== root.toLowerCase() ||
    path.basename(resolved).toLowerCase() !== shop.toLowerCase()
  )
    throw new Error("Unsafe tenant data directory");
  const lock = sourceDataPath(shop, "sync.lock");
  try {
    await fs.mkdir(lock);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST")
      throw new Response("Source synchronization is active; retry deletion", {
        status: 503,
      });
    throw error;
  }
  try {
    await db.$transaction([
      db.supportCase.deleteMany({ where: { shop } }),
      db.retailerOrder.deleteMany({ where: { shop } }),
      db.importedProductPush.deleteMany({ where: { shop } }),
      db.retailerSettings.deleteMany({ where: { shop } }),
      db.retailerWorkspace.deleteMany({ where: { shop } }),
      db.retailerProductRelease.deleteMany({ where: { retailerShop: shop } }),
      db.catalogKnowledgeProduct.deleteMany({ where: { sourceShop: shop } }),
      db.knowledgeDocument.deleteMany({ where: { shop } }),
      db.catalogSyncRun.deleteMany({ where: { shop } }),
      db.session.deleteMany({ where: { shop } }),
    ]);
    invalidateCatalogSnapshot(shop);
    await fs.rm(resolved, { recursive: true, force: true });
  } catch (error) {
    await fs.rmdir(lock).catch(() => {});
    throw error;
  }
}
