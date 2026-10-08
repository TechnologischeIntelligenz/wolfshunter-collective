import assert from "node:assert/strict";
import test from "node:test";

import { getShopifyAdminCatalog } from "./shopify-admin-catalog.server.ts";

function rawProduct(index: number) {
  return {
    id: `gid://shopify/Product/${index}`,
    title: `Product ${index}`,
    handle: `product-${index}`,
    descriptionHtml: `<p>Description ${index}</p>`,
    status: "ACTIVE",
    vendor: "WOLFSHUNTER",
    productType: "Accessories",
    tags: [],
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-02T00:00:00Z",
    totalInventory: 5,
    variantsCount: { count: 1 },
    mediaCount: { count: 1 },
    priceRangeV2: {
      minVariantPrice: { amount: "10.00", currencyCode: "EUR" },
      maxVariantPrice: { amount: "12.00", currencyCode: "EUR" },
    },
    collections: {
      nodes: [
        {
          id: "gid://shopify/Collection/1",
          title: "Main",
          handle: "main",
          updatedAt: "2026-08-02T00:00:00Z",
        },
      ],
    },
    media: {
      nodes: [
        {
          alt: "Product image",
          preview: { image: { url: `https://example.com/${index}.jpg`, altText: null } },
        },
      ],
    },
  };
}

test("loads Shopify products through all available pages", async () => {
  const calls: Array<Record<string, unknown>> = [];
  const firstPage = Array.from({ length: 250 }, (_, index) => rawProduct(index + 1));
  const secondPage = Array.from({ length: 3 }, (_, index) => rawProduct(index + 251));
  const pages = [
    {
      products: firstPage,
      pageInfo: { hasNextPage: true, endCursor: "cursor-250" },
      collections: [{ id: "gid://shopify/Collection/1", title: "Main", handle: "main", updatedAt: "2026-08-02T00:00:00Z" }],
    },
    {
      products: secondPage,
      pageInfo: { hasNextPage: false, endCursor: null },
      collections: [],
    },
  ];

  const catalog = await getShopifyAdminCatalog({
    async graphql(_query, options) {
      calls.push(options?.variables ?? {});
      const page = pages[calls.length - 1]!;
      return Response.json({
        data: {
          products: { nodes: page.products, pageInfo: page.pageInfo },
          collections: options?.variables?.includeCollections
            ? { nodes: page.collections }
            : undefined,
        },
      });
    },
  });

  assert.equal(catalog.source, "shopify");
  assert.equal(catalog.products.length, 253);
  assert.equal(catalog.collections.length, 1);
  assert.deepEqual(calls, [
    { first: 250, after: null, includeCollections: true },
    { first: 250, after: "cursor-250", includeCollections: false },
  ]);
});

test("respects CATALOG_PRODUCT_LIMIT while paginating", async () => {
  const previousLimit = process.env.CATALOG_PRODUCT_LIMIT;
  process.env.CATALOG_PRODUCT_LIMIT = "251";
  const calls: Array<Record<string, unknown>> = [];

  try {
    const catalog = await getShopifyAdminCatalog({
      async graphql(_query, options) {
        calls.push(options?.variables ?? {});
        return Response.json({
          data: {
            products: {
              nodes: Array.from(
                { length: Number(options?.variables?.first ?? 0) },
                (_, index) => rawProduct(calls.length * 1000 + index),
              ),
              pageInfo: {
                hasNextPage: calls.length === 1,
                endCursor: calls.length === 1 ? "cursor-250" : null,
              },
            },
            collections: options?.variables?.includeCollections ? { nodes: [] } : undefined,
          },
        });
      },
    });

    assert.equal(catalog.products.length, 251);
    assert.deepEqual(calls, [
      { first: 250, after: null, includeCollections: true },
      { first: 1, after: "cursor-250", includeCollections: false },
    ]);
  } finally {
    if (previousLimit === undefined) delete process.env.CATALOG_PRODUCT_LIMIT;
    else process.env.CATALOG_PRODUCT_LIMIT = previousLimit;
  }
});
