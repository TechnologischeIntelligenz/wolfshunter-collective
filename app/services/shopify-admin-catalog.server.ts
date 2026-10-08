export interface ShopifyAdminProduct {
  id: string;
  title: string;
  handle: string;
  descriptionHtml: string;
  status: string;
  vendor: string;
  productType: string;
  tags: string[];
  collections: ShopifyAdminCollection[];
  createdAt: string;
  updatedAt: string;
  totalInventory: number;
  variantCount: number;
  imageCount: number;
  images: Array<{
    url: string;
    altText: string | null;
  }>;
  priceRange: {
    minimum: number;
    maximum: number;
    currency: string;
  } | null;
}

export interface ShopifyAdminCollection {
  id: string;
  title: string;
  handle: string;
  updatedAt: string;
}

export interface ShopifyAdminCatalog {
  source: "shopify" | "unavailable";
  products: ShopifyAdminProduct[];
  collections: ShopifyAdminCollection[];
  error: string | null;
}

type ShopifyMoney = {
  amount?: string | null;
  currencyCode?: string | null;
};

type RawShopifyAdminProduct = Omit<
  ShopifyAdminProduct,
  "variantCount" | "imageCount" | "images" | "priceRange"
> & {
  mediaCount?: { count?: number | null } | null;
  variantsCount?: { count?: number | null } | null;
  media?: {
    nodes?: Array<{
      alt?: string | null;
      preview?: {
        image?: { url?: string | null; altText?: string | null } | null;
      } | null;
    }>;
  } | null;
  priceRangeV2?: {
    minVariantPrice?: ShopifyMoney | null;
    maxVariantPrice?: ShopifyMoney | null;
  } | null;
  collections?: { nodes?: ShopifyAdminCollection[] } | null;
};

type CatalogPayload = {
  products?: {
    nodes?: RawShopifyAdminProduct[];
    pageInfo?: {
      hasNextPage?: boolean | null;
      endCursor?: string | null;
    } | null;
  } | null;
  collections?: { nodes?: ShopifyAdminCollection[] } | null;
};

type ShopifyAdminGraphqlClient = {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
};

const PRODUCT_PAGE_SIZE = 250;
const DEFAULT_PRODUCT_LIMIT = 10_000;
const MAX_PRODUCT_LIMIT = 25_000;

const toNumber = (value: string | null | undefined) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const catalogProductLimit = () => {
  const configured = Number(process.env.CATALOG_PRODUCT_LIMIT);
  if (!Number.isFinite(configured) || configured <= 0) return DEFAULT_PRODUCT_LIMIT;
  return Math.min(Math.floor(configured), MAX_PRODUCT_LIMIT);
};

function normalizeProduct(product: RawShopifyAdminProduct): ShopifyAdminProduct {
  const images = (product.media?.nodes ?? [])
    .map((media) => ({
      url: media.preview?.image?.url?.trim() ?? "",
      altText: media.alt ?? media.preview?.image?.altText ?? null,
    }))
    .filter((image) => image.url);
  const minimum = toNumber(product.priceRangeV2?.minVariantPrice?.amount);
  const maximum = toNumber(product.priceRangeV2?.maxVariantPrice?.amount);
  const currency =
    product.priceRangeV2?.minVariantPrice?.currencyCode ??
    product.priceRangeV2?.maxVariantPrice?.currencyCode;

  return {
    id: product.id,
    title: product.title,
    handle: product.handle,
    descriptionHtml: product.descriptionHtml ?? "",
    status: product.status,
    vendor: product.vendor,
    productType: product.productType,
    tags: product.tags ?? [],
    collections: product.collections?.nodes ?? [],
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
    totalInventory: Math.max(0, product.totalInventory ?? 0),
    variantCount: product.variantsCount?.count ?? 0,
    imageCount: product.mediaCount?.count ?? images.length,
    images,
    priceRange:
      minimum !== null && maximum !== null && currency
        ? { minimum, maximum, currency }
        : null,
  };
}

export async function getShopifyAdminCatalog(
  admin: ShopifyAdminGraphqlClient,
): Promise<ShopifyAdminCatalog> {
  try {
    const products: ShopifyAdminProduct[] = [];
    let collections: ShopifyAdminCollection[] = [];
    let cursor: string | null = null;
    let includeCollections = true;
    const productLimit = catalogProductLimit();

    while (products.length < productLimit) {
      const response = await admin.graphql(
        `#graphql
      query WolfshunterAdminCatalog($first: Int!, $after: String, $includeCollections: Boolean!) {
        products(first: $first, after: $after, sortKey: UPDATED_AT, reverse: true) {
          nodes {
            id
            title
            handle
            descriptionHtml
            status
            vendor
            productType
            tags
            createdAt
            updatedAt
            totalInventory
            variantsCount { count }
            mediaCount { count }
            priceRangeV2 {
              minVariantPrice { amount currencyCode }
              maxVariantPrice { amount currencyCode }
            }
            collections(first: 20) {
              nodes {
                id
                title
                handle
                updatedAt
              }
            }
            media(first: 10, query: "media_type:IMAGE", sortKey: POSITION) {
              nodes {
                alt
                preview { image { url altText } }
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
        collections(first: 25) @include(if: $includeCollections) {
          nodes {
            id
            title
            handle
            updatedAt
          }
        }
      }
    `,
        {
          variables: {
            first: Math.min(PRODUCT_PAGE_SIZE, productLimit - products.length),
            after: cursor,
            includeCollections,
          },
        },
      );
      const payload = (await response.json()) as {
        data?: CatalogPayload;
        errors?: Array<{ message?: string }>;
      };

      if (!response.ok || payload.errors?.length || !payload.data) {
        const message = payload.errors
          ?.map((error) => error.message)
          .filter(Boolean)
          .join("; ");
        throw new Error(message || `Shopify catalog HTTP ${response.status}`);
      }

      if (includeCollections) {
        collections = payload.data.collections?.nodes ?? [];
        includeCollections = false;
      }

      const remaining = productLimit - products.length;
      products.push(
        ...(payload.data.products?.nodes ?? [])
          .slice(0, remaining)
          .map(normalizeProduct),
      );

      const pageInfo = payload.data.products?.pageInfo;
      if (!pageInfo?.hasNextPage || !pageInfo.endCursor) break;
      cursor = pageInfo.endCursor;
    }

    return {
      source: "shopify",
      products,
      collections,
      error: null,
    };
  } catch (error) {
    console.error("[admin-catalog] Shopify read-only catalog query failed", {
      name: error instanceof Error ? error.name : "unknown",
      message: error instanceof Error ? error.message.slice(0, 180) : "unknown",
    });

    return {
      source: "unavailable",
      products: [],
      collections: [],
      error: "Der Shopify-Katalog ist momentan nicht erreichbar.",
    };
  }
}
