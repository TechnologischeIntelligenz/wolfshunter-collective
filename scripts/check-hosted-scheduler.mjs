/* eslint-env node */
// Enqueue/status only: this process never executes a job or calls Shopify.
// The deployed Cloudflare scheduled handler must advance the persisted job.
import fs from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { validateDestination } from './import-sqlite-postgres.mjs';

// Application timestamps are stored as UTC without a zone; do not reinterpret
// them using the operator's Windows timezone when displaying live evidence.
pg.types.setTypeParser(1114, value => new Date(value.replace(' ', 'T') + 'Z'));

const mode = process.argv[2];
if (!['enqueue', 'status'].includes(mode)) throw new Error('Use enqueue or status');
const target = process.argv[3] ?? 'orders';
if (!['orders', 'commerce'].includes(target)) throw new Error('Use orders or commerce');
const shop = target === 'commerce' ? '3ddd6b-2.myshopify.com' : 'wolfshunter-ai-dev.myshopify.com';
const kind = target === 'commerce' ? 'source-commerce' : 'orders';
const env = parseEnv(await fs.readFile(new URL('../.env.cloudflare-database', import.meta.url), 'utf8'));
const pool = new pg.Pool({
  connectionString: validateDestination(env.MIGRATION_DATABASE_URL, 'roggwnlqgjbrnrwzrjsm'),
  ssl: { rejectUnauthorized: true, ca: await fs.readFile(new URL('../_recovery/supabase-prod-ca-2021.crt', import.meta.url), 'utf8') },
  max: 1, connectionTimeoutMillis: 15000,
});
try {
  if (mode === 'enqueue') {
    const sessions = await pool.query('SELECT id FROM public."Session" WHERE shop=$1 AND "isOnline"=false AND scope LIKE $2', [shop, target === 'commerce' ? '%read_shipping%' : '%read_orders%']);
    if (sessions.rows.length !== 1) throw new Error('Shop access is not configured');
    const startedAt = new Date();
    const since = new Date(startedAt.getTime() - 60 * 86400000);
    const state = target === 'commerce' ? {
      phase: 'info', startedAt: startedAt.toISOString(), after: null, recentCursors: [], pages: 0, snapshot: null,
    } : {
      query: `created_at:>='${since.toISOString()}' updated_at:<='${startedAt.toISOString()}'`,
      after: null, recentCursors: [], startedAt: startedAt.toISOString(),
      triggeredBy: 'hosting-verification', scanned: 0, synced: 0, pages: 0,
    };
    const inserted = await pool.query(
      'INSERT INTO public."BackgroundJob" (id,shop,kind,"stateJson","updatedAt") VALUES ($1,$2,$3,$4,NOW()) ON CONFLICT (shop,kind) DO NOTHING RETURNING id',
      [`hosting-smoke-${randomUUID()}`, shop, kind, JSON.stringify(state)],
    );
    console.log(JSON.stringify({ enqueued: inserted.rowCount === 1, preservedExistingJob: inserted.rowCount === 0 }));
  }
  const result = await pool.query(
    'SELECT id,status,revision,attempts,"createdAt","updatedAt","nextRunAt","errorMessage", "stateJson"::jsonb->>\'pages\' AS pages,"stateJson"::jsonb->>\'synced\' AS synced,"stateJson"::jsonb->>\'phase\' AS phase,"stateJson"::jsonb->>\'triggeredBy\' AS "triggeredBy" FROM public."BackgroundJob" WHERE shop=$1 AND kind=$2',
    [shop, kind],
  );
  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), shop, jobs: result.rows }));
  if (target === 'commerce') {
    const counts = await pool.query(`SELECT
      jsonb_array_length("stateJson"::jsonb #> '{snapshot,markets}') AS "processedMarkets",
      jsonb_array_length("stateJson"::jsonb #> '{snapshot,profiles}') AS "processedProfiles"
      FROM public."BackgroundJob" WHERE shop=$1 AND kind=$2`, [shop, kind]);
    const saved = await pool.query(`SELECT
      jsonb_array_length("payloadJson"::jsonb -> 'markets') AS markets,
      jsonb_array_length("payloadJson"::jsonb -> 'profiles') AS profiles,
      "payloadJson"::jsonb ->> 'syncedAt' AS "syncedAt"
      FROM public."RuntimeSourceState" WHERE shop=$1 AND kind='commerce'`, [shop]);
    console.log(JSON.stringify({ progress: counts.rows, savedSnapshot: saved.rows }));
  }
} catch (error) {
  console.error(JSON.stringify({ failed: true, code: error.code ?? error.name }));
  process.exitCode = 1;
} finally { await pool.end(); }
