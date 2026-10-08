/* eslint-env node */
// Read-only check of the exact queries/normalization used by the deployed job.
import fs from 'node:fs/promises';
import { parseEnv } from 'node:util';
import pg from 'pg';
import { validateDestination } from './import-sqlite-postgres.mjs';
import { newCatalogCheckpoint, prepareCatalogStep } from '../app/services/source-catalog-job.server.ts';
import { prepareCommerceStep } from '../app/services/source-commerce-job.server.ts';

const shop = '3ddd6b-2.myshopify.com';
const env = parseEnv(await fs.readFile(new URL('../.env.cloudflare-database', import.meta.url), 'utf8'));
const pool = new pg.Pool({
  connectionString: validateDestination(env.MIGRATION_DATABASE_URL, 'roggwnlqgjbrnrwzrjsm'),
  ssl: { rejectUnauthorized: true, ca: await fs.readFile(new URL('../_recovery/supabase-prod-ca-2021.crt', import.meta.url), 'utf8') },
  max: 1, connectionTimeoutMillis: 15000,
});
try {
  const sessions = await pool.query('SELECT "accessToken" FROM public."Session" WHERE shop=$1 AND "isOnline"=false', [shop]);
  if (sessions.rowCount !== 1) throw new Error('Source session unavailable');
  const commerceCheck = ['markets', 'profiles'].includes(process.argv[2]);
  const admin = { async graphql(query, options) {
    const response = await fetch(`https://${shop}/admin/api/2026-07/graphql.json`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': sessions.rows[0].accessToken },
      body: JSON.stringify({ query, variables: options?.variables }), signal: AbortSignal.timeout(20000),
    });
    const body = await response.clone().json();
    console.log(JSON.stringify({ status: response.status, errors: body.errors?.map(error => String(error.message).replace(/[a-zA-Z0-9_-]{40,}/g, '[redacted]').slice(0, 240)) ?? [], requestedCost: body.extensions?.cost?.requestedQueryCost, actualCost: body.extensions?.cost?.actualQueryCost }));
    const page = body.data?.markets ?? body.data?.deliveryProfiles;
    if (commerceCheck && page) {
      console.log(JSON.stringify({ phase: process.argv[2], fetched: page.nodes.length, hasNextPage: page.pageInfo.hasNextPage, bytes: JSON.stringify(body.data).length }));
      return Response.json(body);
    }
    return response;
  } };
  if (commerceCheck) {
    const jobs = await pool.query('SELECT "stateJson" FROM public."BackgroundJob" WHERE shop=$1 AND kind=$2', [shop, 'source-commerce']);
    if (jobs.rowCount !== 1) throw new Error('Expected source commerce job');
    const checkpoint = JSON.parse(jobs.rows[0].stateJson);
    if (checkpoint.phase !== process.argv[2]) throw new Error('Requested phase already finished');
    await prepareCommerceStep(admin, shop, checkpoint);
  } else {
  const count = await prepareCatalogStep(admin, shop, newCatalogCheckpoint());
  const page = await prepareCatalogStep(admin, shop, count.state);
  console.log(JSON.stringify({ source: shop, exactCount: count.state.expectedCount, normalizedProducts: page.effects.length, pendingDetails: page.state.pending.length, phase: page.state.phase, persisted: false }));
  }
} catch (error) {
  console.error(JSON.stringify({ failed: true, code: error.code ?? error.name }));
  process.exitCode = 1;
} finally { await pool.end(); }
