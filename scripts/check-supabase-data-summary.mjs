import fs from "node:fs/promises";
import { parseEnv } from "node:util";
import pg from "pg";
import { validateDestination } from "./import-sqlite-postgres.mjs";

const projectRef = "roggwnlqgjbrnrwzrjsm";
const env = parseEnv(
  await fs.readFile(new URL("../.env.cloudflare-database", import.meta.url), "utf8"),
);
const ca = await fs.readFile(
  new URL("../_recovery/supabase-prod-ca-2021.crt", import.meta.url),
  "utf8",
);
const pool = new pg.Pool({
  connectionString: validateDestination(env.MIGRATION_DATABASE_URL, projectRef),
  ssl: { rejectUnauthorized: true, ca },
  max: 1,
  connectionTimeoutMillis: 15000,
});

try {
  await pool.query("BEGIN TRANSACTION READ ONLY");
  const result = await pool.query(`
    SELECT
      (SELECT count(*) FROM public."Session") AS sessions,
      (SELECT count(*) FROM public."RetailerWorkspace") AS workspaces,
      (SELECT count(*) FROM public."RetailerSettings") AS settings,
      (SELECT count(*) FROM public."ImportedProductPush") AS imported_products,
      (SELECT count(*) FROM public."CatalogKnowledgeProduct") AS catalog_products,
      (SELECT count(*) FROM public."CatalogSyncRun") AS sync_runs,
      (SELECT count(*) FROM public."KnowledgeDocument") AS knowledge_documents,
      (SELECT count(*) FROM public."RetailerProductRelease") AS releases,
      (SELECT count(*) FROM public."RetailerOrder") AS orders,
      (SELECT count(*) FROM public."SupportCase") AS support_cases,
      (SELECT count(*) FROM public."BackgroundJob") AS background_jobs,
      (SELECT count(*) FROM public."RuntimeSourceState") AS runtime_source_states
  `);
  const sessions = await pool.query(`
    SELECT
      shop,
      "isOnline",
      "expires",
      "refreshTokenExpires",
      ("accessToken" IS NOT NULL) AS "hasAccessToken",
      ("refreshToken" IS NOT NULL) AS "hasRefreshToken"
    FROM public."Session"
    WHERE "isOnline" = false
    ORDER BY shop
  `);
  await pool.query("COMMIT");
  console.log(JSON.stringify({ counts: result.rows[0], offlineSessions: sessions.rows }));
} catch {
  await pool.query("ROLLBACK").catch(() => {});
  console.error("Read-only Supabase summary failed; no app data was changed.");
  process.exitCode = 1;
} finally {
  await pool.end();
}
