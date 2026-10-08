import { AsyncLocalStorage } from "node:async_hooks";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

interface DatabaseScope {
  connectionString?: string;
  client?: PrismaClient;
  closed: boolean;
  closing?: Promise<void>;
}

const databaseScope = new AsyncLocalStorage<DatabaseScope>();

function closeDatabase(scope: DatabaseScope): Promise<void> {
  scope.closed = true;
  // Publish one promise before disconnect starts, so concurrent stream cleanup
  // waits for the same operation and cannot reopen this request's connection.
  scope.closing ??= Promise.resolve().then(async () => {
    await scope.client?.$disconnect();
  });
  return scope.closing;
}

export async function withDatabase<T>(connectionString: string | undefined, action: () => Promise<T>) {
  const scope: DatabaseScope = { connectionString, closed: false };
  return databaseScope.run(scope, async () => {
    let streaming = false;
    const close = () => closeDatabase(scope);
    try {
      const result = await action();
      // React Router can finish loaders before its response stream finishes.
      // Retain the request's connection until that stream completes or cancels.
      if (result instanceof Response && result.body) {
        const reader = result.body.getReader();
        let cancelled = false;
        const body = new ReadableStream<Uint8Array>({
          pull(controller) {
            return databaseScope.run(scope, async () => {
              try {
                const next = await reader.read();
                // cancel() resolves pending reads before the source's async
                // cancellation hook finishes. That hook owns cleanup until it
                // completes, and still needs its request's database context.
                if (cancelled) return;
                if (next.done) {
                  await close();
                  controller.close();
                } else controller.enqueue(next.value);
              } catch (error) {
                if (cancelled) return;
                await close();
                controller.error(error);
              }
            });
          },
          cancel(reason) {
            cancelled = true;
            return databaseScope.run(scope, async () => {
              try { await reader.cancel(reason); } finally { await close(); }
            });
          },
        });
        const response = new Response(body, {
          status: result.status, statusText: result.statusText, headers: result.headers,
        });
        streaming = true;
        return response as T;
      }
      return result;
    } finally {
      if (!streaming) await close();
    }
  });
}

export async function checkDatabase() {
  await requestDatabase().session.findFirst({ select: { id: true } });
}

function requestDatabase() {
  const scope = databaseScope.getStore();
  if (scope?.closed) {
    throw new Error("Database request scope has already closed");
  }
  if (!scope?.connectionString) {
    throw new Response("Test database is not configured yet.", { status: 503 });
  }
  scope.client ??= new PrismaClient({
    adapter: new PrismaPg({ connectionString: scope.connectionString, max: 2 }),
  });
  return scope.client;
}

const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = requestDatabase();
    const value = Reflect.get(client, property);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export default prisma;
