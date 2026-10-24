import { createRequestHandler } from "react-router";

// Keep the compiled application lazy so the health endpoint can distinguish
// Worker availability from application/database readiness during deployment.
const loadBuild = () =>
  import("../build/server/index.js");
// @ts-expect-error Generated resource routes omit the UI default export required by ServerBuild's type.
const handler = createRequestHandler(loadBuild, "production");

interface RuntimeBindings extends Env {
  HYPERDRIVE?: { connectionString: string };
  DATABASE_URL?: string;
  MERCHANT_WORKSPACE_ENABLED?: string;
}

export default {
  async scheduled(_controller, env) {
    const watchdogUrl = env.SHOPIFY_APP_URL ? new URL("/healthz", env.SHOPIFY_APP_URL) : null;
    if (watchdogUrl) {
      try {
        const response = await fetch(watchdogUrl, { headers: { "Cache-Control": "no-store" } });
        if (!response.ok) {
          console.error("watchdog-failure", { status: response.status, url: watchdogUrl.pathname });
        } else {
          console.info("watchdog-ok", { status: response.status, checkedAt: new Date().toISOString() });
        }
      } catch (error) {
        console.error("watchdog-error", { name: error instanceof Error ? error.name : "unknown" });
      }
    }
    const connectionString = env.HYPERDRIVE?.connectionString ?? env.DATABASE_URL;
    if (!connectionString || env.MERCHANT_WORKSPACE_ENABLED !== 'true') return;
    const build = await loadBuild();
    const result = await build.entry.module.withDatabase(connectionString, () => build.entry.module.runScheduledJobs());
    console.info("scheduled-jobs", result);
  },
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const requestId = request.headers.get("x-wolfshunter-request-id")?.trim() || crypto.randomUUID();
    const connectionString = env.HYPERDRIVE?.connectionString ?? env.DATABASE_URL;
    const workspaceEnabled = env.MERCHANT_WORKSPACE_ENABLED === "true";
    if (url.pathname === "/healthz") {
      // Keep liveness cheap. Loading Prisma and the full React build here made
      // cold Workers occasionally hit Cloudflare CPU limits (1102), which
      // looked like an application 503. Deep database checks belong to the
      // authenticated admin diagnostics, not the edge liveness probe.
      const databaseReady = Boolean(connectionString);
      return Response.json({
        status: "ok",
        service: "wolfshunter-collective",
        runtime: "cloudflare-workers",
        environment: "test",
        databaseReady,
        merchantWorkspaceReady: databaseReady && workspaceEnabled,
        watchdog: { enabled: true, intervalSeconds: 60 },
      }, { headers: { "Cache-Control": "no-store", "X-Wolfshunter-Request-Id": requestId } });
    }
    if ((!connectionString || !workspaceEnabled) && /^\/(app|auth|webhooks|extensions)(\/|\.|$)/.test(url.pathname)) {
      return new Response("The application is temporarily unavailable while its data connection is restored.", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow", "X-Wolfshunter-Request-Id": requestId },
      });
    }
    const build = await loadBuild();
    let response: Response;
    try {
      response = await build.entry.module.withDatabase(connectionString, () =>
        handler(request, { cloudflare: { env, ctx } }),
      );
    } catch (error) {
      if (error instanceof Response) {
        const headers = new Headers(error.headers);
        headers.set("X-Wolfshunter-Request-Id", requestId);
        headers.set("X-Robots-Tag", "noindex, nofollow");
        return new Response(error.body, {
          status: error.status,
          statusText: error.statusText,
          headers,
        });
      }
      throw error;
    }
    const headers = new Headers(response.headers);
    headers.set("X-Wolfshunter-Request-Id", requestId);
    headers.set("X-Robots-Tag", "noindex, nofollow");
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
    headers.set("Content-Security-Policy", "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors https://admin.shopify.com https://*.myshopify.com; img-src 'self' data: https:; style-src 'self' 'unsafe-inline' https://cdn.shopify.com; font-src 'self' https://cdn.shopify.com; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.shopify.com; connect-src 'self' https://*.myshopify.com https://admin.shopify.com https://cdn.shopify.com");
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  },
} satisfies ExportedHandler<RuntimeBindings>;
