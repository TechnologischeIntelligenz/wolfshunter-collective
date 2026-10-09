/* eslint-env node, es2020 */
// Run: node --experimental-test-module-mocks --experimental-strip-types --test scripts/durable-job-postgres.test.mjs
// Uses the real Prisma client, PrismaPg adapter and durable-job.server.ts. Only
// pg's network transport is replaced by a serialized local PGlite connection.
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { setImmediate } from 'node:timers/promises';
import test, { mock } from 'node:test';
import pg from 'pg';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const baseline = new URL('../prisma/migrations/20260918060000_postgresql_baseline/migration.sql', import.meta.url);

class PGlitePool extends pg.Pool {
  constructor(database) {
    super({ max: 1 });
    this.database = database;
    this.tail = Promise.resolve();
  }
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
      ...(config.rowMode ? { rowMode: config.rowMode } : {}),
      ...(parsers ? { parsers } : {}),
    });
    return { ...result, rowCount: result.affectedRows ?? result.rows.length };
  }
  async query(query, values) {
    const unlock = await this.acquire();
    try { return await this.execute(query, values); } finally { unlock(); }
  }
  async connect() {
    const unlock = await this.acquire();
    const connection = new EventEmitter();
    connection.query = (query, values) => this.execute(query, values);
    let released = false;
    connection.release = () => {
      if (released) return;
      released = true;
      unlock();
    };
    return connection;
  }
  async end() { await this.tail; }
}

const checkpoint = (after = null) => ({ after, pages: after ? 1 : 0 });
const step = (after = 'page-1', done = true) => ({ state: checkpoint(after), done, effects: { saved: after } });

test('durable job Prisma operations against PostgreSQL', async t => {
  const { PGlite } = await import('@electric-sql/pglite');
  const database = await PGlite.create();
  await database.exec(readFileSync(baseline, 'utf8'));
  const pool = new PGlitePool(database);
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  const mocked = mock.module(new URL('../app/db.server.ts', import.meta.url).href, { defaultExport: prisma });
  const { prismaJobStore, enqueueBackgroundJob, cancelBackgroundJobs } = await import('../app/services/durable-job.server.ts');
  t.after(async () => {
    mocked.restore();
    await prisma.$disconnect();
    await pool.end();
    await database.close();
  });
  let fixture = 0;
  const newShop = () => `job-${++fixture}.myshopify.com`;
  const effect = async (tx, lease, work) => {
    await tx.runtimeSourceState.upsert({
      where: { shop_kind: { shop: lease.shop, kind: 'job-effect' } },
      create: { shop: lease.shop, kind: 'job-effect', payloadJson: JSON.stringify(work.effects) },
      update: { payloadJson: JSON.stringify(work.effects) },
    });
  };
  const getRow = shop => prisma.backgroundJob.findUniqueOrThrow({ where: { shop_kind: { shop, kind: 'orders' } } });

  await t.test('two simultaneous claims have exactly one winner and repeated enqueue preserves its checkpoint', async () => {
    const shop = newShop();
    await enqueueBackgroundJob(shop, 'orders', checkpoint());
    const stores = [prismaJobStore(shop, 'orders', effect), prismaJobStore(shop, 'orders', effect)];
    const claims = await Promise.all(stores.map(store => store.claim()));
    assert.equal(claims.filter(Boolean).length, 1);
    const winner = claims.find(Boolean);
    assert.equal(winner.attempts, 1);
    await enqueueBackgroundJob(shop, 'orders', checkpoint('must-not-replace'));
    const row = await getRow(shop);
    assert.equal(row.leaseToken, winner.token);
    assert.deepEqual(JSON.parse(row.stateJson), checkpoint());
    assert.equal(row.revision, 1);
    assert.equal(await stores[claims.findIndex(Boolean)].commit(winner, step()), true);
    assert.equal((await getRow(shop)).status, 'COMPLETED');
  });

  await t.test('reclaimed expired lease rejects stale success and failure without touching new work', async () => {
    const shop = newShop();
    await enqueueBackgroundJob(shop, 'orders', checkpoint());
    const store = prismaJobStore(shop, 'orders', effect);
    const oldLease = await store.claim();
    await prisma.backgroundJob.update({ where: { id: oldLease.id }, data: { leaseExpiresAt: new Date(0) } });
    const replacement = await store.claim();
    assert(replacement);
    assert.notEqual(replacement.token, oldLease.token);
    assert.equal(replacement.attempts, 2);
    assert.equal(await store.commit(oldLease, step('stale')), false);
    assert.equal(await store.fail(oldLease), 'lease-lost');
    assert.equal((await getRow(shop)).leaseToken, replacement.token);
    assert.equal(await prisma.runtimeSourceState.count({ where: { shop } }), 0);
    assert.equal(await store.commit(replacement, step('fresh')), true);
    assert.deepEqual(JSON.parse((await prisma.runtimeSourceState.findFirstOrThrow({ where: { shop } })).payloadJson), { saved: 'fresh' });
  });

  await t.test('expired lease cannot commit even before another worker claims it', async () => {
    const shop = newShop();
    await enqueueBackgroundJob(shop, 'orders', checkpoint());
    const store = prismaJobStore(shop, 'orders', effect);
    const lease = await store.claim();
    await prisma.backgroundJob.update({ where: { id: lease.id }, data: { leaseExpiresAt: new Date(0) } });
    assert.equal(await store.commit(lease, step()), false);
    assert.equal(await prisma.runtimeSourceState.count({ where: { shop } }), 0);
    assert.deepEqual(JSON.parse((await getRow(shop)).stateJson), checkpoint());
  });

  await t.test('persisted effects and checkpoint roll back together when the checkpoint write fails', async () => {
    const shop = newShop();
    await enqueueBackgroundJob(shop, 'orders', checkpoint());
    const store = prismaJobStore(shop, 'orders', effect);
    const lease = await store.claim();
    const before = await getRow(shop);
    // The real SQL constraint fails only at the final checkpoint UPDATE, after
    // persist has written its effect inside the same interactive transaction.
    await database.exec(`ALTER TABLE public."BackgroundJob" ADD CONSTRAINT fixture_reject_completion
      CHECK (status <> 'COMPLETED') NOT VALID`);
    try { await assert.rejects(store.commit(lease, step())); }
    finally { await database.exec('ALTER TABLE public."BackgroundJob" DROP CONSTRAINT fixture_reject_completion'); }
    assert.equal(await prisma.runtimeSourceState.count({ where: { shop } }), 0);
    const after = await getRow(shop);
    assert.equal(after.revision, before.revision);
    assert.equal(after.leaseToken, lease.token);
    assert.deepEqual(JSON.parse(after.stateJson), checkpoint());
    assert.equal(await store.commit(lease, step('retry-succeeds')), true);
  });

  await t.test('cancellation before commit fences late effects and cannot be undone by repeated enqueue', async () => {
    const shop = newShop();
    await enqueueBackgroundJob(shop, 'orders', checkpoint());
    const store = prismaJobStore(shop, 'orders', effect);
    const lease = await store.claim();
    assert.equal(await cancelBackgroundJobs(shop, 'orders'), true);
    assert.equal(await store.commit(lease, step()), false);
    assert.equal(await store.fail(lease), 'lease-lost');
    await enqueueBackgroundJob(shop, 'orders', checkpoint('late-enqueue'));
    assert.equal((await getRow(shop)).status, 'CANCELLED');
    assert.equal(await prisma.runtimeSourceState.count({ where: { shop } }), 0);
  });

  await t.test('fail schedules a bounded retry, preserves the checkpoint and stops at attempt five', async () => {
    const shop = newShop();
    await enqueueBackgroundJob(shop, 'orders', checkpoint('committed-page'));
    const store = prismaJobStore(shop, 'orders', effect);
    const firstLease = await store.claim();
    const started = Date.now();
    assert.equal(await store.fail(firstLease), 'retry');
    const retry = await getRow(shop);
    assert.equal(retry.status, 'PENDING');
    assert.equal(retry.leaseToken, null);
    assert(retry.nextRunAt.getTime() >= started + 5000);
    assert.deepEqual(JSON.parse(retry.stateJson), checkpoint('committed-page'));
    assert.equal(await store.claim(), null);
    await prisma.backgroundJob.update({ where: { id: retry.id }, data: { attempts: 4, nextRunAt: new Date(0) } });
    const finalLease = await store.claim();
    assert.equal(finalLease.attempts, 5);
    assert.equal(await store.fail(finalLease), 'failed');
    assert.equal((await getRow(shop)).status, 'FAILED');
    assert.equal(await store.claim(), null);
    assert.equal(await prisma.runtimeSourceState.count({ where: { shop } }), 0);
  });

  await t.test('competing restart requests advance terminal revision only once', async () => {
    const shop = newShop();
    await enqueueBackgroundJob(shop, 'orders', checkpoint());
    const store = prismaJobStore(shop, 'orders', effect);
    const lease = await store.claim();
    await store.commit(lease, step());
    const before = await getRow(shop);
    await Promise.all([
      enqueueBackgroundJob(shop, 'orders', checkpoint('restart-a')),
      enqueueBackgroundJob(shop, 'orders', checkpoint('restart-b')),
    ]);
    const after = await getRow(shop);
    assert.equal(after.status, 'PENDING');
    assert.equal(after.revision, before.revision + 1);
    assert(['restart-a', 'restart-b'].includes(JSON.parse(after.stateJson).after));
  });

  await t.test('deleting an uninstalled shop job rejects a late commit without recreating data', async () => {
    const shop = newShop();
    await enqueueBackgroundJob(shop, 'orders', checkpoint());
    const store = prismaJobStore(shop, 'orders', effect);
    const lease = await store.claim();
    await prisma.backgroundJob.delete({ where: { id: lease.id } });
    assert.equal(await store.commit(lease, step()), false);
    assert.equal(await store.fail(lease), 'lease-lost');
    assert.equal(await prisma.backgroundJob.count({ where: { shop } }), 0);
    assert.equal(await prisma.runtimeSourceState.count({ where: { shop } }), 0);
  });

  await t.test('commit holding the connection completes before a queued cancellation can inspect it', async () => {
    const shop = newShop();
    await enqueueBackgroundJob(shop, 'orders', checkpoint());
    let allowPersist;
    let enteredPersist;
    const barrier = new Promise(resolve => { allowPersist = resolve; });
    const entered = new Promise(resolve => { enteredPersist = resolve; });
    const store = prismaJobStore(shop, 'orders', async (...args) => {
      enteredPersist();
      await barrier;
      await effect(...args);
    });
    const lease = await store.claim();
    const committing = store.commit(lease, step());
    await entered;
    let cancellationFinished = false;
    const cancelling = cancelBackgroundJobs(shop, 'orders').finally(() => { cancellationFinished = true; });
    await setImmediate();
    assert.equal(cancellationFinished, false);
    allowPersist();
    assert.equal(await committing, true);
    assert.equal(await cancelling, false);
    assert.equal((await getRow(shop)).status, 'COMPLETED');
    assert.equal(await prisma.runtimeSourceState.count({ where: { shop } }), 1);
  });
});
