// Scheduler recovery implementation.
// The active Worker uses the same durable lease/retry boundary. The page-level
// processors are recovered separately; existing sync functions remain the
// source of truth for their domain behavior.
import { unauthenticated } from "../shopify.server";
import { getCatalogSourceShop } from "./app-admin.server";
import { getCompleteShopifyCatalog } from "./catalog-bulk.server";
import { syncCatalogKnowledgeFromSnapshot, syncShopPolicies } from "./knowledge-sync.server";
import { syncRecentShopifyOrders } from "./retailer-orders.server";
import { syncSourceCommerce } from "./source-commerce.server";
import { runDurableJobStep, listDueBackgroundJobs, prismaJobStore } from "./durable-job.server";
import { processImportStock, processSourceStock } from "../../_recovery/live-import-runtime.mjs";

const supportedKinds = new Set(["orders", "source-commerce", "source-full", "source-stock", "import-stock"]);

export async function runScheduledJobs() {
  const jobs = await listDueBackgroundJobs(2);
  let processed = 0;
  for (const job of jobs) {
    if (!supportedKinds.has(job.kind)) continue;
    try {
      const { admin } = await unauthenticated.admin(job.shop);
      const store = prismaJobStore(job.shop, job.kind);
      const result = await runDurableJobStep(store, async (lease) => {
        if (job.kind === "orders") {
          await syncRecentShopifyOrders(admin, job.shop);
        } else if (job.kind === "source-commerce") {
          if (getCatalogSourceShop() !== job.shop) throw new Error("Source shop is missing");
          await syncSourceCommerce(admin, job.shop);
          await syncShopPolicies(admin, job.shop);
        } else if (job.kind === "source-full") {
          if (getCatalogSourceShop() !== job.shop) throw new Error("Source shop is missing");
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
        return { state: lease.state, done: true };
      });
      if (result === "completed") processed++;
    } catch {
      // runDurableJobStep fences and retries the job through the lease store.
    }
  }
  return { processed };
}
