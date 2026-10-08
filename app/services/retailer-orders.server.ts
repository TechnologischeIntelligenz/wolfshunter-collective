import db from "../db.server.ts";
import type { Prisma } from "@prisma/client";
import { catalogGraphql, type CatalogAdmin } from "./catalog-bulk.server.ts";
import {
  canonicalOrderId,
  orderIdAliases,
  validOrderDate,
  orderNumber,
  type OrderInput,
} from "./order-normalization.ts";
export { normalizeOrderWebhook } from "./order-normalization.ts";

export interface RetailerOrderRecord {
  id: number;
  shopifyOrderId: string;
  orderNumber: string | null;
  createdAt: string;
  shopifyUpdatedAt: string | null;
  financialStatus: string | null;
  fulfillmentStatus: string | null;
  currency: string | null;
  totalPrice: number | null;
  lineItemCount: number;
  syncStatus: string;
  lastEvent: string | null;
}

export async function upsertRetailerOrder(
  shop: string,
  input: OrderInput,
  transaction?: Prisma.TransactionClient,
) {
  const id = canonicalOrderId(input.shopifyOrderId);
  const updated = validOrderDate(input.shopifyUpdatedAt);
  if (!id || !updated)
    throw new Error("Order identity or timestamp is invalid");
  const write = async (tx: Prisma.TransactionClient) => {
    const suppressed = await tx.knowledgeDocument.findUnique({
      where: {
        shop_domain_sourceKey: {
          shop,
          domain: "order-redaction",
          sourceKey: id,
        },
      },
    });
    if (suppressed) return null;
    const aliases = orderIdAliases(id);
    const existing = await tx.retailerOrder.findMany({
      where: { shop, shopifyOrderId: { in: aliases } },
      orderBy: { shopifyUpdatedAt: "desc" },
    });
    const latest = existing[0];
    // Merge legacy numeric IDs without downgrading a newer GraphQL/webhook result.
    const canonical = existing.find((row) => row.shopifyOrderId === id);
    if (latest?.shopifyUpdatedAt && latest.shopifyUpdatedAt >= updated) {
      if (existing.length > 1)
        await tx.retailerOrder.deleteMany({
          where: {
            shop,
            id: {
              in: existing
                .filter((row) => row.id !== latest.id)
                .map((row) => row.id),
            },
          },
        });
      return latest.shopifyOrderId === id
        ? latest
        : tx.retailerOrder.update({
            where: { id: latest.id },
            data: { shopifyOrderId: id },
          });
    }
    if (latest && !canonical)
      await tx.retailerOrder.update({
        where: { id: latest.id },
        data: { shopifyOrderId: id },
      });
    await tx.retailerOrder.deleteMany({
      where: { shop, shopifyOrderId: aliases[1] },
    });
    const values = {
      orderNumber: input.orderNumber,
      shopifyUpdatedAt: updated,
      financialStatus: input.financialStatus,
      fulfillmentStatus: input.fulfillmentStatus,
      currency: input.currency,
      totalPrice: input.totalPrice,
      lineItemCount: input.lineItemCount,
      syncStatus: "SYNCED",
      lastEvent: input.lastEvent,
    };
    return tx.retailerOrder.upsert({
      where: { shop_shopifyOrderId: { shop, shopifyOrderId: id } },
      create: {
        shop,
        shopifyOrderId: id,
        createdAt: validOrderDate(input.createdAt) ?? updated,
        ...values,
      },
      update: {
        ...values,
        ...(validOrderDate(input.createdAt)
          ? { createdAt: validOrderDate(input.createdAt)! }
          : {}),
      },
    });
  };
  return transaction ? write(transaction) : db.$transaction(write);
}

export async function getRetailerOrders(shop: string, requestedPage = 1) {
  const total = await db.retailerOrder.count({ where: { shop } });
  const pageSize = 100;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(
    pageCount,
    Math.max(1, Number.isFinite(requestedPage) ? Math.floor(requestedPage) : 1),
  );
  const rows = await db.retailerOrder.findMany({
    where: { shop },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
  });
  return {
    orders: rows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
      shopifyUpdatedAt: row.shopifyUpdatedAt?.toISOString() ?? null,
    })),
    page,
    pageCount,
    pageSize,
    total,
  };
}

export async function saveManualTracking(input: {
  shop: string;
  orderReference: string;
  carrier: string;
  trackingNumber: string;
  trackingUrl?: string;
  status?: string;
}) {
  const reference = input.orderReference.trim();
  const carrier = input.carrier.trim().slice(0, 80);
  const trackingNumber = input.trackingNumber.trim().slice(0, 160);
  if (!reference || !carrier || !trackingNumber) throw new Error("Tracking fields are required");
  if (input.trackingUrl && !/^https:\/\//i.test(input.trackingUrl)) throw new Error("Tracking URL must use HTTPS");
  const order = await db.retailerOrder.findFirst({
    where: { shop: input.shop, OR: [{ shopifyOrderId: reference }, { orderNumber: reference }] },
  });
  if (!order) throw new Error("Order was not found in the synchronized workspace");
  const previous = JSON.parse(order.trackingJson || "[]") as unknown[];
  const event = {
    carrier,
    number: trackingNumber,
    url: input.trackingUrl?.trim() || null,
    status: input.status?.trim().toUpperCase() || "IN_TRANSIT",
    source: "ADMIN_MANUAL",
    updatedAt: new Date().toISOString(),
  };
  const updated = await db.retailerOrder.update({
    where: { id: order.id },
    data: { trackingStatus: event.status, trackingJson: JSON.stringify([event, ...previous].slice(0, 10)), lastEvent: "MANUAL_TRACKING_UPDATED" },
  });
  return { id: updated.id, orderNumber: updated.orderNumber, tracking: event };
}
export const ORDERS_QUERY = `query CollectiveOrders($after: String, $query: String) {
  orders(first: 100, after: $after, sortKey: UPDATED_AT, query: $query) {
    nodes { id name createdAt updatedAt displayFinancialStatus displayFulfillmentStatus currencyCode
      currentTotalPriceSet { shopMoney { amount } } currentSubtotalLineItemsQuantity }
    pageInfo { hasNextPage endCursor }
  }
}`;
type OrderNode = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  displayFinancialStatus: string;
  displayFulfillmentStatus: string;
  currencyCode: string;
  currentTotalPriceSet: { shopMoney: { amount: string } };
  currentSubtotalLineItemsQuantity: number;
};
const cancelled = new Set<string>();
const active = new Map<
  string,
  Promise<{ synced: number; checkedAt: string }>
>();
export async function syncRecentShopifyOrders(
  admin: CatalogAdmin,
  shop: string,
  force = false,
) {
  const pending = active.get(shop);
  if (pending) return pending;
  cancelled.delete(shop);
  const work = reconcile(admin, shop, force);
  active.set(shop, work);
  try {
    return await work;
  } finally {
    active.delete(shop);
  }
}
async function reconcile(admin: CatalogAdmin, shop: string, force: boolean) {
  const previous = await db.catalogSyncRun.findFirst({
    where: { shop, scope: "orders", status: "COMPLETED" },
    orderBy: { startedAt: "desc" },
  });
  if (
    !force &&
    previous?.finishedAt &&
    Date.now() - previous.finishedAt.getTime() < 300000
  )
    return {
      synced: previous.upsertedCount,
      checkedAt: previous.finishedAt.toISOString(),
    };
  const startedAt = new Date();
  const since = previous
    ? new Date(previous.startedAt.getTime() - 300000)
    : new Date(startedAt.getTime() - 60 * 86400000);
  const query =
    (previous ? "updated_at" : "created_at") +
    ":>='" +
    since.toISOString() +
    "' updated_at:<='" +
    startedAt.toISOString() +
    "'";
  const run = await db.catalogSyncRun.create({
    data: {
      shop,
      scope: "orders",
      triggeredBy: force ? "merchant" : "page-reconciliation",
      startedAt,
    },
  });
  let synced = 0;
  let scanned = 0;
  let after: string | null = null;
  const seen = new Set<string>();
  try {
    for (;;) {
      if (cancelled.has(shop))
        throw new Error("Shop synchronization cancelled");
      const result: {
        orders: {
          nodes: OrderNode[];
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
        };
      } = await catalogGraphql(admin, ORDERS_QUERY, { after, query });
      if (!result.orders?.nodes || !result.orders.pageInfo)
        throw new Error("Incomplete Shopify orders response");
      if (cancelled.has(shop))
        throw new Error("Shop synchronization cancelled");
      for (const order of result.orders.nodes) {
        if (cancelled.has(shop))
          throw new Error("Shop synchronization cancelled");
        scanned++;
        const saved = await upsertRetailerOrder(shop, {
          shopifyOrderId: order.id,
          orderNumber: order.name,
          createdAt: order.createdAt,
          shopifyUpdatedAt: order.updatedAt,
          financialStatus: order.displayFinancialStatus,
          fulfillmentStatus: order.displayFulfillmentStatus,
          currency: order.currencyCode,
          totalPrice: orderNumber(
            order.currentTotalPriceSet?.shopMoney?.amount,
          ),
          lineItemCount: order.currentSubtotalLineItemsQuantity,
          lastEvent: "orders/sync",
        });
        if (saved) synced++;
      }
      if (!result.orders.pageInfo.hasNextPage) break;
      const next = result.orders.pageInfo.endCursor;
      if (!next || seen.has(next))
        throw new Error("Shopify order pagination stalled");
      seen.add(next);
      after = next;
    }
    const finishedAt = new Date();
    await db.catalogSyncRun.update({
      where: { id: run.id },
      data: {
        status: "COMPLETED",
        scannedCount: scanned,
        upsertedCount: synced,
        finishedAt,
      },
    });
    return { synced, checkedAt: finishedAt.toISOString() };
  } catch (error) {
    await db.catalogSyncRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        scannedCount: scanned,
        upsertedCount: synced,
        finishedAt: new Date(),
        errorMessage:
          "Order synchronization failed; retry after checking Shopify access.",
      },
    });
    throw error;
  }
}

export function cancelOrderSync(shop: string) {
  if (!active.has(shop)) return false;
  cancelled.add(shop);
  return true;
}
export async function startOrderSync(
  admin: CatalogAdmin,
  shop: string,
  force = false,
) {
  if (active.has(shop)) return;
  const last = await db.catalogSyncRun.findFirst({
    where: { shop, scope: "orders" },
    orderBy: { startedAt: "desc" },
  });
  if (
    !force &&
    last?.finishedAt &&
    Date.now() - last.finishedAt.getTime() < 300000
  )
    return;
  void syncRecentShopifyOrders(admin, shop, force).catch(() => {});
}
export async function getOrderSyncState(shop: string) {
  const [last, completed] = await Promise.all([
    db.catalogSyncRun.findFirst({
      where: { shop, scope: "orders" },
      orderBy: { startedAt: "desc" },
    }),
    db.catalogSyncRun.findFirst({
      where: { shop, scope: "orders", status: "COMPLETED" },
      orderBy: { startedAt: "desc" },
    }),
  ]);
  return {
    status: active.has(shop) ? "RUNNING" : (last?.status ?? "NOT_STARTED"),
    checkedAt: completed?.finishedAt?.toISOString() ?? null,
    error: last?.status === "FAILED" ? last.errorMessage : null,
  };
}
