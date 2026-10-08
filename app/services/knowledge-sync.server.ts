import { createHash } from "node:crypto";

import db from "../db.server.ts";
import { getCatalogSourceShop } from "./app-admin.server.ts";
import type {
  ShopifyAdminCatalog,
  ShopifyAdminProduct,
} from "./shopify-admin-catalog.server";

type AdminLike = {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
};

type PolicyNode = {
  id?: string;
  title?: string | null;
  body?: string | null;
  type?: string | null;
  url?: string | null;
  updatedAt?: string | null;
};

type ShopifyPoliciesPayload = {
  shop?: {
    name?: string | null;
    myshopifyDomain?: string | null;
    shopPolicies?: PolicyNode[] | null;
  } | null;
};

const stableHash = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

const stripHtml = (value: string | null | undefined) =>
  (value ?? "")
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();

const parseDate = (value: string | null | undefined) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const productCollectionsJson = (product: ShopifyAdminProduct) =>
  JSON.stringify(
    product.collections.map((collection) => ({
      id: collection.id,
      title: collection.title,
      handle: collection.handle,
    })),
  );

const productImageUrlsJson = (product: ShopifyAdminProduct) =>
  JSON.stringify(product.images.map((image) => image.url));

const safeJsonArray = <T>(value: string): T[] => {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
};

const searchTokens = (message: string) => {
  const stopWords = new Set([
    "bitte",
    "kann",
    "kannst",
    "shopify",
    "wolfshunter",
    "collective",
    "produkt",
    "produkte",
    "order",
    "tracking",
    "hilfe",
  ]);

  return [
    ...new Set(
      message
        .toLowerCase()
        .split(/[^a-z0-9äöüß]+/i)
        .map((token) => token.trim())
        .filter((token) => token.length >= 3 && !stopWords.has(token)),
    ),
  ];
};

async function upsertKnowledgeDocument(input: {
  shop: string;
  domain: string;
  sourceKey: string;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
}) {
  const bodyHash = stableHash({
    title: input.title,
    body: input.body,
    metadata: input.metadata ?? {},
  });

  return db.knowledgeDocument.upsert({
    where: {
      shop_domain_sourceKey: {
        shop: input.shop,
        domain: input.domain,
        sourceKey: input.sourceKey,
      },
    },
    create: {
      shop: input.shop,
      domain: input.domain,
      sourceKey: input.sourceKey,
      title: input.title,
      body: input.body,
      bodyHash,
      metadataJson: JSON.stringify(input.metadata ?? {}),
      lastSyncedAt: new Date(),
    },
    update: {
      title: input.title,
      body: input.body,
      bodyHash,
      metadataJson: JSON.stringify(input.metadata ?? {}),
      lastSyncedAt: new Date(),
    },
  });
}

export async function syncCatalogKnowledgeFromSnapshot(input: {
  catalog: ShopifyAdminCatalog;
  sourceShop?: string | null;
  triggeredBy?: string;
}) {
  const sourceShop = input.sourceShop ?? getCatalogSourceShop() ?? "unknown";
  if (sourceShop !== getCatalogSourceShop())
    throw new Error("Only the source shop can synchronize this catalog");
  if (input.catalog.source !== "shopify" || input.catalog.error)
    throw new Error("Cannot synchronize an unavailable catalog");
  const run = await db.catalogSyncRun.create({
    data: {
      shop: sourceShop,
      scope: "catalog",
      triggeredBy: input.triggeredBy ?? "admin",
    },
  });

  try {
    let upsertedCount = 0;
    for (const product of input.catalog.products) {
      const descriptionText = stripHtml(product.descriptionHtml);
      const contentHash = stableHash({
        id: product.id,
        title: product.title,
        handle: product.handle,
        status: product.status,
        vendor: product.vendor,
        productType: product.productType,
        tags: product.tags,
        collections: product.collections,
        descriptionText,
        images: product.images.map((image) => image.url),
        priceRange: product.priceRange,
        totalInventory: product.totalInventory,
        variantCount: product.variantCount,
        imageCount: product.imageCount,
        updatedAt: product.updatedAt,
      });

      await db.catalogKnowledgeProduct.upsert({
        where: { sourceProductId: product.id },
        create: {
          sourceProductId: product.id,
          sourceShop,
          title: product.title,
          handle: product.handle,
          status: product.status,
          vendor: product.vendor,
          productType: product.productType,
          category: product.productType || "General",
          descriptionHtml: product.descriptionHtml,
          descriptionText,
          collectionsJson: productCollectionsJson(product),
          imageUrlsJson: productImageUrlsJson(product),
          tagsJson: JSON.stringify(product.tags),
          priceMinimum: product.priceRange?.minimum ?? null,
          priceMaximum: product.priceRange?.maximum ?? null,
          currency: product.priceRange?.currency ?? null,
          totalInventory: product.totalInventory,
          variantCount: product.variantCount,
          imageCount: product.imageCount,
          sourceCreatedAt: parseDate(product.createdAt),
          sourceUpdatedAt: parseDate(product.updatedAt),
          contentHash,
          lastSyncedAt: new Date(),
        },
        update: {
          sourceShop,
          title: product.title,
          handle: product.handle,
          status: product.status,
          vendor: product.vendor,
          productType: product.productType,
          category: product.productType || "General",
          descriptionHtml: product.descriptionHtml,
          descriptionText,
          collectionsJson: productCollectionsJson(product),
          imageUrlsJson: productImageUrlsJson(product),
          tagsJson: JSON.stringify(product.tags),
          priceMinimum: product.priceRange?.minimum ?? null,
          priceMaximum: product.priceRange?.maximum ?? null,
          currency: product.priceRange?.currency ?? null,
          totalInventory: product.totalInventory,
          variantCount: product.variantCount,
          imageCount: product.imageCount,
          sourceCreatedAt: parseDate(product.createdAt),
          sourceUpdatedAt: parseDate(product.updatedAt),
          contentHash,
          lastSyncedAt: new Date(),
        },
      });

      await upsertKnowledgeDocument({
        shop: sourceShop,
        domain: "product",
        sourceKey: product.id,
        title: product.title,
        body: [
          product.title,
          product.productType,
          product.collections.map((collection) => collection.title).join(", "),
          descriptionText,
          `Inventory: ${product.totalInventory}`,
          product.priceRange
            ? `Price: ${product.priceRange.minimum}-${product.priceRange.maximum} ${product.priceRange.currency}`
            : "",
        ]
          .filter(Boolean)
          .join("\n"),
        metadata: {
          handle: product.handle,
          status: product.status,
          collections: product.collections,
          imageCount: product.imageCount,
          variantCount: product.variantCount,
          sourceUpdatedAt: product.updatedAt,
        },
      });

      upsertedCount += 1;
    }

    for (const collection of input.catalog.collections) {
      await upsertKnowledgeDocument({
        shop: sourceShop,
        domain: "collection",
        sourceKey: collection.id,
        title: collection.title,
        body: `${collection.title}\nHandle: ${collection.handle}`,
        metadata: { ...collection },
      });
    }

    await db.catalogKnowledgeProduct.updateMany({
      where: { sourceShop, lastSyncedAt: { lt: run.startedAt } },
      data: { status: "REMOVED" },
    });
    await db.catalogSyncRun.update({
      where: { id: run.id },
      data: {
        status: input.catalog.error ? "COMPLETED_WITH_WARNINGS" : "COMPLETED",
        scannedCount: input.catalog.products.length,
        upsertedCount,
        errorMessage: input.catalog.error,
        finishedAt: new Date(),
      },
    });

    return {
      runId: run.id,
      scannedCount: input.catalog.products.length,
      upsertedCount,
    };
  } catch (error) {
    await db.catalogSyncRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        errorMessage:
          error instanceof Error ? error.message.slice(0, 500) : "unknown",
        finishedAt: new Date(),
      },
    });
    throw error;
  }
}

export async function syncShopPolicies(admin: AdminLike, shop: string) {
  const run = await db.catalogSyncRun.create({
    data: {
      shop,
      scope: "policies",
      triggeredBy: "admin",
    },
  });

  try {
    const response = await admin.graphql(`#graphql
      query WolfshunterShopPolicies {
        shop {
          name
          myshopifyDomain
          shopPolicies {
            id
            title
            body
            type
            url
          }
        }
      }
    `);
    const payload = (await response.json()) as {
      data?: ShopifyPoliciesPayload;
      errors?: Array<{ message?: string }>;
    };

    if (!response.ok || payload.errors?.length) {
      throw new Error(
        payload.errors
          ?.map((error) => error.message)
          .filter(Boolean)
          .join("; ") ||
          `Shopify policies query failed with HTTP ${response.status}`,
      );
    }

    if (
      payload.data?.shop?.myshopifyDomain !== shop ||
      !Array.isArray(payload.data.shop.shopPolicies)
    )
      throw new Error("Incomplete or mismatched policy response");
    const policies = payload.data.shop.shopPolicies;
    if (policies.some((policy) => !policy.id))
      throw new Error("Policy identity missing");
    await db.$transaction(async (tx) => {
      for (const policy of policies) {
        if (!policy.id) continue;
        const body = stripHtml(policy.body);
        const metadataJson = JSON.stringify({
          type: policy.type,
          url: policy.url,
          shopName: payload.data?.shop?.name,
        });
        const record = {
          title: policy.title ?? policy.type ?? "Shop policy",
          body,
          bodyHash: stableHash(body),
          metadataJson,
          lastSyncedAt: new Date(),
        };
        await tx.knowledgeDocument.upsert({
          where: {
            shop_domain_sourceKey: {
              shop,
              domain: "policy",
              sourceKey: policy.id,
            },
          },
          create: { shop, domain: "policy", sourceKey: policy.id, ...record },
          update: record,
        });
      }
      await tx.knowledgeDocument.deleteMany({
        where: {
          shop,
          domain: "policy",
          sourceKey: { notIn: policies.map((policy) => policy.id!) },
        },
      });
    });

    await db.catalogSyncRun.update({
      where: { id: run.id },
      data: {
        status: "COMPLETED",
        scannedCount: policies.length,
        upsertedCount: policies.filter((policy) => policy.id).length,
        finishedAt: new Date(),
      },
    });

    return { runId: run.id, scannedCount: policies.length };
  } catch (error) {
    await db.catalogSyncRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        errorMessage:
          error instanceof Error ? error.message.slice(0, 500) : "unknown",
        finishedAt: new Date(),
      },
    });
    throw error;
  }
}

export async function getKnowledgeSyncSummary(shop?: string | null) {
  const where = shop ? { shop } : undefined;
  const [
    products,
    activeProducts,
    collections,
    policies,
    documents,
    recentRuns,
    releasesByStatus,
  ] = await Promise.all([
    db.catalogKnowledgeProduct.count(
      shop ? { where: { sourceShop: shop } } : undefined,
    ),
    db.catalogKnowledgeProduct.count({
      where: { ...(shop ? { sourceShop: shop } : {}), status: "ACTIVE" },
    }),
    db.knowledgeDocument.count({
      where: { ...(where ?? {}), domain: "collection" },
    }),
    db.knowledgeDocument.count({
      where: { ...(where ?? {}), domain: "policy" },
    }),
    db.knowledgeDocument.count(where ? { where } : undefined),
    db.catalogSyncRun.findMany({
      where,
      orderBy: { startedAt: "desc" },
      take: 8,
    }),
    db.retailerProductRelease.groupBy({
      by: ["status"],
      _count: { status: true },
    }),
  ]);

  return {
    products,
    activeProducts,
    collections,
    policies,
    documents,
    recentRuns: recentRuns.map((run) => ({
      id: run.id,
      shop: run.shop,
      scope: run.scope,
      status: run.status,
      scannedCount: run.scannedCount,
      upsertedCount: run.upsertedCount,
      errorMessage: run.errorMessage,
      startedAt: run.startedAt.toISOString(),
      finishedAt: run.finishedAt?.toISOString() ?? null,
    })),
    releasesByStatus: releasesByStatus.map((entry) => ({
      status: entry.status,
      count: entry._count.status,
    })),
  };
}

export async function getAssistantKnowledge(message: string) {
  const sourceShop = getCatalogSourceShop();
  if (!sourceShop) {
    return {
      source: "empty" as const,
      productCount: 0,
      sourceProductCount: 0,
      matchedProducts: [],
      policyDocuments: [],
    };
  }

  const [products, policyDocuments] = await Promise.all([
    db.catalogKnowledgeProduct.findMany({
      where: { sourceShop },
      orderBy: { lastSyncedAt: "desc" },
      take: 10_000,
    }),
    db.knowledgeDocument.findMany({
      where: { shop: sourceShop, domain: { in: ["policy", "collection"] } },
      orderBy: { updatedAt: "desc" },
      take: 500,
    }),
  ]);
  const tokens = searchTokens(message);
  const scored = products
    .map((product) => {
      const collections = safeJsonArray<{ title?: string }>(
        product.collectionsJson,
      )
        .map((collection) => collection.title)
        .filter((title): title is string => Boolean(title));
      const text =
        `${product.title} ${product.category} ${product.productType} ${collections.join(" ")} ${product.descriptionText}`.toLowerCase();
      const tokenScore = tokens.reduce(
        (score, token) => score + (text.includes(token) ? 1 : 0),
        0,
      );
      const qualityScore =
        (product.imageCount > 0 ? 0.3 : 0) +
        Math.min(product.imageCount, 6) * 0.05 +
        (product.totalInventory > 0 ? 0.2 : 0);
      return { product, collections, score: tokenScore + qualityScore };
    })
    .filter((entry) =>
      tokens.length ? entry.score >= 1 : entry.product.status === "ACTIVE",
    )
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.product.totalInventory - left.product.totalInventory,
    )
    .slice(0, tokens.length ? 40 : 16);

  return {
    source: "knowledge" as const,
    productCount: products.length,
    sourceProductCount: products.length,
    matchedProducts: scored.map(({ product, collections }) => ({
      id: product.sourceProductId,
      title: product.title,
      category: product.category || product.productType || "General",
      collections: collections.slice(0, 8),
      price: product.priceMinimum ?? 0,
      currency: product.currency ?? "EUR",
      stock: product.totalInventory,
      deliveryDays: null,
      imageCount: product.imageCount,
      description: product.descriptionText.slice(0, 420) || null,
    })),
    policyDocuments: policyDocuments
      .filter((document) => document.domain === "policy")
      .slice(0, 12)
      .map((document) => ({
        title: document.title,
        body: document.body.slice(0, 1200),
        metadata: document.metadataJson,
      })),
  };
}

export async function recordRetailerRelease(input: {
  retailerShop: string;
  sourceProductId: string;
  sourceTitle: string;
  shopifyProductId: string;
  shopifyVariantId: string | null;
  status: string;
}) {
  return db.retailerProductRelease.upsert({
    where: {
      retailerShop_sourceProductId: {
        retailerShop: input.retailerShop,
        sourceProductId: input.sourceProductId,
      },
    },
    create: {
      retailerShop: input.retailerShop,
      sourceProductId: input.sourceProductId,
      sourceTitle: input.sourceTitle,
      shopifyProductId: input.shopifyProductId,
      shopifyVariantId: input.shopifyVariantId,
      status: input.status,
      lastSyncedAt: new Date(),
    },
    update: {
      sourceTitle: input.sourceTitle,
      shopifyProductId: input.shopifyProductId,
      shopifyVariantId: input.shopifyVariantId,
      status: input.status,
      lastSyncedAt: new Date(),
    },
  });
}
