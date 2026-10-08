export type CountryCode = string;

export interface TenantContext {
  tenantId: string;
  shopDomain: string;
  destinationCountry: CountryCode;
  compatibleWarehouses: string[];
  preferredCategories: string[];
  asOf: string;
}

export interface RetailerAffinitySignals {
  favoriteProductIds: string[];
  importedProductIds: string[];
  orderedCategoryCounts: Record<string, number>;
}

export interface CatalogProduct {
  id: string;
  tenantId: string;
  title: string;
  category: string;
  descriptionHtml: string | null;
  collections: Array<{
    id: string;
    title: string;
    handle: string;
  }>;
  wholesalePrice: number;
  recommendedRetailPrice: number;
  currency: string;
  imageUrl: string | null;
  imageUrls: string[];
  imageCount: number;
  variantImageUrls: string[];
  variantCount: number;
  warehouse: string;
  shipFromCountry: CountryCode;
  estimatedDeliveryDays: number | null;
  deliveryEstimateLabel?: string;
  dispatchDays: number | null;
  availableToSell: number;
  stockConfidence: number;
  primaryImageAvailable: boolean;
  variantCompleteness: number;
  categoryAvailable: boolean;
  mappingQuality: number;
  dataCompleteness: number;
  selection: "standard" | "premium" | "exclusive";
  createdAt: string;
}

export type RecommendationBucket =
  | "RECOMMENDED_FOR_STORE"
  | "FAST_SHIPPING"
  | "HIGH_MARGIN"
  | "NEW_ARRIVALS"
  | "PREMIUM_SELECTION";

export const RECOMMENDATION_BUCKET_LABELS: Record<
  RecommendationBucket,
  string
> = {
  RECOMMENDED_FOR_STORE: "Recommended for your store",
  FAST_SHIPPING: "Fast shipping to your market",
  HIGH_MARGIN: "High margin",
  NEW_ARRIVALS: "New arrivals",
  PREMIUM_SELECTION: "Premium selection",
};

export type CatalogSort =
  | "RECOMMENDED"
  | "HIGHEST_MARGIN"
  | "FASTEST_DELIVERY"
  | "HIGHEST_STOCK"
  | "NEWEST"
  | "LOWEST_WHOLESALE_PRICE";

export interface ScoreBreakdown {
  marketFit: number;
  delivery: number;
  economics: number;
  inventory: number;
  catalogQuality: number;
  retailerAffinity: number;
  recency: number;
}

export interface MerchantProductScore {
  tenantId: string;
  productId: string;
  score: number;
  grossMarginAmount: number;
  grossMarginPercent: number;
  breakdown: ScoreBreakdown;
  reasons: string[];
  buckets: RecommendationBucket[];
}

export type RecommendationProviderKind =
  | "RULE_BASED"
  | "SHOPIFY_SUPPORTED"
  | "LOCAL_MODEL"
  | "OPTIONAL_EXTERNAL_AI";

export interface RecommendationRequest {
  tenant: TenantContext;
  products: CatalogProduct[];
  affinity: RetailerAffinitySignals;
  bucket?: RecommendationBucket;
  sort: CatalogSort;
}

export interface RankedProduct {
  product: CatalogProduct;
  score: MerchantProductScore;
}

export interface RecommendationResult {
  tenantId: string;
  provider: RecommendationProviderKind;
  generatedAt: string;
  products: RankedProduct[];
}

export interface RecommendationProvider {
  readonly kind: RecommendationProviderKind;
  recommend(request: RecommendationRequest): RecommendationResult;
}
