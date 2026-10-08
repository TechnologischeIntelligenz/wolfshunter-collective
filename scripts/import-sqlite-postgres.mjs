/* eslint-env node, es2020 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs, parseEnv } from 'node:util';
import { DatabaseSync } from 'node:sqlite';
import { Prisma } from '@prisma/client';
import pg from 'pg';

const identifier = value => `"${value.replaceAll('"', '""')}"`;
const qualifiedTable = value => `public.${identifier(value)}`;
const legacyModels = ['Session', 'RetailerWorkspace', 'RetailerSettings', 'ImportedProductPush',
  'CatalogKnowledgeProduct', 'CatalogSyncRun', 'KnowledgeDocument', 'RetailerProductRelease', 'RetailerOrder', 'SupportCase'];

class ImportValidationError extends Error {}

export function postgresValue(field, value) {
  if (value === null || value === undefined) return null;
  if (field.type === 'Boolean') {
    if (![true, false, 0, 1, 0n, 1n].includes(value)) throw new ImportValidationError(`Invalid boolean in ${field.name}`);
    return value === true || value === 1 || value === 1n;
  }
  if (field.type === 'DateTime') {
    let input = typeof value === 'bigint' ? Number(value) : value;
    if (typeof input === 'string' && /^\d{4}-\d\d-\d\d[ T]\d\d:\d\d:\d\d(?:\.\d+)?$/.test(input)) input = input.replace(' ', 'T') + 'Z';
    const date = new Date(input);
    if (!Number.isFinite(date.getTime())) throw new ImportValidationError(`Invalid date in ${field.name}`);
    return date.toISOString();
  }
  if (field.type === 'BigInt') {
    // BigInt(number) cannot recover precision already lost by a Number reader.
    if (typeof value === 'number' && !Number.isSafeInteger(value)) throw new ImportValidationError(`Invalid bigint in ${field.name}`);
    let number;
    try { number = BigInt(value); } catch { throw new ImportValidationError(`Invalid bigint in ${field.name}`); }
    if (number < -9223372036854775808n || number > 9223372036854775807n) throw new ImportValidationError(`Invalid bigint in ${field.name}`);
    return number.toString();
  }
  if (field.type === 'Int') {
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number < -2147483648 || number > 2147483647) throw new ImportValidationError(`Invalid integer in ${field.name}`);
    return number;
  }
  if (field.type === 'Float') {
    const number = Number(value);
    if (!Number.isFinite(number)) throw new ImportValidationError(`Invalid number in ${field.name}`);
    return number;
  }
  return value;
}

export async function resetImportedSequences(client, tableName, fields) {
  // The engineType=client runtime DMMF omits field.default. Query PostgreSQL's
  // actual sequence ownership instead, including empty imported tables.
  const table = qualifiedTable(tableName);
  for (const field of fields.filter(candidate => candidate.type === 'Int' || candidate.type === 'BigInt')) {
    const name = field.dbName ?? field.name;
    const result = await client.query('SELECT pg_get_serial_sequence($1,$2) AS sequence', [table, name]);
    if (!result.rows[0].sequence) continue;
    await client.query(`SELECT setval($1::regclass, COALESCE((SELECT max(${identifier(name)}) FROM ${table}),1), EXISTS(SELECT 1 FROM ${table}))`, [result.rows[0].sequence]);
  }
}

export function normalizedSourceState(kind, payload, sourceShop) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new ImportValidationError('Source state must be an object');
  if (payload.sourceShop && payload.sourceShop !== sourceShop) throw new ImportValidationError('Source state belongs to a different shop');
  if (kind === 'sync-state' && payload.status === 'RUNNING') {
    // SourceSyncState accepts RUNNING/COMPLETED/FAILED; IDLE is not valid.
    return { ...payload, status: 'FAILED', message: 'Local synchronization was interrupted before the hosting migration.' };
  }
  return payload;
}

export function validateDestination(connectionString, expectedProject) {
  const url = new URL(connectionString);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new ImportValidationError('A PostgreSQL connection is required');
  if (!/^[a-z0-9]{20}$/.test(expectedProject ?? '')) throw new ImportValidationError('Pass the exact Supabase project reference with --target-project');
  const direct = url.hostname === `db.${expectedProject}.supabase.co`;
  const pooled = url.hostname.endsWith('.pooler.supabase.com') && decodeURIComponent(url.username).endsWith(`.${expectedProject}`);
  if (!direct && !pooled) throw new ImportValidationError('Database URL does not match the confirmed Supabase project');
  if (url.pathname !== '/postgres') throw new ImportValidationError('Unexpected destination database');
  // pg-connection-string allows query parameters to override host/database and
  // TLS after URL parsing. Keep the verified URL identity and explicit Pool TLS.
  url.search = '';
  url.hash = '';
  return url.toString();
}

export async function main(args = process.argv.slice(2)) {
  const { values } = parseArgs({ args, options: {
    source: { type: 'string', default: 'prisma/dev.sqlite' },
    'source-shop': { type: 'string', default: '3ddd6b-2.myshopify.com' },
    'target-project': { type: 'string' },
    'env-file': { type: 'string' },
    apply: { type: 'boolean', default: false },
  } });
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(values['source-shop'])) throw new ImportValidationError('Invalid source shop');
  const sqlite = new DatabaseSync(path.resolve(values.source), { readOnly: true });
  let client;
  let pool;
  try {
    // Hold one read snapshot across counts, validation and asynchronous inserts.
    sqlite.exec('BEGIN');
    const existingTables = new Set(sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row => row.name));
    for (const modelName of legacyModels) {
      if (!existingTables.has(modelName)) throw new ImportValidationError(`Source is missing ${modelName}; import cancelled`);
    }
    const models = Prisma.dmmf.datamodel.models.filter(model => existingTables.has(model.dbName ?? model.name));
    const counts = Object.fromEntries(models.map(model => {
      const table = identifier(model.dbName ?? model.name);
      return [model.name, sqlite.prepare(`SELECT COUNT(*) AS total FROM ${table}`).get().total];
    }));
    // Dry-run validates every source value, not merely the table counts.
    for (const model of models) {
      const table = identifier(model.dbName ?? model.name);
      const columns = new Set(sqlite.prepare(`PRAGMA table_info(${table})`).all().map(row => row.name));
      const fields = model.fields.filter(field => field.kind === 'scalar' && columns.has(field.dbName ?? field.name));
      const statement = sqlite.prepare(`SELECT ${fields.map(field => identifier(field.dbName ?? field.name)).join(',')} FROM ${table}`);
      statement.setReadBigInts(true);
      for (const row of statement.iterate()) {
        for (const field of fields) postgresValue(field, row[field.dbName ?? field.name]);
      }
    }
    console.log(JSON.stringify({ mode: values.apply ? 'apply' : 'dry-run', sourceTables: counts }));
    if (!values.apply) return counts;

    const env = values['env-file'] ? parseEnv(await fs.readFile(values['env-file'], 'utf8')) : process.env;
    if (!env.MIGRATION_DATABASE_URL) throw new ImportValidationError('MIGRATION_DATABASE_URL is required; its value is never printed');
    const connectionString = validateDestination(env.MIGRATION_DATABASE_URL, values['target-project']);
    pool = new pg.Pool({ connectionString, ssl: { rejectUnauthorized: true }, max: 1, connectionTimeoutMillis: 15000 });
    client = await pool.connect();
    await client.query('BEGIN');
    await client.query("SET LOCAL statement_timeout = '120s'");
    await client.query("SET LOCAL lock_timeout = '15s'");
    await client.query('SET LOCAL search_path TO public');
    // Keep the emptiness check valid until COMMIT: block concurrent writers and
    // competing imports while allowing readers. This never clears existing data.
    await client.query(`LOCK TABLE ${Prisma.dmmf.datamodel.models.map(model => qualifiedTable(model.dbName ?? model.name)).join(',')} IN SHARE ROW EXCLUSIVE MODE`);
    // This importer never replaces an existing destination dataset.
    for (const model of Prisma.dmmf.datamodel.models) {
      const table = qualifiedTable(model.dbName ?? model.name);
      const result = await client.query(`SELECT COUNT(*)::int AS total FROM ${table}`);
      if (result.rows[0].total !== 0) throw new ImportValidationError(`Destination ${model.name} is not empty; import cancelled`);
    }
    for (const model of models) {
      const tableName = model.dbName ?? model.name;
      const table = identifier(tableName);
      const columns = new Set(sqlite.prepare(`PRAGMA table_info(${table})`).all().map(row => row.name));
      const fields = model.fields.filter(field => field.kind === 'scalar' && columns.has(field.dbName ?? field.name));
      const names = fields.map(field => identifier(field.dbName ?? field.name));
      const statement = sqlite.prepare(`SELECT ${names.join(',')} FROM ${table}`);
      statement.setReadBigInts(true);
      let batch = [];
      const flush = async () => {
        if (!batch.length) return;
        const parameters = [];
        const rows = batch.map(row => '(' + fields.map(field => {
          parameters.push(postgresValue(field, row[field.dbName ?? field.name]));
          return '$' + parameters.length;
        }).join(',') + ')');
        await client.query(`INSERT INTO ${qualifiedTable(tableName)} (${names.join(',')}) VALUES ${rows.join(',')}`, parameters);
        batch = [];
      };
      for (const row of statement.iterate()) {
        batch.push(row);
        if (batch.length === 100) await flush();
      }
      await flush();
      const result = await client.query(`SELECT COUNT(*)::int AS total FROM ${qualifiedTable(tableName)}`);
      if (result.rows[0].total !== counts[model.name]) throw new ImportValidationError(`Row count mismatch for ${model.name}`);
      await resetImportedSequences(client, tableName, fields);
      console.log(JSON.stringify({ imported: model.name, rows: result.rows[0].total }));
    }
    if (Prisma.dmmf.datamodel.models.some(model => model.name === 'RuntimeSourceState')) {
      for (const [kind, filename] of [['commerce', 'commerce.json'], ['sync-state', 'sync-state.json']]) {
        const file = path.resolve('data', values['source-shop'], filename);
        let raw;
        try { raw = await fs.readFile(file, 'utf8'); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
        const payload = normalizedSourceState(kind, JSON.parse(raw), values['source-shop']);
        await client.query('INSERT INTO public."RuntimeSourceState" ("shop","kind","payloadJson","updatedAt") VALUES ($1,$2,$3,NOW())', [values['source-shop'], kind, JSON.stringify(payload)]);
      }
    }
    await client.query('COMMIT');
    console.log('Import committed after all table counts matched. Original SQLite was opened read-only.');
    return counts;
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    sqlite.close();
    client?.release();
    await pool?.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => {
    // PostgreSQL error detail can contain row values, including access tokens.
    console.error(JSON.stringify({ failed: true, code: error.code ?? 'IMPORT_FAILED', message: error instanceof ImportValidationError ? error.message : 'Import failed; transaction rolled back. No row values are logged.' }));
    process.exitCode = 1;
  });
}
