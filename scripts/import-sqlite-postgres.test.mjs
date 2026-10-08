import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { Prisma } from '@prisma/client';
import { postgresValue, validateDestination, resetImportedSequences, normalizedSourceState } from './import-sqlite-postgres.mjs';

test('SQLite integers preserve booleans, large user IDs and millisecond dates', () => {
  const source = new DatabaseSync(':memory:');
  try {
    source.exec('CREATE TABLE sample (flag INTEGER, userId INTEGER, stamp INTEGER)');
    source.prepare('INSERT INTO sample VALUES (?,?,?)').run(1, 9007199254740993n, 1789700000123);
    const select = source.prepare('SELECT * FROM sample');
    select.setReadBigInts(true);
    const row = select.get();
    assert.equal(postgresValue({ name: 'flag', type: 'Boolean' }, row.flag), true);
    assert.equal(postgresValue({ name: 'userId', type: 'BigInt' }, row.userId), '9007199254740993');
    assert.equal(postgresValue({ name: 'stamp', type: 'DateTime' }, row.stamp), new Date(1789700000123).toISOString());
  } finally { source.close(); }
});

test('legacy SQLite date text is UTC and nullable values remain null', () => {
  assert.equal(postgresValue({ name: 'createdAt', type: 'DateTime' }, '2026-09-18 05:50:13'), '2026-09-18T05:50:13.000Z');
  assert.equal(postgresValue({ name: 'expires', type: 'DateTime' }, null), null);
  assert.equal(postgresValue({ name: 'accountOwner', type: 'Boolean' }, 0n), false);
  assert.throws(() => postgresValue({ name: 'flag', type: 'Boolean' }, 2), /Invalid boolean/);
  assert.throws(() => postgresValue({ name: 'id', type: 'Int' }, 9007199254740993n), /Invalid integer/);
  assert.throws(() => postgresValue({ name: 'id', type: 'Int' }, 2147483648), /Invalid integer/);
  assert.throws(() => postgresValue({ name: 'userId', type: 'BigInt' }, Number(9007199254740993n)), /Invalid bigint/);
  assert.throws(() => postgresValue({ name: 'userId', type: 'BigInt' }, 'fixture-private-value'), error =>
    error.message === 'Invalid bigint in userId' && !error.message.includes('fixture-private-value'));
});

test('destination must be the explicitly selected Supabase project', () => {
  const project = 'abcdefghijklmnopqrst';
  assert.equal(new URL(validateDestination(`postgres://migration:example@db.${project}.supabase.co/postgres`, project)).hostname, `db.${project}.supabase.co`);
  assert.equal(new URL(validateDestination(`postgres://migration.${project}:example@aws-0-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=disable`, project)).searchParams.has('sslmode'), false);
  assert.equal(new URL(validateDestination(`postgres://migration:example@db.${project}.supabase.co/postgres?host=example.com&database=other&ssl=0&sslmode=no-verify`, project)).search, '');
  assert.throws(() => validateDestination('postgres://migration.wrong:example@aws-0-eu-central-1.pooler.supabase.com/postgres', project), /does not match/);
  assert.throws(() => validateDestination(`postgres://migration:example@db.${project}.supabase.co.example.com/postgres`, project), /does not match/);
  assert.throws(() => validateDestination(`postgres://migration:example@db.${project}.supabase.co/other`, project), /Unexpected destination/);
});

test('interrupted source sync imports a valid terminal status and preserves source payload', () => {
  const payload = { status: 'RUNNING', startedAt: '2026-09-18T00:00:00Z', products: 10 };
  assert.equal(normalizedSourceState('sync-state', payload, 'fixture.myshopify.com').status, 'FAILED');
  assert.equal(payload.status, 'RUNNING');
  assert.throws(() => normalizedSourceState('commerce', { sourceShop: 'another.myshopify.com' }, 'fixture.myshopify.com'), /different shop/);
  assert.throws(() => normalizedSourceState('commerce', null, 'fixture.myshopify.com'), /must be an object/);
});

test('actual PostgreSQL sequences continue imported IDs even when runtime DMMF omits defaults',
  async () => {
    const { PGlite } = await import('@electric-sql/pglite');
    const db = await PGlite.create();
    try {
      await db.exec(readFileSync(new URL('../prisma/migrations/20260918060000_postgresql_baseline/migration.sql', import.meta.url), 'utf8'));
      const orderModel = Prisma.dmmf.datamodel.models.find(model => model.name === 'RetailerOrder');
      await db.exec(`INSERT INTO public."RetailerOrder" (id, shop, "shopifyOrderId", "createdAt", "updatedAt")
        VALUES (314, 'fixture.myshopify.com', 'fixture-order', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`);
      await resetImportedSequences(db, orderModel.name, orderModel.fields);
      assert.equal((await db.query(`INSERT INTO public."RetailerOrder" (shop, "shopifyOrderId", "createdAt", "updatedAt")
        VALUES ('fixture.myshopify.com', 'fixture-order-2', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING id`)).rows[0].id, 315);
      const releaseModel = Prisma.dmmf.datamodel.models.find(model => model.name === 'RetailerProductRelease');
      await resetImportedSequences(db, releaseModel.name, releaseModel.fields);
      assert.equal((await db.query(`INSERT INTO public."RetailerProductRelease" ("retailerShop", "sourceProductId", "sourceTitle", "updatedAt")
        VALUES ('fixture.myshopify.com', 'fixture-product', 'Fixture', CURRENT_TIMESTAMP) RETURNING id`)).rows[0].id, 1);
    } finally { await db.close(); }
  });
