import type { ActionFunctionArgs } from "react-router";
import { authenticateStoredWebhook } from "../services/webhook-auth.server";
import {
  normalizeOrderWebhook,
  upsertRetailerOrder,
} from "../services/retailer-orders.server";
import { canonicalOrderId } from "../services/order-normalization";
import { redactOrders } from "../services/privacy-requests.server";
const topics = new Set([
  "ORDERS_CREATE",
  "ORDERS_UPDATED",
  "ORDERS_PAID",
  "ORDERS_CANCELLED",
  "ORDERS_FULFILLED",
  "ORDERS_PARTIALLY_FULFILLED",
  "ORDERS_DELETE",
]);
export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, payload, session } = await authenticateStoredWebhook(request);
  if (!topics.has(topic))
    return new Response("Unsupported order topic", { status: 400 });
  // Ignore late deliveries after uninstall; the SDK has already verified the HMAC.
  if (!session) return new Response(null, { status: 200 });
  if (topic === "ORDERS_DELETE") {
    const id = canonicalOrderId(payload.admin_graphql_api_id ?? payload.id);
    if (!id) return new Response("Invalid order identifier", { status: 400 });
    await redactOrders(shop, [id]);
  } else {
    const order = normalizeOrderWebhook(payload, topic);
    if (!order) return new Response("Invalid order payload", { status: 400 });
    await upsertRetailerOrder(shop, order);
  }
  return new Response(null, { status: 200 });
};
