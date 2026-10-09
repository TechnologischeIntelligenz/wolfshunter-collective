import assert from "node:assert/strict";
import test, { after, mock } from "node:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import pg from "pg";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { PGlite } from "@electric-sql/pglite";
import {
  canonicalOrderId,
  normalizeOrderWebhook,
} from "./order-normalization.ts";

class OrderSyncPGlitePool extends pg.Pool {
  constructor(database) {
    super({ max: 1 });
    this.database = database;
    this.tail = Promise.resolve();
  }
  async acquire() {
    const previous = this.tail;
    let unlock;
    this.tail = new Promise(resolve => { unlock = resolve; });
    await previous;
    return unlock;
  }
  async execute(query, values) {
    const config = typeof query === "string" ? { text: query } : query;
    const parsers = config.types ? Object.fromEntries(
      [16, 20, 21, 23, 25, 114, 700, 701, 1043, 1082, 1114, 1184, 1700, 3802]
        .map(oid => [oid, config.types.getTypeParser(oid, "text")]),
    ) : undefined;
    const result = await this.database.query(config.text, values ?? config.values ?? [], {
      ...(config.rowMode ? { rowMode: config.rowMode } : {}),
      ...(parsers ? { parsers } : {}),
    });
    return { ...result, rowCount: result.affectedRows ?? result.rows.length };
  }
  async query(query, values) {
    const unlock = await this.acquire();
    try { return await this.execute(query, values); } finally { unlock(); }
  }
  async connect() {
    const unlock = await this.acquire();
    const connection = new EventEmitter();
    connection.query = (query, values) => this.execute(query, values);
    let released = false;
    connection.release = () => {
      if (released) return;
      released = true;
      unlock();
    };
    return connection;
  }
  async end() { await this.tail; }
}

const directory = await fs.mkdtemp(
  path.join(os.tmpdir(), "collective-sync-test-"),
);
process.env.SOURCE_DATA_DIR = path.join(directory, "source");

const database = await PGlite.create();
await database.exec(readFileSync(
  new URL("../../prisma/migrations/20260918060000_postgresql_baseline/migration.sql", import.meta.url),
  "utf8",
));
const pool = new OrderSyncPGlitePool(database);
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
const dbModule = mock.module(new URL("../db.server.ts", import.meta.url).href, {
  exports: { default: prisma },
});
const { default: db } = await import("../db.server.ts");
const { upsertRetailerOrder, syncRecentShopifyOrders, getRetailerOrders } =
  await import("./retailer-orders.server.ts");
const { receivePrivacyRequest, exportPrivacyRequest, redactOrders } =
  await import("./privacy-requests.server.ts");
const { syncShopPolicies } = await import("./knowledge-sync.server.ts");
const { deleteShopData } = await import("./tenant-data.server.ts");
const { sourceDataPath, writeSourceData } =
  await import("./catalog-snapshot.server.ts");
after(async () => {
  dbModule.restore();
  await db.$disconnect();
  await pool.end();
  await database.close();
  await fs.rm(directory, { recursive: true, force: true });
});
const order = (id: string, time = "2026-09-18T01:00:00Z") => ({
  shopifyOrderId: id,
  shopifyUpdatedAt: time,
  createdAt: "2026-09-17T00:00:00Z",
  orderNumber: "#test",
  financialStatus: "PAID",
  fulfillmentStatus: "FULFILLED",
  currency: "EUR",
  totalPrice: 24,
  lineItemCount: 2,
});

test("Order IDs unify REST and GraphQL without accepting malformed or unsafe IDs", () => {
  assert.equal(canonicalOrderId(123), "gid://shopify/Order/123");
  assert.equal(
    canonicalOrderId("gid://shopify/Order/123"),
    "gid://shopify/Order/123",
  );
  for (const value of [
    0,
    -1,
    Number.MAX_SAFE_INTEGER + 1,
    "gid://shopify/Product/123",
    "123gid://shopify/Order/",
    null,
  ])
    assert.equal(canonicalOrderId(value), null);
  const normalized = normalizeOrderWebhook(
    {
      id: 123,
      updated_at: "2026-09-18T01:00:00Z",
      financial_status: "paid",
      fulfillment_status: null,
      line_items: [{ quantity: 9, current_quantity: 3 }, null],
    },
    "ORDERS_UPDATED",
  );
  assert.equal(normalized?.lineItemCount, 3);
  assert.equal(normalized?.fulfillmentStatus, "UNFULFILLED");
  assert.equal(normalized?.financialStatus, "PAID");
});

test("Repeated, stale and legacy events cannot duplicate or downgrade an order", async () => {
  const shop = "event-test.myshopify.com";
  await db.retailerOrder.create({
    data: {
      shop,
      shopifyOrderId: "123",
      createdAt: new Date(),
      shopifyUpdatedAt: new Date("2026-09-17T00:00:00Z"),
    },
  });
  await upsertRetailerOrder(shop, order("123"));
  await upsertRetailerOrder(shop, order("gid://shopify/Order/123"));
  await upsertRetailerOrder(shop, {
    ...order("123", "2026-09-17T00:00:00Z"),
    financialStatus: "PENDING",
  });
  assert.equal(await db.retailerOrder.count({ where: { shop } }), 1);
  let current = await db.retailerOrder.findFirstOrThrow({ where: { shop } });
  assert.equal(current.financialStatus, "PAID");
  assert.equal(current.shopifyOrderId, "gid://shopify/Order/123");
  await upsertRetailerOrder(shop, {
    ...order("123", "2026-09-18T02:00:00Z"),
    fulfillmentStatus: null,
    totalPrice: null,
  });
  current = await db.retailerOrder.findFirstOrThrow({ where: { shop } });
  assert.equal(current.fulfillmentStatus, null);
  assert.equal(current.totalPrice, null);
});

test("Reconciliation reads every page and retries from the last successful checkpoint", async () => {
  const shop = "pages-test.myshopify.com";
  const calls: Array<Record<string, unknown>> = [];
  const admin = {
    async graphql(
      _query: string,
      options?: { variables?: Record<string, unknown> },
    ) {
      const variables = options?.variables ?? {};
      calls.push(variables);
      const page =
        variables.after === null ? 0 : variables.after === "cursor-1" ? 1 : 2;
      return Response.json({
        data: {
          orders: {
            nodes: Array.from({ length: page < 2 ? 100 : 5 }, (_, i) => ({
              id: `gid://shopify/Order/${page * 100 + i + 1000}`,
              name: "#test",
              createdAt: "2026-09-17T00:00:00Z",
              updatedAt: "2026-09-18T01:00:00Z",
              displayFinancialStatus: "PAID",
              displayFulfillmentStatus: "UNFULFILLED",
              currencyCode: "EUR",
              currentTotalPriceSet: { shopMoney: { amount: "10" } },
              currentSubtotalLineItemsQuantity: 500,
            })),
            pageInfo: {
              hasNextPage: page < 2,
              endCursor: `cursor-${page + 1}`,
            },
          },
        },
      });
    },
  };
  const result = await syncRecentShopifyOrders(admin, shop, true);
  assert.equal(result.synced, 205);
  assert.equal(calls.length, 3);
  assert.match(String(calls[0].query), /created_at/);
  const first = await getRetailerOrders(shop, 1);
  const second = await getRetailerOrders(shop, 2);
  assert.equal(first.orders.length, 100);
  assert.equal(first.pageCount, 3);
  assert.ok(
    !second.orders.some((row) =>
      first.orders.some((other) => other.id === row.id),
    ),
  );
  assert.equal(first.orders[0].lineItemCount, 500);
  await assert.rejects(
    syncRecentShopifyOrders(
      {
        async graphql() {
          return Response.json({ errors: [{ message: "Denied" }] });
        },
      },
      shop,
      true,
    ),
  );
  assert.equal(
    await db.catalogSyncRun.count({
      where: { shop, scope: "orders", status: "COMPLETED" },
    }),
    1,
  );
  assert.equal(
    await db.catalogSyncRun.count({
      where: { shop, scope: "orders", status: "FAILED" },
    }),
    1,
  );
  await syncRecentShopifyOrders(admin, shop, true);
  assert.match(String(calls[3].query), /updated_at/);
});

test("Privacy export is shop-scoped, erasure survives later reconciliation and retries", async () => {
  const shop = "privacy-test.myshopify.com",
    other = "privacy-other.myshopify.com";
  await upsertRetailerOrder(shop, order("900"));
  await upsertRetailerOrder(other, order("900"));
  const payload = {
    orders_requested: [900],
    data_request: { id: 77 },
    customer: { email: "never-store@example.test" },
  };
  await receivePrivacyRequest(
    shop,
    "CUSTOMERS_DATA_REQUEST",
    payload,
    "delivery-1",
  );
  await receivePrivacyRequest(
    shop,
    "CUSTOMERS_DATA_REQUEST",
    payload,
    "delivery-1",
  );
  const rows = await db.knowledgeDocument.findMany({
    where: { shop, domain: "privacy-request" },
  });
  assert.equal(rows.length, 1);
  assert.ok(!JSON.stringify(rows).includes("never-store"));
  assert.equal((await exportPrivacyRequest(shop, rows[0].id)).orders.length, 1);
  await assert.rejects(
    exportPrivacyRequest(other, rows[0].id),
    (error: unknown) => error instanceof Response && error.status === 404,
  );
  await receivePrivacyRequest(
    shop,
    "CUSTOMERS_REDACT",
    { orders_to_redact: [900] },
    "delivery-2",
  );
  assert.equal(
    await upsertRetailerOrder(shop, order("900", "2026-09-18T03:00:00Z")),
    null,
  );
  assert.equal((await exportPrivacyRequest(shop, rows[0].id)).orders.length, 0);
  assert.equal(await db.retailerOrder.count({ where: { shop: other } }), 1);
  await redactOrders(shop, ["gid://shopify/Order/900"]);
  assert.equal(await db.retailerOrder.count({ where: { shop } }), 0);
});

test("Policy sync replaces removed policies and rejects incomplete or foreign responses", async () => {
  const shop = "policy-test.myshopify.com";
  const admin = (policies: unknown[], domain = shop) => ({
    async graphql() {
      return Response.json({
        data: {
          shop: {
            myshopifyDomain: domain,
            name: "Test",
            shopPolicies: policies,
          },
        },
      });
    },
  });
  await syncShopPolicies(
    admin([
      { id: "p1", body: "Old" },
      { id: "p2", body: "<p>Current</p>" },
    ]),
    shop,
  );
  await syncShopPolicies(admin([{ id: "p2", body: "<p>Changed</p>" }]), shop);
  let policies = await db.knowledgeDocument.findMany({
    where: { shop, domain: "policy" },
  });
  assert.equal(policies.length, 1);
  assert.equal(policies[0].body, "Changed");
  await assert.rejects(
    syncShopPolicies(admin([], "other.myshopify.com"), shop),
  );
  await assert.rejects(
    syncShopPolicies(
      {
        async graphql() {
          return Response.json({ data: { shop: { myshopifyDomain: shop } } });
        },
      },
      shop,
    ),
  );
  policies = await db.knowledgeDocument.findMany({
    where: { shop, domain: "policy" },
  });
  assert.equal(policies.length, 1);
  await syncShopPolicies(admin([]), shop);
  assert.equal(
    await db.knowledgeDocument.count({ where: { shop, domain: "policy" } }),
    0,
  );
});

test("Shop erasure removes all persisted domains/files, respects sync lock and preserves other shops", async () => {
  const shop = "erase-test.myshopify.com",
    other = "erase-other.myshopify.com";
  for (const name of [shop, other]) {
    await db.retailerWorkspace.create({ data: { shop: name } });
    await upsertRetailerOrder(name, order("800"));
    await db.retailerProductRelease.create({
      data: { retailerShop: name, sourceProductId: name, sourceTitle: "Test" },
    });
    await db.catalogKnowledgeProduct.create({
      data: {
        sourceProductId: name,
        sourceShop: name,
        title: "Test",
        handle: "test",
        status: "ACTIVE",
        contentHash: "test",
      },
    });
    await db.catalogSyncRun.create({ data: { shop: name, scope: "test" } });
    await receivePrivacyRequest(
      name,
      "CUSTOMERS_DATA_REQUEST",
      { orders_requested: [800], data_request: { id: 1 } },
      "test-delivery",
    );
    await writeSourceData(name, "commerce.json", { sourceShop: name });
  }
  await fs.mkdir(sourceDataPath(shop, "sync.lock"));
  await assert.rejects(
    deleteShopData(shop),
    (error: unknown) => error instanceof Response && error.status === 503,
  );
  assert.equal(await db.retailerWorkspace.count({ where: { shop } }), 1);
  await fs.rmdir(sourceDataPath(shop, "sync.lock"));
  await deleteShopData(shop);
  await deleteShopData(shop);
  for (const count of [
    (shop: string) => db.retailerWorkspace.count({ where: { shop } }),
    (shop: string) => db.retailerOrder.count({ where: { shop } }),
    (shop: string) => db.knowledgeDocument.count({ where: { shop } }),
    (shop: string) => db.catalogSyncRun.count({ where: { shop } }),
  ]) {
    assert.equal(await count(shop), 0);
    assert.ok((await count(other)) > 0);
  }
  assert.equal(
    await db.retailerProductRelease.count({ where: { retailerShop: shop } }),
    0,
  );
  assert.equal(
    await db.catalogKnowledgeProduct.count({ where: { sourceShop: shop } }),
    0,
  );
  await assert.rejects(fs.stat(sourceDataPath(shop, "commerce.json")));
  assert.ok(await fs.stat(sourceDataPath(other, "commerce.json")));
  await assert.rejects(deleteShopData("../outside"));
});

test("A repeated cursor fails explicitly instead of silently marking a partial sync complete", async () => {
  const shop = "cursor-test.myshopify.com";
  await assert.rejects(
    syncRecentShopifyOrders(
      {
        async graphql() {
          return Response.json({
            data: {
              orders: {
                nodes: [],
                pageInfo: { hasNextPage: true, endCursor: "same" },
              },
            },
          });
        },
      },
      shop,
      true,
    ),
    /pagination stalled/,
  );
  assert.equal(
    await db.catalogSyncRun.count({ where: { shop, status: "COMPLETED" } }),
    0,
  );
});

test("Shop erasure cancels an in-flight reconciliation before its response can recreate data", async () => {
  const shop = "cancel-test.myshopify.com";
  let finish!: (value: Response) => void;
  let entered!: () => void;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const work = syncRecentShopifyOrders(
    {
      async graphql() {
        entered();
        return new Promise<Response>((resolve) => {
          finish = resolve;
        });
      },
    },
    shop,
    true,
  );
  await started;
  await assert.rejects(
    deleteShopData(shop),
    (error: unknown) => error instanceof Response && error.status === 503,
  );
  finish(
    Response.json({
      data: {
        orders: {
          nodes: [
            {
              id: "gid://shopify/Order/999",
              updatedAt: "2026-09-18T00:00:00Z",
            },
          ],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      },
    }),
  );
  await assert.rejects(work, /cancelled/);
  await deleteShopData(shop);
  assert.equal(await db.retailerOrder.count({ where: { shop } }), 0);
});
