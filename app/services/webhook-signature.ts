import { createHmac, timingSafeEqual } from "node:crypto";

/** Verify the original body without requiring a usable Admin API access token. */
export async function verifyWebhook(request: Request, secret = process.env.SHOPIFY_API_SECRET) {
  if (request.method !== "POST") throw new Response("Method not allowed", {status:405,headers:{Allow:"POST"}});
  if (!secret) throw new Response("Webhook authentication unavailable",{status:503});
  const raw = Buffer.from(await request.arrayBuffer());
  const signature = Buffer.from(request.headers.get("x-shopify-hmac-sha256") ?? "", "base64");
  const expected = createHmac("sha256",secret).update(raw).digest();
  if (signature.length !== expected.length || !timingSafeEqual(signature,expected)) throw new Response("Unauthorized",{status:401});
  const shop = request.headers.get("x-shopify-shop-domain") ?? "";
  const topic = request.headers.get("x-shopify-topic") ?? "";
  const webhookId = request.headers.get("x-shopify-webhook-id") ?? "";
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop) || !topic || !webhookId) throw new Response("Invalid webhook headers",{status:400});
  let payload;
  try { payload=JSON.parse(raw.toString("utf8")); } catch { throw new Response("Invalid JSON",{status:400}); }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Response("Invalid webhook payload",{status:400});
  if (payload.shop_domain && payload.shop_domain !== shop) throw new Response("Shop mismatch",{status:400});
  return {shop,topic:topic.toUpperCase().replace(/[/.]/g,"_"),webhookId,payload};
}