import fs from 'node:fs/promises';
import { parseEnv } from 'node:util';
import pg from 'pg';
import { validateDestination } from './import-sqlite-postgres.mjs';
const env = parseEnv(await fs.readFile(new URL('../.env.cloudflare-database', import.meta.url), 'utf8'));
const pool = new pg.Pool({ connectionString: validateDestination(env.MIGRATION_DATABASE_URL, 'roggwnlqgjbrnrwzrjsm'), ssl: { rejectUnauthorized: true, ca: await fs.readFile(new URL('../_recovery/supabase-prod-ca-2021.crt', import.meta.url),'utf8') }, max: 1, connectionTimeoutMillis: 15000 });
const client = await pool.connect();
try {
  console.log(JSON.stringify({ tables: (await client.query("SELECT tablename,tableowner FROM pg_tables WHERE schemaname='public'")).rows }));
  const sql = (await fs.readFile(new URL('../prisma/migrations/20260918060000_postgresql_baseline/migration.sql', import.meta.url),'utf8')).replace(/COMMIT;\s*$/, '');
  await client.query(sql);
  console.log('Baseline SQL succeeds in rollback-only diagnostic.');
} catch (error) {
  console.log(JSON.stringify({ code: error.code, message: error.message, detail: error.detail, where: error.where, position: error.position }));
} finally {
  await client.query('ROLLBACK');
  client.release();
  await pool.end();
}
