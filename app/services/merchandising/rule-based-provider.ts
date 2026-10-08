import type {
  CatalogProduct,
  CatalogSort,
  MerchantProductScore,
  RecommendationBucket,
  RecommendationProvider,
  RecommendationRequest,
  RecommendationResult,
  RetailerAffinitySignals,
  TenantContext,
} from "./types";

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

const round = (value: number, decimals = 0) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const daysBetween = (left: string, right: string) => {
  const milliseconds = new Date(left).getTime() - new Date(right).getTime();
  return Math.floor(milliseconds / 86_400_000);
};

const isNewArrival = (product: CatalogProduct, tenant: TenantContext) => {
  const ageInDays = daysBetween(tenant.asOf, product.createdAt);
  return ageInDays >= 0 && ageInDays <= 30;
};

const scoreMarketFit = (tenant: TenantContext, product: CatalogProduct) => {
  const countryFit = product.shipFromCountry === tenant.destinationCountry ? 12 : 4;
  const warehouseFit = tenant.compatibleWarehouses.includes(product.warehouse)
    ? 8
    : 0;
  return countryFit + warehouseFit;
};

const scoreDelivery = (product: CatalogProduct) => {
  const deliveryScore = product.estimatedDeliveryDays === null ? 0 :
    product.estimatedDeliveryDays <= 3
      ? 13
      : product.estimatedDeliveryDays <= 5
        ? 11
        : product.estimatedDeliveryDays <= 8
          ? 8
          : product.estimatedDeliveryDays <= 12
            ? 4
            : 1;
  const dispatchScore =
    product.dispatchDays === null ? 0 : product.dispatchDays <= 1 ? 5 : product.dispatchDays <= 2 ? 3 : 1;
  return deliveryScore + dispatchScore;
};

const getMargin = (product: CatalogProduct) => {
  const amount = Math.max(
    0,
    product.recommendedRetailPrice - product.wholesalePrice,
  );
  const percent =
    product.recommendedRetailPrice > 0
      ? (amount / product.recommendedRetailPrice) * 100
      : 0;
  return { amount: round(amount, 2), percent: round(percent, 1) };
};

const scoreEconomics = (product: CatalogProduct) => {
  const margin = getMargin(product);
  const percentageScore = clamp((margin.percent / 50) * 14, 0, 14);
  const amountScore = clamp((margin.amount / 60) * 8, 0, 8);
  return round(percentageScore + amountScore);
};

const scoreInventory = (product: CatalogProduct) => {
  const stockScore =
    product.availableToSell >= 100
      ? 10
      : product.availableToSell >= 50
        ? 8
        : product.availableToSell >= 20
          ? 6
          : product.availableToSell >= 8
            ? 3
            : product.availableToSell > 0
              ? 1
              : 0;
  return round(stockScore + clamp(product.stockConfidence, 0, 1) * 6);
};

const scoreCatalogQuality = (product: CatalogProduct) =>
  round(
    (product.primaryImageAvailable ? 4 : 0) +
      clamp(product.variantCompleteness, 0, 1) * 3 +
      (product.categoryAvailable ? 3 : 0) +
      clamp(product.mappingQuality, 0, 1) * 4 +
      clamp(product.dataCompleteness, 0, 1) * 2,
  );

const scoreAffinity = (
  tenant: TenantContext,
  product: CatalogProduct,
  affinity: RetailerAffinitySignals,
) => {
  const preferredCategory = tenant.preferredCategories.includes(product.category)
    ? 2
    : 0;
  const favorite = affinity.favoriteProductIds.includes(product.id) ? 1 : 0;
  const imported = affinity.importedProductIds.includes(product.id) ? 1 : 0;
  const orderedCategory = (affinity.orderedCategoryCounts[product.category] ?? 0) > 0
    ? 1
    : 0;
  return preferredCategory + favorite + imported + orderedCategory;
};

const deriveBuckets = (
  tenant: TenantContext,
  product: CatalogProduct,
  score: number,
  marginPercent: number,
  marginAmount: number,
): RecommendationBucket[] => {
  const buckets: RecommendationBucket[] = [];

  if (score >= 58) buckets.push("RECOMMENDED_FOR_STORE");
  if (
    product.estimatedDeliveryDays !== null && product.estimatedDeliveryDays <= 7 &&
    (product.shipFromCountry === tenant.destinationCountry ||
      tenant.compatibleWarehouses.includes(product.warehouse))
  ) {
    buckets.push("FAST_SHIPPING");
  }
  if (marginPercent >= 35 && marginAmount >= 20) buckets.push("HIGH_MARGIN");
  if (isNewArrival(product, tenant)) buckets.push("NEW_ARRIVALS");
  if (product.selection !== "standard" && product.dataCompleteness >= 0.85) {
    buckets.push("PREMIUM_SELECTION");
  }

  return buckets;
};

export const scoreMerchantProduct = (
  tenant: TenantContext,
  product: CatalogProduct,
  affinity: RetailerAffinitySignals,
): MerchantProductScore => {
  if (!tenant.tenantId || product.tenantId !== tenant.tenantId) {
    throw new Error("Tenant mismatch while scoring catalog product");
  }

  const margin = getMargin(product);
  const breakdown = {
    marketFit: scoreMarketFit(tenant, product),
    delivery: scoreDelivery(product),
    economics: scoreEconomics(product),
    inventory: scoreInventory(product),
    catalogQuality: scoreCatalogQuality(product),
    retailerAffinity: scoreAffinity(tenant, product, affinity),
    recency: isNewArrival(product, tenant) ? 3 : 0,
  };
  const score = clamp(
    Object.values(breakdown).reduce((sum, value) => sum + value, 0),
    0,
    100,
  );
  const reasons: string[] = [];

  if (breakdown.marketFit >= 16) reasons.push("Strong market and warehouse fit");
  if (product.estimatedDeliveryDays !== null && product.estimatedDeliveryDays <= 5) reasons.push("Fast estimated delivery");
  if (margin.percent >= 40) reasons.push("Healthy potential margin");
  if (product.availableToSell >= 50 && product.stockConfidence >= 0.85) {
    reasons.push("Healthy stock signal");
  }
  if (breakdown.catalogQuality >= 13) reasons.push("Complete catalog data");
  if (breakdown.retailerAffinity > 0) reasons.push("Matches retailer preferences");
  if (isNewArrival(product, tenant)) reasons.push("Genuinely new catalog arrival");

  return {
    tenantId: tenant.tenantId,
    productId: product.id,
    score,
    grossMarginAmount: margin.amount,
    grossMarginPercent: margin.percent,
    breakdown,
    reasons,
    buckets: deriveBuckets(
      tenant,
      product,
      score,
      margin.percent,
      margin.amount,
    ),
  };
};

const compareRankedProducts = (sort: CatalogSort) => {
  return (
    left: ReturnType<typeof toRankedProduct>,
    right: ReturnType<typeof toRankedProduct>,
  ) => {
    let difference = 0;
    switch (sort) {
      case "HIGHEST_MARGIN":
        difference = right.score.grossMarginPercent - left.score.grossMarginPercent;
        break;
      case "FASTEST_DELIVERY":
        difference =
          (left.product.estimatedDeliveryDays ?? 9999) - (right.product.estimatedDeliveryDays ?? 9999);
        break;
      case "HIGHEST_STOCK":
        difference = right.product.availableToSell - left.product.availableToSell;
        break;
      case "NEWEST":
        difference =
          new Date(right.product.createdAt).getTime() -
          new Date(left.product.createdAt).getTime();
        break;
      case "LOWEST_WHOLESALE_PRICE":
        difference = left.product.wholesalePrice - right.product.wholesalePrice;
        break;
      case "RECOMMENDED":
      default:
        difference = right.score.score - left.score.score;
    }
    return difference || left.product.id.localeCompare(right.product.id);
  };
};

const toRankedProduct = (
  tenant: TenantContext,
  product: CatalogProduct,
  affinity: RetailerAffinitySignals,
) => ({ product, score: scoreMerchantProduct(tenant, product, affinity) });

export class RuleBasedRecommendationProvider implements RecommendationProvider {
  readonly kind = "RULE_BASED" as const;

  recommend(request: RecommendationRequest): RecommendationResult {
    const ranked = request.products
      .map((product) => toRankedProduct(request.tenant, product, request.affinity))
      .filter(
        (rankedProduct) =>
          !request.bucket || rankedProduct.score.buckets.includes(request.bucket),
      )
      .sort(compareRankedProducts(request.sort));

    return {
      tenantId: request.tenant.tenantId,
      provider: this.kind,
      generatedAt: request.tenant.asOf,
      products: ranked,
    };
  }
}

export const createRecommendationProvider = (): RecommendationProvider =>
  new RuleBasedRecommendationProvider();
