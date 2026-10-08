import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { getRetailerOrders, getOrderSyncState, saveManualTracking } from "../services/retailer-orders.server";
import { isAppAdminSession } from "../services/app-admin.server";
import { authenticate } from "../shopify.server";

export async function action({ request }: { request: Request }) {
  const { session } = await authenticate.admin(request);
  if (!isAppAdminSession(session)) throw new Response("Forbidden", { status: 403 });
  const form = await request.formData();
  try {
    const result = await saveManualTracking({
      shop: session.shop,
      orderReference: String(form.get("orderReference") ?? ""),
      carrier: String(form.get("carrier") ?? ""),
      trackingNumber: String(form.get("trackingNumber") ?? ""),
      trackingUrl: String(form.get("trackingUrl") ?? ""),
      status: String(form.get("status") ?? "IN_TRANSIT"),
    });
    return Response.json({ ok: true, result });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "Tracking update failed" }, { status: 400 });
  }
}

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const sync = await getOrderSyncState(session.shop);
  return {
    shop: session.shop,
    ...(await getRetailerOrders(session.shop)),
    syncError: sync.error,
    checkedAt: sync.checkedAt,
  };
}

function statusLabel(value: string | null) {
  return value?.replaceAll("_", " ").toLowerCase() || "unknown";
}

export default function TrackingRoute() {
  const data = useLoaderData<typeof loader>();
  return (
    <main className="collective-page">
      <header className="collective-page-header">
        <div><small>Shipment visibility</small><h1>Tracking</h1><p>Verified Shopify fulfillment status for {data.shop}. Carrier events will appear when Shopify provides tracking details.</p></div>
      </header>
      {data.syncError ? <p role="alert">{data.syncError}</p> : null}
      <section className="collective-section">
        <h2>Admin tracking control</h2>
        <p>Enter a synchronized order reference and tracking number. Supplier identity is never shown to customers.</p>
        <form method="post" className="collective-settings-grid">
          <input name="orderReference" placeholder="#1001 or Shopify order ID" required />
          <input name="carrier" placeholder="Carrier" required />
          <input name="trackingNumber" placeholder="Tracking number" required />
          <input name="trackingUrl" type="url" placeholder="https://carrier.example/track/..." />
          <select name="status" defaultValue="IN_TRANSIT"><option value="IN_TRANSIT">In transit</option><option value="LABEL_CREATED">Label created</option><option value="DELIVERED">Delivered</option><option value="EXCEPTION">Exception</option></select>
          <button className="collective-button collective-button-primary" type="submit">Save tracking</button>
        </form>
      </section>
      <section className="collective-section">
        {data.orders.length ? <div className="collective-table-wrap"><table className="collective-table"><thead><tr><th>Order</th><th>Tracking</th><th>Fulfillment</th><th>Financial</th><th>Updated</th></tr></thead><tbody>{data.orders.map((order) => <tr key={order.shopifyOrderId}><td><strong>{order.orderNumber || order.shopifyOrderId}</strong></td><td>{statusLabel(order.trackingStatus)}</td><td>{statusLabel(order.fulfillmentStatus)}</td><td>{statusLabel(order.financialStatus)}</td><td>{order.shopifyUpdatedAt ? new Date(order.shopifyUpdatedAt).toLocaleString() : "—"}</td></tr>)}</tbody></table></div> : <div className="collective-inline-empty"><strong>No synchronized orders yet.</strong><span>Tracking becomes available after Shopify reports an order fulfillment.</span></div>}
      </section>
    </main>
  );
}
