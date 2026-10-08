import { createHash } from "node:crypto";
import db from "../db.server.ts";
import { canonicalOrderId, orderIdAliases } from "./order-normalization.ts";

const DOMAIN = "privacy-request";
export function privacyOrderIds(value: unknown) {
  if (!Array.isArray(value))
    throw new Error("Privacy request is missing its order list");
  const ids = value.map(canonicalOrderId);
  if (ids.some((id) => !id)) throw new Error("Invalid order reference");
  return [...new Set(ids as string[])];
}
export async function redactOrders(shop: string, ids: string[]) {
  await db.$transaction(async (tx) => {
    for (const id of ids) {
      // Keep a minimal suppression marker so reconciliation cannot restore erased data.
      await tx.knowledgeDocument.upsert({
        where: {
          shop_domain_sourceKey: {
            shop,
            domain: "order-redaction",
            sourceKey: id,
          },
        },
        create: {
          shop,
          domain: "order-redaction",
          sourceKey: id,
          title: "Order suppression",
          body: "",
          bodyHash: createHash("sha256").update(id).digest("hex"),
        },
        update: { body: "" },
      });
    }
    await tx.retailerOrder.deleteMany({
      where: { shop, shopifyOrderId: { in: ids.flatMap(orderIdAliases) } },
    });
  });
}
export async function receivePrivacyRequest(
  shop: string,
  topic: string,
  payload: unknown,
  webhookId: string,
) {
  if (!payload || typeof payload !== "object")
    throw new Error("Invalid privacy payload");
  const value = payload as {
    orders_requested?: unknown;
    orders_to_redact?: unknown;
    data_request?: { id?: unknown };
  };
  const ids = privacyOrderIds(
    topic === "CUSTOMERS_REDACT"
      ? value.orders_to_redact
      : value.orders_requested,
  );
  const key = topic + ":" + String(value.data_request?.id ?? webhookId);
  if (!webhookId) throw new Error("Missing webhook identifier");
  // Persist before processing; a failed deletion is retried rather than acknowledged as done.
  await db.knowledgeDocument.upsert({
    where: { shop_domain_sourceKey: { shop, domain: DOMAIN, sourceKey: key } },
    create: {
      shop,
      domain: DOMAIN,
      sourceKey: key,
      title: topic,
      body: JSON.stringify(ids),
      bodyHash: createHash("sha256").update(JSON.stringify(ids)).digest("hex"),
      metadataJson: JSON.stringify({
        status: "NEEDS_REVIEW",
        receivedAt: new Date().toISOString(),
      }),
    },
    update: {},
  });
  if (topic === "CUSTOMERS_REDACT") await redactOrders(shop, ids);
}
export async function getPrivacyRequests(shop: string) {
  const requests = await db.knowledgeDocument.findMany({
    where: {
      shop,
      domain: DOMAIN,
      metadataJson: { contains: '"status":"NEEDS_REVIEW"' },
    },
    orderBy: { createdAt: "asc" },
    take: 100,
  });
  return requests.map((row) => ({
    id: row.id,
    requestReference: row.sourceKey,
    topic: row.title,
    createdAt: row.createdAt.toISOString(),
    status: (JSON.parse(row.metadataJson) as { status: string }).status,
    orderCount: (JSON.parse(row.body) as string[]).length,
  }));
}
export async function exportPrivacyRequest(shop: string, id: number) {
  const request = await db.knowledgeDocument.findFirst({
    where: { id, shop, domain: DOMAIN },
  });
  if (!request) throw new Response("Not found", { status: 404 });
  const ids = privacyOrderIds(JSON.parse(request.body));
  const orders = await db.retailerOrder.findMany({
    where: { shop, shopifyOrderId: { in: ids.flatMap(orderIdAliases) } },
    select: {
      shopifyOrderId: true,
      orderNumber: true,
      createdAt: true,
      shopifyUpdatedAt: true,
      financialStatus: true,
      fulfillmentStatus: true,
      currency: true,
      totalPrice: true,
      lineItemCount: true,
    },
  });
  return {
    requestId: request.sourceKey,
    shop,
    topic: request.title,
    generatedAt: new Date().toISOString(),
    requestedOrderIds: ids,
    orders,
    reviewRequired:
      "Review support conversations for additional related data before delivering an access response or confirming erasure. This download does not send a response to the customer.",
    supportReviewUrl: "/app/support",
  };
}
export async function completePrivacyRequest(shop: string, id: number) {
  const request = await db.knowledgeDocument.findFirst({
    where: { id, shop, domain: DOMAIN },
  });
  if (!request) throw new Response("Not found", { status: 404 });
  const metadata = JSON.parse(request.metadataJson);
  await db.knowledgeDocument.update({
    where: { id: request.id },
    data: {
      metadataJson: JSON.stringify({
        ...metadata,
        status: "COMPLETED",
        completedAt: new Date().toISOString(),
      }),
    },
  });
}
