// Scheduler recovery implementation.
// The active Worker uses the same durable lease/retry boundary. The page-level
// processors are recovered separately; existing sync functions remain the
// source of truth for their domain behavior.
import { unauthenticated } from "../shopify.server";
import { listDueBackgroundJobs } from "./durable-job.server";
import { processSourceCatalogPage } from "./source-catalog-job.server.ts";
import { processSourceCommercePage } from "./source-commerce-job.server.ts";
import { processOrderSyncPage } from "./order-sync-job.server.ts";

// Only processors restored as TypeScript modules are scheduled. Stock jobs remain
// durable in PostgreSQL but must not be claimed until their recovery processor is restored.
const supportedKinds = new Set(["orders", "source-commerce", "source-full"]);

export async function runScheduledJobs() {
  const jobs = await listDueBackgroundJobs(2);
  let processed = 0;
  for (const job of jobs) {
    if (!supportedKinds.has(job.kind)) continue;
    try {
      const { admin } = await unauthenticated.admin(job.shop);
      // These recovered processors claim and commit their own durable page lease.
      if (job.kind === "source-full") {
        if ((await processSourceCatalogPage(admin, job.shop)) === "completed") processed++;
        continue;
      }
      if (job.kind === "source-commerce") {
        if ((await processSourceCommercePage(admin, job.shop)) === "completed") processed++;
        continue;
      }
      if (job.kind === "orders") {
        if ((await processOrderSyncPage(admin, job.shop)) === "completed") processed++;
        continue;
      }
    } catch {
      // runDurableJobStep fences and retries the job through the lease store.
    }
  }
  return { processed };
}
