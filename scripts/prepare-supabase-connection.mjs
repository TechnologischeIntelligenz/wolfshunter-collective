import fs from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { parseEnv } from 'node:util';

const project = 'roggwnlqgjbrnrwzrjsm';
const role = 'wolfshunter_app';
const secretsFile = new URL('../.env.cloudflare-database', import.meta.url);
let password;
try {
  const saved = parseEnv(await fs.readFile(secretsFile, 'utf8'));
  const url = new URL(saved.MIGRATION_DATABASE_URL);
  if (saved.SUPABASE_PROJECT_REF !== project || decodeURIComponent(url.username) !== `${role}.${project}`) throw new Error('Existing database configuration belongs to a different target');
  password = decodeURIComponent(url.password);
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  password = randomBytes(32).toString('hex');
  const migration = `postgresql://${role}.${project}:${password}@aws-0-eu-west-1.pooler.supabase.com:5432/postgres`;
  await fs.writeFile(secretsFile, `SUPABASE_PROJECT_REF=${project}\nMIGRATION_DATABASE_URL=${migration}\nDATABASE_URL=${migration}\n`, { flag: 'wx', mode: 0o600 });
}
if (!/^[0-9a-f]{64}$/.test(password)) throw new Error('Unexpected generated password format');
// A dedicated login owns only the new app tables. Never reset an existing role.
const query = `BEGIN;
CREATE ROLE ${role} LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
GRANT USAGE, CREATE ON SCHEMA public TO ${role};
GRANT ${role} TO postgres;
COMMIT;`;
const directory = new URL('../_recovery/', import.meta.url);
await fs.mkdir(directory, { recursive: true });
await fs.writeFile(new URL('create-supabase-role.json', directory), JSON.stringify({ server: 'supabase-wolfshunter', tool: 'execute_sql', arguments: { query } }), { mode: 0o600 });
console.log('Prepared a dedicated app database login and ignored local connection file. No credentials printed.');
