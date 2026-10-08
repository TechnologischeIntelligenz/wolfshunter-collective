import type { ActionFunctionArgs } from "react-router";
import { authenticateStoredWebhook } from "../services/webhook-auth.server";
import { deleteShopData } from "../services/tenant-data.server";
import { receivePrivacyRequest } from "../services/privacy-requests.server";
export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, payload, webhookId } =
    await authenticateStoredWebhook(request);
  if (topic === "CUSTOMERS_DATA_REQUEST" || topic === "CUSTOMERS_REDACT") {
    await receivePrivacyRequest(shop, topic, payload, webhookId);
    return new Response(null, { status: 200 });
  }
  if (topic === "SHOP_REDACT") {
    await deleteShopData(shop);
    return new Response(null, { status: 200 });
  }
  return new Response("Unsupported compliance topic", { status: 400 });
};
