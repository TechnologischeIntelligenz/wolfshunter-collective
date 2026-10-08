export function canonicalOrderId(value: unknown): string | null {
  if (typeof value === "number" && (!Number.isSafeInteger(value) || value <= 0))
    return null;
  if (typeof value !== "string" && typeof value !== "number") return null;
  const match = (
    String(value).startsWith("gid://shopify/Order/")
      ? String(value).slice(20)
      : String(value)
  ).match(/^([1-9][0-9]*)$/);
  return match ? "gid://shopify/Order/" + match[1] : null;
}
export function orderIdAliases(id: string) {
  return [id, id.split("/").pop()!];
}
export function validOrderDate(value: unknown) {
  if (typeof value !== "string" || !value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
export function orderNumber(value: unknown): number | null {
  if ((typeof value !== "number" && typeof value !== "string") || value === "")
    return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
export type OrderInput = {
  shopifyOrderId: string;
  orderNumber?: string | null;
  createdAt?: string | null;
  shopifyUpdatedAt: string;
  financialStatus?: string | null;
  fulfillmentStatus?: string | null;
  currency?: string | null;
  totalPrice?: number | null;
  lineItemCount?: number;
  lastEvent?: string;
};
export function normalizeOrderWebhook(
  payload: unknown,
  topic: string,
): OrderInput | null {
  if (!payload || typeof payload !== "object") return null;
  const order = payload as Record<string, unknown>;
  const id = canonicalOrderId(order.admin_graphql_api_id ?? order.id);
  const updated = validOrderDate(order.updated_at);
  if (!id || !updated) return null;
  const text = (value: unknown) => (typeof value === "string" ? value : null);
  const lines = Array.isArray(order.line_items)
    ? order.line_items.filter((line) => line && typeof line === "object")
    : [];
  return {
    shopifyOrderId: id,
    orderNumber: text(order.name),
    createdAt: text(order.created_at),
    shopifyUpdatedAt: updated.toISOString(),
    financialStatus: text(order.financial_status)?.toUpperCase() ?? null,
    fulfillmentStatus:
      text(order.fulfillment_status)?.toUpperCase() ?? "UNFULFILLED",
    currency: text(order.currency),
    totalPrice: orderNumber(order.current_total_price ?? order.total_price),
    lineItemCount: lines.reduce(
      (sum, line) =>
        sum +
        Math.max(0, orderNumber(line.current_quantity ?? line.quantity) ?? 0),
      0,
    ),
    lastEvent: topic,
  };
}
