export interface ShopifyCountMetric {
  count: number;
  precision: string;
}

export interface ShopifyRetailerMetrics {
  source: "shopify" | "unavailable";
  totalProducts: ShopifyCountMetric | null;
  activeProducts: ShopifyCountMetric | null;
  draftProducts: ShopifyCountMetric | null;
  archivedProducts: ShopifyCountMetric | null;
  productVariants: ShopifyCountMetric | null;
  error: string | null;
}

type CountPayload = {
  count?: number;
  precision?: string;
};

type MetricsPayload = {
  productsCount?: CountPayload | null;
  activeProducts?: CountPayload | null;
  draftProducts?: CountPayload | null;
  archivedProducts?: CountPayload | null;
  productVariantsCount?: CountPayload | null;
};

const toCount = (value: CountPayload | null | undefined): ShopifyCountMetric | null =>
  typeof value?.count === "number"
    ? { count: value.count, precision: value.precision ?? "UNKNOWN" }
    : null;

export async function getShopifyRetailerMetrics(
  admin: { graphql: (query: string) => Promise<Response> },
): Promise<ShopifyRetailerMetrics> {
  try {
    const response = await admin.graphql(`#graphql
      query RetailerDashboardMetrics {
        productsCount { count precision }
        activeProducts: productsCount(query: "status:active") { count precision }
        draftProducts: productsCount(query: "status:draft") { count precision }
        archivedProducts: productsCount(query: "status:archived") { count precision }
        productVariantsCount { count precision }
      }
    `);
    const payload = (await response.json()) as {
      data?: MetricsPayload;
      errors?: Array<{ message?: string }>;
    };

    if (!response.ok || payload.errors?.length || !payload.data) {
      const message = payload.errors?.map((error) => error.message).filter(Boolean).join("; ");
      throw new Error(message || `Shopify metrics HTTP ${response.status}`);
    }

    return {
      source: "shopify",
      totalProducts: toCount(payload.data.productsCount),
      activeProducts: toCount(payload.data.activeProducts),
      draftProducts: toCount(payload.data.draftProducts),
      archivedProducts: toCount(payload.data.archivedProducts),
      productVariants: toCount(payload.data.productVariantsCount),
      error: null,
    };
  } catch (error) {
    console.error("[retailer-metrics] Shopify count query failed", {
      name: error instanceof Error ? error.name : "unknown",
      message: error instanceof Error ? error.message.slice(0, 180) : "unknown",
    });

    return {
      source: "unavailable",
      totalProducts: null,
      activeProducts: null,
      draftProducts: null,
      archivedProducts: null,
      productVariants: null,
      error: "Shopify-Bestandskennzahlen sind momentan nicht erreichbar.",
    };
  }
}
