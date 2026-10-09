import { createRequestHandler } from "react-router";

// Keep the compiled application lazy so the health endpoint can distinguish
// Worker availability from application/database readiness during deployment.
const loadBuild = () =>
  import("../build/server/index.js");
// @ts-expect-error Generated resource routes omit the UI default export required by ServerBuild's type.
const handler = createRequestHandler(loadBuild, "production");

interface RuntimeBindings extends Env {
  // Optional legacy/direct connection for non-Hyperdrive test environments.
  // HYPERDRIVE and Wrangler vars are generated from wrangler.jsonc.
  DATABASE_URL?: string;
}

export default {
  async scheduled(_controller, env) {
    const connectionString = env.HYPERDRIVE?.connectionString ?? env.DATABASE_URL;
    if (!connectionString || env.MERCHANT_WORKSPACE_ENABLED !== 'true') return;
    const build = await loadBuild();
    const result = await build.entry.module.withDatabase(connectionString, () => build.entry.module.runScheduledJobs());
    console.info("scheduled-jobs", result);
  },
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const connectionString = env.HYPERDRIVE?.connectionString ?? env.DATABASE_URL;
    const workspaceEnabled = env.MERCHANT_WORKSPACE_ENABLED === "true";
    if (url.pathname === "/healthz") {
      let databaseReady = false;
      if (connectionString) {
        try {
          const build = await loadBuild();
          await build.entry.module.withDatabase(connectionString, () => build.entry.module.checkDatabase());
          databaseReady = true;
        } catch {
          // Health output must never disclose database connection details.
        }
      }
      return Response.json({
        status: "ok",
        service: "wolfshunter-collective",
        runtime: "cloudflare-workers",
        environment: "test",
        databaseReady,
        merchantWorkspaceReady: databaseReady && workspaceEnabled,
      }, { headers: { "Cache-Control": "no-store" } });
    }
    if ((!connectionString || !workspaceEnabled) && /^\/(app|auth|webhooks|extensions)(\/|\.|$)/.test(url.pathname)) {
      return new Response("The application is temporarily unavailable while its data connection is restored.", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" },
      });
    }
    const build = await loadBuild();
    const response = await build.entry.module.withDatabase(connectionString, () =>
      handler(request, { cloudflare: { env, ctx } }),
    );
    const headers = new Headers(response.headers);
    headers.set("X-Robots-Tag", "noindex, nofollow");
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  },
} satisfies ExportedHandler<RuntimeBindings>;
