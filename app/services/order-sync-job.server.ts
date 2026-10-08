import type { Prisma } from "@prisma/client";
import { catalogGraphql, type CatalogAdmin } from "./catalog-bulk.server.ts";
import { prismaJobStore, runDurableJobStep } from "./durable-job.server.ts";
import { upsertRetailerOrder } from "./retailer-orders.server.ts";
import { orderNumber } from "./order-normalization.ts";

export const ORDERS_PAGE_QUERY = `query CollectiveOrders($after: String, $query: String) {
  orders(first: 10, after: $after, sortKey: UPDATED_AT, query: $query) {
    nodes { id name createdAt updatedAt displayFinancialStatus displayFulfillmentStatus currencyCode
      currentTotalPriceSet { shopMoney { amount } } currentSubtotalLineItemsQuantity }
    pageInfo { hasNextPage endCursor }
  }
}`;

type OrderState = { query: string; after: string | null; recentCursors: string[]; startedAt: string; triggeredBy: string; scanned: number; synced: number; pages: number; runId?: number };

export async function processOrderSyncPage(admin: CatalogAdmin, shop: string) {
  const store = prismaJobStore(shop, "orders", async (tx: Prisma.TransactionClient, _lease: any, step: any) => {
    if (!step.state.runId) {
      const run = await tx.catalogSyncRun.create({ data: { shop, scope: "orders", triggeredBy: step.state.triggeredBy, startedAt: new Date(step.state.startedAt) } });
      step.state.runId = run.id;
    }
    for (const order of step.effects ?? []) {
      const saved = await upsertRetailerOrder(shop, {
        shopifyOrderId: order.id, orderNumber: order.name, createdAt: order.createdAt, shopifyUpdatedAt: order.updatedAt,
        financialStatus: order.displayFinancialStatus, fulfillmentStatus: order.displayFulfillmentStatus, currency: order.currencyCode,
        totalPrice: orderNumber(order.currentTotalPriceSet?.shopMoney?.amount), lineItemCount: order.currentSubtotalLineItemsQuantity,
        lastEvent: "orders/sync",
      }, tx);
      if (saved) step.state.synced++;
    }
    await tx.catalogSyncRun.update({ where: { id: step.state.runId }, data: { status: step.done ? "COMPLETED" : "RUNNING", scannedCount: step.state.scanned, upsertedCount: step.state.synced, finishedAt: step.done ? new Date() : null } });
  });
  return runDurableJobStep(store, async (lease) => {
    const response = await catalogGraphql<any>(admin, ORDERS_PAGE_QUERY, { after: (lease.state as OrderState).after, query: (lease.state as OrderState).query });
    const state = structuredClone(lease.state) as OrderState;
    const page = response.orders;
    if (!Array.isArray(page?.nodes) || page.nodes.length > 10 || typeof page.pageInfo?.hasNextPage !== "boolean") throw new Error("Incomplete or oversized Shopify orders response");
    const done = !page.pageInfo.hasNextPage; const next = page.pageInfo.endCursor;
    if (!done && (!next || next.length > 4096 || next === state.after || state.recentCursors.includes(next))) throw new Error("Shopify order pagination stalled");
    if (!done && state.pages >= 9999) throw new Error("Order synchronization page limit reached");
    return { state: { ...state, after: done ? null : next, pages: state.pages + 1, recentCursors: done ? [] : [...state.recentCursors, next].slice(-32), scanned: state.scanned + page.nodes.length }, done, effects: page.nodes };
  });
}
