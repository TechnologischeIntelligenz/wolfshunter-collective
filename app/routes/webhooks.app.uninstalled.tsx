import type { ActionFunctionArgs } from "react-router";
import { authenticateStoredWebhook } from "../services/webhook-auth.server";
import { deleteShopData } from "../services/tenant-data.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, session, topic } = await authenticateStoredWebhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // Webhook requests can trigger multiple times and after an app has already
  // been uninstalled. deleteMany makes this safe to retry.
  if (session || topic === "APP_UNINSTALLED") {
    await deleteShopData(shop);
  }

  return new Response();
};
