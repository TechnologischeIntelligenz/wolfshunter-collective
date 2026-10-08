import assert from "node:assert/strict";
import test from "node:test";
import { catalogPage, retailerCatalogPage } from "./catalog-page.ts";
import { parseCatalogLines } from "./catalog-bulk.server.ts";
import { createPhaseOneFixtureState } from "./merchandising/fixtures.ts";
import { getSessionRole } from "./app-role.server.ts";

test("80,001 products are paginated to at most 250 and searched across all pages", () => {
  const products = Array.from({ length: 80001 }, (_, i) => ({ id: String(i), title: `Product ${i}`, collections: [{ id: "collection", title: "Website collection", handle: "website" }] }));
  const first = catalogPage(products, new URLSearchParams());
  assert.equal(first.products.length, 250);
  assert.equal(first.meta.total, 80001);
  assert.equal(first.meta.pageCount, 321);
  const last = catalogPage(products, new URLSearchParams("page=99999"));
  assert.equal(last.products.length, 1);
  assert.equal(last.products[0].id, "80000");
  const search = catalogPage(products, new URLSearchParams("q=Product+80000"));
  assert.equal(search.products.length, 1);
  assert.equal(search.products[0].id, "80000");
  assert.equal(search.meta.collections[0].count, 80001);
});

test("collection selection is applied before pagination", () => {
  const products = Array.from({ length: 800 }, (_, i) => ({ id: String(i), title: String(i), collections: [{ id: i < 600 ? "a" : "b", title: i < 600 ? "Women" : "Men", handle: "category" }] }));
  const result = catalogPage(products, new URLSearchParams("collection=b"));
  assert.equal(result.meta.filteredTotal, 200);
  assert.equal(result.products[0].id, "600");
  assert.equal(result.meta.collections.length, 2);
});

test("the same owner email does not promote a retailer shop to admin", () => {
  const previous = { shops: process.env.APP_ADMIN_SHOPS, emails: process.env.APP_ADMIN_EMAILS, role: process.env.APP_ROLE };
  try {
    process.env.APP_ADMIN_SHOPS = "3ddd6b-2.myshopify.com";
    process.env.APP_ADMIN_EMAILS = "owner@example.test";
    process.env.APP_ROLE = "retailer";
    assert.equal(getSessionRole({ shop: "wolfshunter-ai-dev.myshopify.com", email: "owner@example.test" }), "retailer");
    assert.equal(getSessionRole({ shop: "3ddd6b-2.myshopify.com", email: "owner@example.test" }), "admin");
  } finally {
    for (const [key, value] of Object.entries({ APP_ADMIN_SHOPS: previous.shops, APP_ADMIN_EMAILS: previous.emails, APP_ROLE: previous.role })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test("bulk parser retains more than 10 images, 20 collections and all variants", async () => {
  const lines = [
    JSON.stringify({ __typename: "Product", id: "p", title: "Product", variantsCount: { count: 300 }, mediaCount: { count: 12 } }),
    ...Array.from({ length: 300 }, (_, i) => JSON.stringify({ __typename: "ProductVariant", id: `v${i}`, __parentId: "p", sku: `private-${i}` })),
    ...Array.from({ length: 12 }, (_, i) => JSON.stringify({ __typename: "Image", id: `i${i}`, __parentId: "p", url: `https://example.test/${i}` })),
    ...Array.from({ length: 30 }, (_, i) => JSON.stringify({ __typename: "Collection", id: `c${i}`, __parentId: "p", title: `Collection ${i}` })),
  ];
  const [product] = await parseCatalogLines(lines);
  assert.equal(product.variants.length, 300);
  assert.equal(product.images.length, 12);
  assert.equal(product.collections.length, 30);
});

test("bulk parser rejects incomplete variants and orphaned child records", async () => {
  await assert.rejects(parseCatalogLines([JSON.stringify({ __typename: "Product", id: "p", variantsCount: { count: 1 } })]), /Incomplete variants/);
  await assert.rejects(parseCatalogLines([JSON.stringify({ __typename: "Image", id: "i", __parentId: "missing" })]), /without a product/);
});

test("unknown delivery times do not qualify as fast shipping", () => {
  const fixture = createPhaseOneFixtureState();
  const products = fixture.catalog.map(p => ({ ...p, estimatedDeliveryDays: null, dispatchDays: null }));
  const result = retailerCatalogPage(products, fixture.tenant, fixture.affinity, new URLSearchParams("bucket=FAST_SHIPPING"));
  assert.equal(result.meta.filteredTotal, 0);
  assert.equal(result.meta.bucketCounts.FAST_SHIPPING, 0);
});

