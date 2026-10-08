/* eslint-env node, es2020 */
import fs from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { validateDestination } from './import-sqlite-postgres.mjs';

const expectedProject = 'roggwnlqgjbrnrwzrjsm';
const saved = parseEnv(await fs.readFile(new URL('../.env.cloudflare-database', import.meta.url), 'utf8'));
if (saved.SUPABASE_PROJECT_REF !== expectedProject) throw new Error('Unexpected database project');
const connection = validateDestination(saved.MIGRATION_DATABASE_URL, expectedProject);
const url = new URL(connection);
const redact = value => String(value).replaceAll(connection, '[database connection]').replaceAll(decodeURIComponent(url.password), '[redacted]');
const certificatePath = fileURLToPath(new URL('../_recovery/supabase-prod-ca-2021.crt', import.meta.url));
const certificate = await fs.readFile(certificatePath, 'utf8');
const pool = new pg.Pool({ connectionString: connection, ssl: { rejectUnauthorized: true, ca: certificate }, max: 1, connectionTimeoutMillis: 15000 });
try {
  const result = await pool.query('SELECT current_user AS role, current_database() AS database');
  if (result.rows[0].role !== 'wolfshunter_app' || result.rows[0].database !== 'postgres') throw new Error('Unexpected connected database identity');
  console.log(JSON.stringify({ project: expectedProject, identityVerified: true, tlsVerified: true }));
} catch (error) {
  console.error(JSON.stringify({ connectionFailed: true, code: error.code, message: redact(error.message) }));
  process.exitCode = 1;
} finally {
  await pool.end();
}
if (!process.exitCode) {
  url.searchParams.set('sslmode', 'require');
  url.searchParams.set('sslaccept', 'strict');
  url.searchParams.set('sslcert', certificatePath);
  const args = process.argv.includes('--resolve-rolled-back')
    ? ['migrate', 'resolve', '--rolled-back', '20260918060000_postgresql_baseline']
    : ['migrate', 'deploy'];
  const child = spawn(process.execPath, [fileURLToPath(new URL('../node_modules/prisma/build/index.js', import.meta.url)), ...args], {
    cwd: fileURLToPath(new URL('../', import.meta.url)),
    env: { ...process.env, DATABASE_URL: url.toString() },
    windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
  console.log(redact(output));
  process.exitCode = code ?? 1;
}
