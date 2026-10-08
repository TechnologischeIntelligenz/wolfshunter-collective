import db from "../db.server";
import { getImportedProductPushes } from "./retailer-commerce.server";

export type DiagnosticTone = "green" | "yellow" | "red";

export interface ReadOnlyDiagnosticCheck {
  key: string;
  label: string;
  tone: DiagnosticTone;
  status: string;
  detail: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface ReadOnlyFailedOperation {
  id: number;
  title: string;
  status: string;
  error: string | null;
  createdAt: string;
}

export interface ReadOnlyDiagnostics {
  checkedAt: string;
  overallTone: DiagnosticTone;
  checks: ReadOnlyDiagnosticCheck[];
  recentFailures: ReadOnlyFailedOperation[];
  recentFailuresNote?: string;
}

type SessionLike = {
  shop: string;
  isOnline?: boolean;
  accessToken?: string | null;
  expires?: Date | string | null;
  refreshToken?: string | null;
  refreshTokenExpires?: Date | string | null;
  scope?: string | null;
};

type AdminLike = {
  graphql: (query: string) => Promise<Response>;
};

const WEBHOOK_TOPICS = ["app/scopes_update", "app/uninstalled"];

function now(): Date {
  return new Date();
}

function asDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function iso(value: Date | null): string | null {
  return value?.toISOString() ?? null;
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : "UnknownError";
}

function toneFromChecks(checks: ReadOnlyDiagnosticCheck[]): DiagnosticTone {
  if (checks.some((check) => check.tone === "red")) return "red";
  if (checks.some((check) => check.tone === "yellow")) return "yellow";
  return "green";
}

function checkSession(session: SessionLike): ReadOnlyDiagnosticCheck {
  const checkedAt = now();
  const accessExpires = asDate(session.expires);
  const refreshExpires = asDate(session.refreshTokenExpires);
  const hasAccessToken = Boolean(session.accessToken?.trim());
  const hasRefreshToken = Boolean(session.refreshToken?.trim());
  const accessValid = !accessExpires || accessExpires > checkedAt;
  const refreshValid = Boolean(refreshExpires && refreshExpires > checkedAt);
  const scopes = session.scope?.split(",").map((scope) => scope.trim()).filter(Boolean) ?? [];

  let tone: DiagnosticTone = "green";
  let status = "active";
  let detail = "Shopify-Session und Access-Token sind für den aktuellen Request nutzbar.";

  if (!hasAccessToken) {
    tone = "red";
    status = "missing";
    detail = "Kein Shopify-Access-Token in der Session vorhanden.";
  } else if (!accessValid && refreshValid) {
    tone = "yellow";
    status = "refreshable";
    detail = "Access-Token abgelaufen; der gespeicherte Refresh-Token ist noch gültig.";
  } else if (!accessValid && !refreshValid) {
    tone = "red";
    status = "expired";
    detail = "Access-Token und Refresh-Fenster sind abgelaufen; erneute Shopify-Authentifizierung erforderlich.";
  }

  return {
    key: "shopify-session",
    label: "Shopify Session",
    tone,
    status,
    detail,
    metadata: {
      sessionType: session.isOnline ? "online" : "offline",
      shop: session.shop,
      accessExpiresAt: iso(accessExpires),
      refreshExpiresAt: iso(refreshExpires),
      hasAccessToken,
      hasRefreshToken,
      scopeCount: scopes.length,
    },
  };
}

async function checkShopifyShop(admin: AdminLike): Promise<ReadOnlyDiagnosticCheck> {
  try {
    const response = await admin.graphql(`
      query CollectiveReadOnlyShopCheck {
        shop {
          name
          myshopifyDomain
        }
      }
    `);
    const payload = (await response.json()) as {
      data?: { shop?: { name?: string; myshopifyDomain?: string } };
      errors?: unknown[];
    };

    if (!response.ok || payload.errors?.length || !payload.data?.shop) {
      return {
        key: "shopify-shop",
        label: "Shopify Shopstatus",
        tone: response.status === 401 || response.status === 403 ? "red" : "yellow",
        status: `HTTP ${response.status}`,
        detail: "Read-only Shopify-Shopabfrage konnte nicht bestätigt werden.",
        metadata: { httpStatus: response.status },
      };
    }

    return {
      key: "shopify-shop",
      label: "Shopify Shopstatus",
      tone: "green",
      status: "verified",
      detail: "Shopdaten wurden read-only über die Admin GraphQL API bestätigt.",
      metadata: {
        shopName: payload.data.shop.name ?? null,
        shopDomain: payload.data.shop.myshopifyDomain ?? null,
        httpStatus: response.status,
      },
    };
  } catch (error) {
    const diagnosticError = error as { message?: string; status?: number };
    console.error("[diagnostics] Shopify shop check failed", {
      name: errorName(error),
      status: diagnosticError.status ?? null,
      message: diagnosticError.message?.slice(0, 240) ?? null,
    });
    return {
      key: "shopify-shop",
      label: "Shopify Shopstatus",
      tone: "red",
      status: "unavailable",
      detail: "Shopify Admin API ist für die read-only Shopabfrage nicht erreichbar.",
    };
  }
}

async function checkDatabase(): Promise<ReadOnlyDiagnosticCheck> {
  try {
    await db.$queryRaw`SELECT 1`;
    return {
      key: "database",
      label: "Datenbank",
      tone: "green",
      status: "reachable",
      detail: "Prisma/SQLite beantwortet die read-only Verbindungskontrolle.",
    };
  } catch (error) {
    console.error("[diagnostics] database check failed", { name: errorName(error) });
    return {
      key: "database",
      label: "Datenbank",
      tone: "red",
      status: "unavailable",
      detail: "Die read-only Datenbankkontrolle ist fehlgeschlagen.",
    };
  }
}

function checkAiProviders(): ReadOnlyDiagnosticCheck {
  const hasOpenAiKey = Boolean(
    process.env.OPENAI_API_KEY?.trim() || process.env.DEIN_NEUER_OPENAI_PROJECT_KEY?.trim(),
  );
  const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY?.trim());
  const openAiModel = process.env.OPENAI_MODEL?.trim() || "gpt-5.6-terra";
  const geminiModel = process.env.GEMINI_MODEL?.trim() || "gemini-3.7-flash";
  const configuredProvider = process.env.AI_PROVIDER?.trim().toLowerCase();
  const provider = configuredProvider === "openai" || configuredProvider === "gemini"
    ? configuredProvider
    : "auto";
  const selectedKeyAvailable = provider === "gemini" ? hasGeminiKey : provider === "openai" ? hasOpenAiKey : hasOpenAiKey || hasGeminiKey;

  if (!selectedKeyAvailable) {
    return {
      key: "ai-provider",
      label: "AI Provider",
      tone: "yellow",
      status: "fallback",
      detail: "Für den ausgewählten AI-Provider ist kein serverseitiger Key konfiguriert; lokale Diagnosehilfe bleibt aktiv.",
      metadata: { provider, openAiConfigured: hasOpenAiKey, geminiConfigured: hasGeminiKey, openAiModel, geminiModel, liveCall: false },
    };
  }

  return {
    key: "ai-provider",
    label: "AI Provider",
    tone: "green",
    status: provider === "auto" ? "configured" : `${provider}-selected`,
    detail: "Der ausgewählte serverseitige AI-Provider ist konfiguriert. Der Dashboard-Check führt keinen Live-Call aus.",
    metadata: { provider, openAiConfigured: hasOpenAiKey, geminiConfigured: hasGeminiKey, openAiModel, geminiModel, liveCall: false },
  };
}

async function checkCloudflare(request: Request): Promise<ReadOnlyDiagnosticCheck> {
  const appUrl = process.env.SHOPIFY_APP_URL?.trim();
  const requestHasCloudflareHeaders = Boolean(
    request.headers.get("cf-ray") || request.headers.get("cf-connecting-ip"),
  );

  if (!appUrl) {
    return {
      key: "cloudflare",
      label: "Cloudflare / Tunnel",
      tone: "yellow",
      status: "not-configured",
      detail: "SHOPIFY_APP_URL fehlt; öffentliche Tunnel-Prüfung wurde übersprungen.",
      metadata: { liveCall: false },
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);

  try {
    const healthUrl = new URL("/healthz", appUrl).toString();
    const response = await fetch(healthUrl, {
      signal: controller.signal,
      headers: { "User-Agent": "WOLFSHUNTER-ReadOnlyDiagnostics/1.0" },
    });

    if (!response.ok) {
      return {
        key: "cloudflare",
        label: "Cloudflare / Tunnel",
        tone: requestHasCloudflareHeaders ? "yellow" : "red",
        status: `HTTP ${response.status}`,
        detail: "Die öffentliche /healthz-Prüfung hat keinen 200-Status geliefert.",
        metadata: { httpStatus: response.status, liveCall: true },
      };
    }

    return {
      key: "cloudflare",
      label: "Cloudflare / Tunnel",
      tone: "green",
      status: "reachable",
      detail: requestHasCloudflareHeaders
        ? "Öffentliche /healthz-Route ist erreichbar und Cloudflare-Edge-Header sind sichtbar."
        : "Öffentliche /healthz-Route ist erreichbar; Edge-Header waren in diesem Request nicht sichtbar.",
      metadata: {
        httpStatus: response.status,
        edgeHeaders: requestHasCloudflareHeaders,
        liveCall: true,
      },
    };
  } catch (error) {
    console.error("[diagnostics] Cloudflare health check failed", { name: errorName(error) });
    return {
      key: "cloudflare",
      label: "Cloudflare / Tunnel",
      tone: requestHasCloudflareHeaders ? "green" : "red",
      status: requestHasCloudflareHeaders ? "edge-verified" : "unreachable",
      detail: requestHasCloudflareHeaders
        ? "Der aktuelle Request kam nachweislich über Cloudflare an; der zusätzliche Server-zu-öffentlicher-URL-Probe-Request ist für diesen Rechner nicht aussagekräftig."
        : "Öffentliche /healthz-Route war für die Probe nicht erreichbar.",
      metadata: { edgeHeaders: requestHasCloudflareHeaders, liveCall: false },
    };
  } finally {
    clearTimeout(timeout);
  }
}

function checkWebhooks(): ReadOnlyDiagnosticCheck {
  const hasSecret = Boolean(process.env.SHOPIFY_API_SECRET?.trim());

  return {
    key: "webhooks",
    label: "Shopify Webhooks",
    tone: hasSecret ? "yellow" : "red",
    status: hasSecret ? "configured" : "missing-secret",
    detail: hasSecret
      ? "Die beiden App-Webhooks sind in shopify.app.toml konfiguriert; Zustellhistorie wird noch nicht persistent gespeichert."
      : "SHOPIFY_API_SECRET fehlt; Webhook-Signaturen können nicht geprüft werden.",
    metadata: {
      configuredTopics: WEBHOOK_TOPICS.join(", "),
      deliveryHistory: false,
    },
  };
}

async function readRecentFailures(shop: string): Promise<{
  failures: ReadOnlyFailedOperation[];
  note?: string;
}> {
  try {
    const pushes = await getImportedProductPushes(shop);
    const failures = pushes
      .filter((push) => push.status === "FAILED")
      .slice(0, 5)
      .map((push) => ({
        id: push.id,
        title: push.sourceTitle,
        status: push.status,
        error: push.errorMessage,
        createdAt: push.createdAt,
      }));

    return { failures };
  } catch (error) {
    console.error("[diagnostics] recent failure lookup failed", { name: errorName(error) });
    return {
      failures: [],
      note: "Fehlerhistorie konnte read-only nicht geladen werden.",
    };
  }
}

export async function getReadOnlyDiagnostics({
  request,
  session,
  admin,
}: {
  request: Request;
  session: SessionLike;
  admin: AdminLike;
}): Promise<ReadOnlyDiagnostics> {
  const [shopifyShop, database, cloudflare, recent] = await Promise.all([
    checkShopifyShop(admin),
    checkDatabase(),
    checkCloudflare(request),
    readRecentFailures(session.shop),
  ]);

  const checks: ReadOnlyDiagnosticCheck[] = [
    {
      key: "health",
      label: "Application Health",
      tone: "green",
      status: "online",
      detail: "Der authentifizierte Request hat den App-Server erreicht.",
    },
    checkSession(session),
    shopifyShop,
      checkAiProviders(),
    cloudflare,
    database,
    checkWebhooks(),
  ];

  return {
    checkedAt: now().toISOString(),
    overallTone: toneFromChecks(checks),
    checks,
    recentFailures: recent.failures,
    recentFailuresNote: recent.note,
  };
}
