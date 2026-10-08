import { FoundationNotice, PageHeader, SectionHeading, StatusPill } from "../../components/collective/foundation";
import type { RetailerOrderRecord } from "../../services/retailer-orders.server";

function money(value: number | null, currency: string | null) {
  if (value === null) return "—";
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: currency || "EUR",
  }).format(value);
}

function statusLabel(value: string | null) {
  return value?.replaceAll("_", " ").toLowerCase() || "unknown";
}

export function OrdersView({
  shop,
  orders,
}: {
  shop: string;
  orders: RetailerOrderRecord[];
}) {
  return (
    <main className="collective-page">
      <PageHeader
        eyebrow="Retailer orders"
        title="Orders"
        description="Recent Shopify orders are synchronized into this tenant-scoped workspace for the retailer. Supplier routing is not active in V1."
        actions={<StatusPill tone="positive">Read-only sync</StatusPill>}
      />
      <FoundationNotice>
        Connected shop: {shop}. The first sync stores order status, totals, line
        quantities, and timestamps only. Customer names, contact details,
        addresses, notes, and payment details are not stored.
      </FoundationNotice>

      <section className="collective-section">
        <SectionHeading
          title="Recent Shopify orders"
          description="Reconciliation follows all available pages in the standard 60-day Shopify access window. Later checks fetch changes; webhook updates apply when the subscriptions are active."
        />
        {orders.length ? (
          <div className="collective-table-wrap">
            <table className="collective-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Created</th>
                  <th>Financial</th>
                  <th>Fulfillment</th>
                  <th>Lines</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.shopifyOrderId}>
                    <td>
                      <strong>{order.orderNumber || order.shopifyOrderId}</strong>
                      <small>{order.syncStatus}</small>
                    </td>
                    <td>{new Date(order.createdAt).toLocaleString()}</td>
                    <td>{statusLabel(order.financialStatus)}</td>
                    <td>{statusLabel(order.fulfillmentStatus)}</td>
                    <td>{order.lineItemCount}</td>
                    <td>{money(order.totalPrice, order.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="collective-inline-empty">
            <strong>No orders synchronized yet.</strong>
            <span>New orders will appear after Shopify delivers the order webhook.</span>
          </div>
        )}
      </section>
    </main>
  );
}
