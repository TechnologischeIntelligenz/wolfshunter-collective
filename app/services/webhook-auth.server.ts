import db from "../db.server.ts";
import { verifyWebhook } from "./webhook-signature.ts";
export async function authenticateStoredWebhook(request: Request) {
  const verified=await verifyWebhook(request);
  // Expired/revoked tokens must not block signed uninstall or privacy deliveries.
  const session=await db.session.findUnique({where:{id:`offline_${verified.shop}`}});
  return {...verified,session};
}