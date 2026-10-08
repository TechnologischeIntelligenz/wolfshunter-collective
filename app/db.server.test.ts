import assert from "node:assert/strict";
import test, { mock } from "node:test";

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

test("request database scopes follow response stream lifetimes", async (t) => {
  const clients: TestPrismaClient[] = [];
  const disconnectGates = new Map<string, { started: ReturnType<typeof deferred<void>>; gate: ReturnType<typeof deferred<void>> }>();
  const queries: string[] = [];
  class TestAdapter {
    connectionString: string;
    constructor(options: { connectionString: string }) { this.connectionString = options.connectionString; }
  }
  class TestPrismaClient {
    connectionString: string;
    disconnectCalls = 0;
    disconnected = false;
    constructor(options: { adapter: TestAdapter }) {
      this.connectionString = options.adapter.connectionString;
      clients.push(this);
    }
    session = {
      findFirst: async () => {
        assert.equal(this.disconnected, false, "a closed Prisma client must never reconnect");
        queries.push(this.connectionString);
        return null;
      },
    };
    async $disconnect() {
      this.disconnectCalls++;
      const pending = disconnectGates.get(this.connectionString);
      pending?.started.resolve();
      await pending?.gate.promise;
      this.disconnected = true;
    }
  }
  const prismaMock = mock.module("@prisma/client", { namedExports: { PrismaClient: TestPrismaClient } });
  const adapterMock = mock.module("@prisma/adapter-pg", { namedExports: { PrismaPg: TestAdapter } });
  t.after(() => { prismaMock.restore(); adapterMock.restore(); });
  const { withDatabase, checkDatabase } = await import("./db.server.ts");
  const lastClient = () => clients[clients.length - 1];

  await t.test("ordinary values, bodyless responses and thrown actions disconnect once", async () => {
    const value = await withDatabase("value", async () => { await checkDatabase(); return 42; });
    assert.equal(value, 42);
    assert.equal(lastClient().disconnectCalls, 1);
    const response = await withDatabase("bodyless", async () => { await checkDatabase(); return new Response(null, { status: 204 }); });
    assert.equal(response.status, 204);
    assert.equal(lastClient().disconnectCalls, 1);
    await assert.rejects(withDatabase("thrown", async () => { await checkDatabase(); throw new Error("action failed"); }), /action failed/);
    assert.equal(lastClient().disconnectCalls, 1);
  });

  await t.test("deferred stream work retains its connection and ALS until the body finishes", async () => {
    const emit = deferred();
    const response = await withDatabase("stream", async () => {
      await checkDatabase();
      return new Response(new ReadableStream<Uint8Array>({
        async pull(controller) {
          await emit.promise;
          await checkDatabase();
          controller.enqueue(new TextEncoder().encode("completed"));
          controller.close();
        },
      }), { status: 201, headers: { "x-stream-test": "retained" } });
    });
    const client = lastClient();
    assert.equal(client.disconnectCalls, 0);
    assert.equal(response.status, 201);
    assert.equal(response.headers.get("x-stream-test"), "retained");
    emit.resolve();
    assert.equal(await response.text(), "completed");
    assert.equal(client.disconnectCalls, 1);
    assert.deepEqual(queries.filter(query => query === "stream"), ["stream", "stream"]);
  });

  await t.test("cancel waits for the source's async cancellation hook despite a pending read", async () => {
    const cancelStarted = deferred();
    const finishCancel = deferred();
    let cancellationReason: unknown;
    const response = await withDatabase("cancel", async () => {
      await checkDatabase();
      return new Response(new ReadableStream<Uint8Array>({
        async cancel(reason) {
          cancellationReason = reason;
          cancelStarted.resolve();
          await finishCancel.promise;
          await checkDatabase();
        },
      }));
    });
    const client = lastClient();
    const reader = response.body!.getReader();
    const pendingRead = reader.read();
    const cancelled = reader.cancel("client disconnected");
    await cancelStarted.promise;
    assert.equal(client.disconnectCalls, 0);
    assert.equal(cancellationReason, "client disconnected");
    finishCancel.resolve();
    await cancelled;
    assert.equal((await pendingRead).done, true);
    assert.equal(client.disconnectCalls, 1);
    assert.deepEqual(queries.filter(query => query === "cancel"), ["cancel", "cancel"]);
  });

  await t.test("source stream and cancellation errors still disconnect", async () => {
    const errorGate = deferred();
    const response = await withDatabase("stream-error", async () => {
      await checkDatabase();
      return new Response(new ReadableStream<Uint8Array>({
        async pull() { await errorGate.promise; throw new Error("stream failed"); },
      }));
    });
    const client = lastClient();
    errorGate.resolve();
    await assert.rejects(response.text(), /stream failed/);
    assert.equal(client.disconnectCalls, 1);
    const cancelled = await withDatabase("cancel-error", async () => {
      await checkDatabase();
      return new Response(new ReadableStream<Uint8Array>({ cancel() { throw new Error("cancel failed"); } }));
    });
    const cancelClient = lastClient();
    await assert.rejects(cancelled.body!.cancel(), /cancel failed/);
    assert.equal(cancelClient.disconnectCalls, 1);
  });

  await t.test("completion waits for disconnect and late continuations cannot reuse a closed scope", async () => {
    const disconnectStarted = deferred();
    const disconnect = deferred();
    const later = deferred();
    disconnectGates.set("closing", { started: disconnectStarted, gate: disconnect });
    let lateQuery!: Promise<unknown>;
    const response = await withDatabase("closing", async () => {
      await checkDatabase();
      lateQuery = later.promise.then(() => checkDatabase()).then(() => null, error => error);
      return new Response("body");
    });
    const client = lastClient();
    let finished = false;
    const consumed = response.text().then(body => { finished = true; return body; });
    await disconnectStarted.promise;
    assert.equal(finished, false);
    later.resolve();
    assert.match(String(await lateQuery), /scope has already closed/);
    assert.equal(queries.filter(query => query === "closing").length, 1);
    disconnect.resolve();
    assert.equal(await consumed, "body");
    assert.equal(client.disconnectCalls, 1);
    assert.equal(client.disconnected, true);
  });

  await t.test("a late first query cannot create a client after an unused scope closes", async () => {
    const before = clients.length;
    const later = deferred();
    let lateQuery!: Promise<unknown>;
    await withDatabase("never-opened", async () => {
      lateQuery = later.promise.then(() => checkDatabase()).then(() => null, error => error);
      return "no database needed";
    });
    later.resolve();
    assert.match(String(await lateQuery), /scope has already closed/);
    assert.equal(clients.length, before);
  });

  await t.test("concurrent streams retain distinct request clients", async () => {
    const release = deferred();
    const create = (name: string) => withDatabase(name, async () => new Response(new ReadableStream<Uint8Array>({
      async pull(controller) {
        await release.promise;
        await checkDatabase();
        controller.enqueue(new TextEncoder().encode(name));
        controller.close();
      },
    })));
    const [first, second] = await Promise.all([create("tenant-one"), create("tenant-two")]);
    release.resolve();
    assert.deepEqual(await Promise.all([first.text(), second.text()]), ["tenant-one", "tenant-two"]);
    const scopedClients = clients.filter(client => ["tenant-one", "tenant-two"].includes(client.connectionString));
    assert.equal(scopedClients.length, 2);
    assert.ok(scopedClients.every(client => client.disconnectCalls === 1));
    assert.deepEqual(queries.filter(query => query.startsWith("tenant-")).sort(), ["tenant-one", "tenant-two"]);
  });
});
