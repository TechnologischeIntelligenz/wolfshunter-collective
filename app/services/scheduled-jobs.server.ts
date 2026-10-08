// Recovery scheduler for the local source tree.
// The deployed Worker remains the authoritative runtime. This file keeps the
// restored project buildable while the exact durable scheduler is reconstructed
// from the preserved Cloudflare bundle.
import db from "../db.server";
import { unauthenticated } from "../shopify.server";
import { getCatalogSourceShop } from "./app-admin.server";
import { getCompleteShopifyCatalog } from "./catalog-bulk.server";
import { syncCatalogKnowledgeFromSnapshot, syncShopPolicies } from "./knowledge-sync.server";
import { syncRecentShopifyOrders } from "./retailer-orders.server";
import { syncSourceCommerce } from "./source-commerce.server";
import { processImportStock, processSourceStock } from "../../_recovery/live-import-runtime.mjs";

export async function runScheduledJobs() {
  const jobs = await db.backgroundJob.findMany({
    where: {
      kind: { in: ["orders", "source-commerce", "source-full", "source-stock", "import-stock"] },
      OR: [
        { status: "PENDING", nextRunAt: { lte: new Date() } },
        { status: "RUNNING", leaseExpiresAt: { lte: new Date() } },
      ],
    },
    orderBy: [{ nextRunAt: "asc" }, { id: "asc" }],
    take: 2,
  });
  let processed = 0;
  for (const job of jobs) {
    try {
      const { admin } = await unauthenticated.admin(job.shop);
      if (job.kind === "orders") {
        await syncRecentShopifyOrders(admin, job.shop);
      } else if (job.kind === "source-commerce") {
        const source = getCatalogSourceShop();
        if (source !== job.shop) throw new Error("Source shop is missing");
        await syncSourceCommerce(admin, job.shop);
        await syncShopPolicies(admin, job.shop);
      } else if (job.kind === "source-full") {
        const source = getCatalogSourceShop();
        if (source !== job.shop) throw new Error("Source shop is missing");
        const catalog = await getCompleteShopifyCatalog(admin);
        await syncCatalogKnowledgeFromSnapshot({ catalog, sourceShop: job.shop, triggeredBy: "scheduled-source-sync" });
        await syncSourceCommerce(admin, job.shop);
        await syncShopPolicies(admin, job.shop);
      } else if (job.kind === "source-stock") {
        await processSourceStock(admin, job.shop);
      } else if (job.kind === "import-stock") {
        const sourceShop = getCatalogSourceShop();
        if (!sourceShop) throw new Error("Stock source is missing");
        const source = await unauthenticated.admin(sourceShop);
        await processImportStock(admin, source.admin, job.shop);
      }
      await db.backgroundJob.updateMany({
        where: { id: job.id },
        data: { status: "COMPLETED", errorMessage: null, leaseToken: null, leaseExpiresAt: null },
      });
      processed++;
    } catch (error) {
      await db.backgroundJob.updateMany({
        where: { id: job.id },
        data: { status: "FAILED", leaseToken: null, leaseExpiresAt: null, errorMessage: error instanceof Error ? error.message.slice(0, 500) : "Scheduled job failed" },
      });
    }
  }
  return { processed };
}
