import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "../db.server";

function storage() {
  return new PrismaSessionStorage(prisma, { connectionRetries: 1 });
}

// Keep the storage object lazy: the Worker creates its Prisma client only
// inside a request-scoped database connection.
export const workerSessionStorage = {
  storeSession: (session: Parameters<ReturnType<typeof storage>["storeSession"]>[0]) =>
    storage().storeSession(session),
  loadSession: (id: string) => storage().loadSession(id),
  deleteSession: (id: string) => storage().deleteSession(id),
  deleteSessions: (ids: string[]) => storage().deleteSessions(ids),
  findSessionsByShop: (shop: string) => storage().findSessionsByShop(shop),
};
