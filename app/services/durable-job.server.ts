import type { Prisma, PrismaClient } from "@prisma/client";
import prisma from "../db.server.ts";

const LEASE_MS = 120_000;
const activeStatuses = ["PENDING", "RUNNING"];

export interface DurableJobLease<T> {
  id: string;
  shop: string;
  kind: string;
  token: string;
  attempts: number;
  state: T;
}

export interface DurableJobStep<T> {
  state: T;
  done: boolean;
  effects?: unknown;
}

type Persist<T> = (client: Prisma.TransactionClient, lease: DurableJobLease<T>, step: DurableJobStep<T>) => Promise<void>;

export interface DurableJobStore<T> {
  claim(): Promise<DurableJobLease<T> | null>;
  commit(lease: DurableJobLease<T>, step: DurableJobStep<T>): Promise<boolean>;
  fail(lease: DurableJobLease<T>): Promise<"lease-lost" | "failed" | "retry">;
}

export async function runDurableJobStep<T>(
  store: DurableJobStore<T>,
  prepare: (lease: DurableJobLease<T>) => Promise<DurableJobStep<T>>,
) {
  const lease = await store.claim();
  if (!lease) return "idle" as const;
  try {
    if (lease.attempts > 5) return await store.fail(lease);
    const step = await prepare(lease);
    if (!(await store.commit(lease, step))) return "lease-lost" as const;
    return step.done ? ("completed" as const) : ("pending" as const);
  } catch {
    return store.fail(lease);
  }
}

function jobRetryDelayMs(attempts: number) {
  return Math.min(300_000, 5_000 * 2 ** Math.max(0, attempts - 1));
}

function dueAt(now: Date): Prisma.BackgroundJobWhereInput {
  return {
    OR: [
      { status: "PENDING", nextRunAt: { lte: now } },
      { status: "RUNNING", leaseExpiresAt: { lte: now } },
    ],
  };
}

export async function enqueueBackgroundJob<T>(
  shop: string,
  kind: string,
  state: T,
  restartBefore = new Date(),
) {
  const row = await prisma.backgroundJob.upsert({
    where: { shop_kind: { shop, kind } },
    create: { shop, kind, stateJson: JSON.stringify(state) },
    update: {},
  });
  if (activeStatuses.includes(row.status) || row.status === "CANCELLED") return row;
  if (row.updatedAt > restartBefore) return row;
  await prisma.backgroundJob.updateMany({
    where: { id: row.id, revision: row.revision, status: row.status },
    data: {
      status: "PENDING",
      stateJson: JSON.stringify(state),
      attempts: 0,
      nextRunAt: new Date(),
      leaseToken: null,
      leaseExpiresAt: null,
      errorMessage: null,
      revision: { increment: 1 },
    },
  });
  return prisma.backgroundJob.findUniqueOrThrow({ where: { id: row.id } });
}

export async function listDueBackgroundJobs(limit = 2) {
  return prisma.backgroundJob.findMany({
    where: {
      kind: { in: ["orders", "source-commerce", "source-full", "source-stock", "import-stock"] },
      ...dueAt(new Date()),
    },
    orderBy: [{ nextRunAt: "asc" }, { id: "asc" }],
    take: Math.max(1, Math.min(10, Math.floor(limit) || 2)),
    select: { shop: true, kind: true },
  });
}

export async function cancelBackgroundJobs(shop: string, kind?: string) {
  const result = await prisma.backgroundJob.updateMany({
    where: {
      shop,
      ...(kind ? { kind } : {}),
      status: { in: activeStatuses },
    },
    data: {
      status: "CANCELLED",
      leaseToken: null,
      leaseExpiresAt: null,
      errorMessage: "Synchronization cancelled by an administrator.",
      revision: { increment: 1 },
    },
  });
  return result.count > 0;
}

export function prismaJobStore<T>(shop: string, kind: string, persist?: Persist<T>): DurableJobStore<T> {
  return {
    async claim() {
      const now = new Date();
      const token = crypto.randomUUID();
      const claimed = await prisma.backgroundJob.updateMany({
        where: { shop, kind, ...dueAt(now) },
        data: {
          status: "RUNNING",
          leaseToken: token,
          leaseExpiresAt: new Date(now.getTime() + LEASE_MS),
          attempts: { increment: 1 },
          revision: { increment: 1 },
        },
      });
      if (!claimed.count) return null;
      const row = await prisma.backgroundJob.findFirst({ where: { shop, kind, leaseToken: token } });
      if (!row) return null;
      return { id: row.id, shop, kind, token, attempts: row.attempts, state: JSON.parse(row.stateJson) as T };
    },
    async commit(lease, step) {
      return prisma.$transaction(async (tx) => {
        const fenced = await tx.backgroundJob.updateMany({
          where: {
            id: lease.id,
            status: "RUNNING",
            leaseToken: lease.token,
            leaseExpiresAt: { gt: new Date() },
          },
          data: { revision: { increment: 1 } },
        });
        if (!fenced.count) return false;
        await persist?.(tx, lease, step);
        await tx.backgroundJob.update({
          where: { id: lease.id },
          data: {
            status: step.done ? "COMPLETED" : "PENDING",
            stateJson: JSON.stringify(step.state),
            attempts: 0,
            nextRunAt: new Date(),
            leaseToken: null,
            leaseExpiresAt: null,
            errorMessage: null,
          },
        });
        return true;
      }, { timeout: 30_000 });
    },
    async fail(lease) {
      const terminal = lease.attempts >= 5;
      const result = await prisma.backgroundJob.updateMany({
        where: {
          id: lease.id,
          status: "RUNNING",
          leaseToken: lease.token,
          leaseExpiresAt: { gt: new Date() },
        },
        data: {
          status: terminal ? "FAILED" : "PENDING",
          leaseToken: null,
          leaseExpiresAt: null,
          nextRunAt: new Date(Date.now() + jobRetryDelayMs(lease.attempts)),
          errorMessage: "Synchronization failed; retry after checking Shopify access.",
          revision: { increment: 1 },
        },
      });
      return !result.count ? "lease-lost" : terminal ? "failed" : "retry";
    },
  };
}
