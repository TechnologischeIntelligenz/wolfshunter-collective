import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Prisma } from "@prisma/client";

// PGlite is test-only and deliberately not a dependency of the deployed Worker.
const pgliteEntry = process.argv[2];
assert(pgliteEntry, "Pass the path to an isolated @electric-sql/pglite/dist/index.js installation.");
const { PGlite } = await import(pathToFileURL(path.resolve(pgliteEntry)).href);
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sql = readFileSync(path.join(projectRoot,
  "prisma/migrations/20260918060000_postgresql_baseline/migration.sql"), "utf8");
const schema = readFileSync(path.join(projectRoot, "prisma/schema.prisma"), "utf8");
const modelNames = Prisma.dmmf.datamodel.models.map((model) => model.dbName ?? model.name);
const expectedIndexes = [...sql.matchAll(/^CREATE (?:UNIQUE )?INDEX "([^"]+)"/gm)].map((match) => match[1]).sort();
const sqlTypes = {
  String: "text", Boolean: "boolean", BigInt: "bigint", Int: "integer",
  Float: "double precision", DateTime: "timestamp without time zone",
};

for (const supabaseDefaults of [false, true]) {
  const db = await PGlite.create();
  try {
    // Prisma creates this bookkeeping table before migration execution.
    await db.exec('CREATE TABLE public."_prisma_migrations" (id text PRIMARY KEY);');
    if (supabaseDefaults) {
      await db.exec(`
        CREATE ROLE anon NOLOGIN;
        CREATE ROLE authenticated NOLOGIN;
        CREATE ROLE service_role NOLOGIN BYPASSRLS;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
        GRANT ALL ON TABLE public."_prisma_migrations" TO anon, authenticated, service_role;
      `);
    }
    await db.exec(sql);
    const tables = await db.query(`
      SELECT c.relname AS name, c.relrowsecurity AS rls
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r' ORDER BY c.relname
    `);
    assert.deepEqual(tables.rows.map((row) => row.name), [...modelNames, "_prisma_migrations"].sort());
    assert(tables.rows.every((row) => row.rls), "Every application/bookkeeping table must enable RLS.");

    const columns = await db.query(`
      SELECT table_name, column_name, data_type, is_nullable
      FROM information_schema.columns WHERE table_schema = 'public'
    `);
    for (const model of Prisma.dmmf.datamodel.models) {
      // The engineType=client runtime DMMF omits isRequired; retain the schema's
      // scalar nullability for this independent schema-versus-database check.
      const modelSchema = schema.match(new RegExp(`model ${model.name} \\{([\\s\\S]*?)\\n\\}`))[1];
      const actual = columns.rows.filter((column) => column.table_name === (model.dbName ?? model.name));
      assert.equal(actual.length, model.fields.length, `${model.name}: column count`);
      for (const field of model.fields) {
        const column = actual.find((candidate) => candidate.column_name === (field.dbName ?? field.name));
        assert(column, `${model.name}.${field.name}: missing column`);
        assert.equal(column.data_type, sqlTypes[field.type], `${model.name}.${field.name}: SQL type`);
        const nullable = modelSchema.match(new RegExp(`^\\s*${field.name}\\s+\\w+(\\?)?(?:\\s|$)`, "m"))[1] === "?";
        assert.equal(column.is_nullable, nullable ? "YES" : "NO", `${model.name}.${field.name}: nullability`);
      }
    }
    const indexes = await db.query(`
      SELECT indexname FROM pg_indexes WHERE schemaname = 'public'
        AND indexname NOT LIKE '%\\_pkey' ESCAPE '\\' ORDER BY indexname
    `);
    assert.deepEqual(indexes.rows.map((row) => row.indexname), expectedIndexes);

    await db.query(`INSERT INTO "Session" (id, shop, state, "accessToken", "userId", expires)
      VALUES ($1, $2, $3, $4, $5, $6)`,
    ["migration-fixture", "fixture.myshopify.com", "fixture-state", "fixture-token", "9007199254740993", "2026-09-18 05:17:20.123"]);
    const session = (await db.query(`SELECT "isOnline", "accountOwner", collaborator, "emailVerified",
      "userId"::text AS "userId", expires::text AS expires FROM "Session"`)).rows[0];
    assert.deepEqual(session, {
      isOnline: false, accountOwner: false, collaborator: false, emailVerified: false,
      userId: "9007199254740993", expires: "2026-09-18 05:17:20.123",
    });
    await assert.rejects(db.query(`INSERT INTO "Session" (id, shop, state, "accessToken")
      VALUES ('migration-fixture', 'fixture.myshopify.com', 'x', 'x')`), { code: "23505" });
    await db.exec(`INSERT INTO "RetailerOrder" (id, shop, "shopifyOrderId", "createdAt", "updatedAt")
      VALUES (200, 'fixture.myshopify.com', 'fixture-order', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
      SELECT setval(pg_get_serial_sequence('public."RetailerOrder"', 'id'),
        (SELECT max(id) FROM "RetailerOrder"), true);`);
    const order = (await db.query(`INSERT INTO "RetailerOrder" (shop, "shopifyOrderId", "createdAt", "updatedAt")
      VALUES ('fixture.myshopify.com', 'fixture-order-2', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id, "trackingJson", "lineItemCount", "syncStatus"`)).rows[0];
    assert.deepEqual(order, { id: 201, trackingJson: "[]", lineItemCount: 0, syncStatus: "SYNCED" });

    if (supabaseDefaults) {
      const grants = await db.query(`
        SELECT r.rolname, c.relname
        FROM pg_roles r CROSS JOIN pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE r.rolname IN ('anon', 'authenticated', 'service_role') AND n.nspname = 'public'
          AND ((c.relkind = 'r' AND has_table_privilege(r.rolname, c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))
            OR (c.relkind = 'S' AND has_sequence_privilege(r.rolname, c.oid, 'USAGE,SELECT,UPDATE')))
      `);
      assert.deepEqual(grants.rows, [], "Data API roles must retain no table/sequence privileges.");
      await db.exec('SET ROLE anon;');
      await assert.rejects(db.query('SELECT * FROM "Session"'), { code: "42501" });
      await db.exec('RESET ROLE; GRANT SELECT ON TABLE "Session" TO anon; SET ROLE anon;');
      assert.deepEqual((await db.query('SELECT * FROM "Session"')).rows, [], "RLS must still deny rows if SELECT is later granted.");
      await db.exec('RESET ROLE;');
      assert.equal((await db.query('SELECT count(*)::integer AS count FROM "Session"')).rows[0].count, 1);
    }
    console.log(`PASS ${supabaseDefaults ? "Supabase-style default grants" : "plain PostgreSQL without API roles"}: ${modelNames.length} models, ${expectedIndexes.length} indexes, types/nullability, defaults, bigint/timestamp, uniqueness, serial import continuation, private access.`);
  } finally {
    await db.close();
  }
}
console.log("SQL verified in local PGlite only; hosted PostgreSQL, Prisma network adapter and real-data import still require verification.");
