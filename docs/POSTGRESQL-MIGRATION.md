# PostgreSQL migration preparation — 2026-09-18

This isolated Cloudflare test copy now has a PostgreSQL migration history. No hosted database has been created, connected, migrated, or imported by this preparation.

## Files and preserved history

- `prisma/schema.prisma`: the existing ten models retain their fields, defaults, unique keys and indexes. `BackgroundJob` adds durable job leases/checkpoints; `RuntimeSourceState` holds small source metadata. Product records stay in `CatalogKnowledgeProduct`.
- `prisma/migrations/20260918060000_postgresql_baseline/migration.sql`: generated with installed Prisma 6.19.3 for twelve models and twenty-one secondary/unique indexes, plus primary keys.
- `prisma/migrations/migration_lock.toml`: PostgreSQL provider.
- `prisma/sqlite-migrations-archive`: all seven original SQLite migration SQL files, moved unchanged and verified by SHA-256 before and after the move. The original recovered project, snapshot ZIP and SQLite database were not modified.
- `scripts/prepare-postgresql-baseline.mjs`: reproducibly checks the unapplied baseline against the current Prisma schema. Its `--write` mode refuses to overwrite an existing baseline.
- `scripts/verify-postgresql-baseline.mjs`: executes the migration in isolated, in-memory PGlite and checks real PostgreSQL behavior.

## Apply only to a dedicated empty application database

The new Supabase project must first be selected and provisioned within the authorized free plan. Use a server-side PostgreSQL connection owned by the migration role. Keep credentials in environment variables or the deployment secret store; never pass them in command-line arguments, chat, source control or client assets.

With `DATABASE_URL` already supplied securely and pointing to the intended PostgreSQL database:

```powershell
node node_modules/prisma/build/index.js validate
node node_modules/prisma/build/index.js migrate status
node node_modules/prisma/build/index.js migrate deploy
```

`npm run setup` also invokes `prisma migrate deploy`; it now sees only the PostgreSQL history. The old `.env` still contains the SQLite URL until hosting credentials are configured. Do not run setup against unrelated projects or use `migrate resolve --applied` to skip creation on an empty database. A preexisting application schema requires inspection and a separate migration plan.

After this baseline has been applied anywhere, treat it as immutable. Make future schema changes in new migrations. Do not replace PostgreSQL's `_prisma_migrations` with the SQLite migration history.

## Private server-side access

Table creation, indexes and access controls run in one explicit `BEGIN`/`COMMIT` transaction. Every application table enables RLS; `_prisma_migrations` is protected too when Prisma has created it. No browser policies are added. The app authenticates merchants through Shopify and queries PostgreSQL on the server.

The migration revokes all table and owned serial-sequence privileges from `PUBLIC` and, when they exist, `anon`, `authenticated` and `service_role`. Guarding role existence keeps ordinary PostgreSQL development compatible. No unrelated table, role, policy or schema permission is changed. Future migrations must protect each new table before committing, because this baseline does not change database-wide default privileges.

RLS is enabled without `FORCE ROW LEVEL SECURITY`: the migration/table owner retains access for migration and import. Before switching the Worker to a separate restricted runtime role, grant only the required table/sequence operations and create explicit server-role RLS policies. Do not assume a new non-owner role can query these tables. Shopify shop scoping remains necessary in server queries; this access control blocks direct Data API access, not mistakes within privileged server queries.

## Data conversion contract

The schema conversion deliberately keeps the existing application semantics:

| Existing Prisma value | PostgreSQL representation | Import requirement |
| --- | --- | --- |
| `String`, including serialized JSON | `text` | Keep the exact string; do not silently convert JSON strings to JSONB. |
| `Boolean` | `boolean` | Convert SQLite `0`/`1` to false/true; preserve nullable fields. |
| `BigInt` session user IDs | `bigint` | Read SQLite integers as bigint or decimal strings, never through an unsafe JavaScript number. |
| `DateTime` | `timestamp(3)` | Interpret SQLite epoch milliseconds/ISO values explicitly as UTC, preserving milliseconds and nulls. |
| `Float` | `double precision` | Preserve existing values; no decimal-money redesign is included. |
| `Int @default(autoincrement())` | `serial` | Preserve IDs, then advance each sequence to the imported maximum. |
| `@updatedAt` | Non-null timestamp without a SQL default | Copy historical values; Prisma supplies timestamps for future writes. |

The two new models start empty. Import the ten existing model tables in bounded batches and compare table counts and selected normalized values against the source before enabling the merchant workspace. Preserve the source database and do not import `_prisma_migrations` or `sqlite_sequence`.

## Verification performed

Prisma schema validation, client generation and `prepare-postgresql-baseline.mjs --check` passed. No native `postgres`, `psql`, `initdb`, Docker or Supabase CLI was available locally. PGlite 0.5.8 was installed separately at `../wolfshunter-postgres-validation`; it is not a dependency of the deployed app.

```powershell
node scripts/prepare-postgresql-baseline.mjs --check
node scripts/verify-postgresql-baseline.mjs ../wolfshunter-postgres-validation/node_modules/@electric-sql/pglite/dist/index.js
```

Both test databases passed: ordinary PostgreSQL with no Supabase API roles, and PostgreSQL simulating Supabase's automatic table/sequence grants. Checks cover all twelve model column types/nullability, twenty-one indexes, defaults, a bigint above JavaScript's safe integer range, millisecond timestamps, uniqueness, serial continuation after explicit-ID import, RLS on all tables, and removal of API role privileges. The tests also prove RLS returns no session rows if `anon` later receives SELECT permission.

These are local PostgreSQL-engine checks. Hosted Supabase connectivity, the Prisma network adapter, production access privileges, real-data import and end-to-end merchant flows remain separate checks.

Sources: [Supabase Data API security](https://supabase.com/docs/guides/api/securing-your-api), [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security), [PGlite API](https://pglite.dev/docs/api). Prisma CLI flags were verified against the installed 6.19.3 help output.
