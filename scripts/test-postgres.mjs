/* eslint-env node, es2020 */
// Real Prisma + PostgreSQL semantics; serialized local transport, no hosted credentials.
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import pg from 'pg';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

class TestPool extends pg.Pool {
  constructor(database) { super({ max: 1 }); this.database = database; this.tail = Promise.resolve(); }
  async acquire() {
    const previous = this.tail;
    let unlock;
    this.tail = new Promise(resolve => { unlock = resolve; });
    await previous;
    return unlock;
  }
  async execute(query, values) {
    const config = typeof query === 'string' ? { text: query } : query;
    const parsers = config.types ? Object.fromEntries(
      [16, 20, 21, 23, 25, 114, 700, 701, 1043, 1082, 1114, 1184, 1700, 3802]
        .map(oid => [oid, config.types.getTypeParser(oid, 'text')]),
    ) : undefined;
    const result = await this.database.query(config.text, values ?? config.values ?? [], {
      ...(config.rowMode ? { rowMode: config.rowMode } : {}), ...(parsers ? { parsers } : {}),
    });
    return { ...result, rowCount: result.affectedRows ?? result.rows.length };
  }
  async query(query, values) {
    const unlock = await this.acquire();
    try { return await this.execute(query, values); } finally { unlock(); }
  }
  async connect() {
    const unlock = await this.acquire();
    const client = new EventEmitter();
    client.query = (query, values) => this.execute(query, values);
    let released = false;
    client.release = () => { if (!released) { released = true; unlock(); } };
    return client;
  }
  async end() { await this.tail; }
}

export async function createTestDatabase() {
  const entry = process.env.PGLITE_MODULE_URL ?? '@electric-sql/pglite';
  const { PGlite } = await import(entry);
  const database = await PGlite.create();
  await database.exec(readFileSync(new URL('../prisma/migrations/20260918060000_postgresql_baseline/migration.sql', import.meta.url), 'utf8'));
  const pool = new TestPool(database);
  const db = new PrismaClient({ adapter: new PrismaPg(pool) });
  return { db, async close() { await db.$disconnect(); await pool.end(); await database.close(); } };
}
