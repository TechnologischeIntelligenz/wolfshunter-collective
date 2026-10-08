/* eslint-env node */
import assert from "node:assert/strict";

const base = new URL(process.argv[2] || "http://127.0.0.1:8787");
const workspaceReady = !process.argv.includes("--workspace-pending");
const checks = [
  ["/", 200, /WOLFSHUNTER/],
  ["/support", 200, /support/i],
  ["/privacy", 200, /privacy/i],
  ["/terms", 200, /terms/i],
  ["/phase-one-preview", 404],
  ["/app", workspaceReady ? 302 : 503],
  ["/auth/login", workspaceReady ? 200 : 503],
  ["/.env", 404],
  ["/prisma/dev.sqlite", 404],
];
for (const [pathname, expectedStatus, content] of checks) {
  const response = await fetch(new URL(pathname, base), { redirect: "manual", signal: AbortSignal.timeout(20000) });
  const body = await response.text();
  assert.equal(response.status, expectedStatus, `${pathname}: unexpected HTTP status`);
  if (pathname === "/app" && workspaceReady) {
    const redirect = new URL(response.headers.get("location"), base);
    assert.equal(redirect.origin, base.origin, "Unauthenticated app must redirect to this app's login");
    assert.equal(redirect.pathname, "/auth/login");
  }
  if (content) assert.match(body, content, `${pathname}: unexpected document`);
  if (expectedStatus === 200) assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow");
  console.log(`${pathname}: ${response.status}`);
}
const health = await fetch(new URL("/healthz", base), { signal: AbortSignal.timeout(20000) });
assert.equal(health.status, 200);
assert.deepEqual(await health.json(), {
  status: "ok", service: "wolfshunter-collective", runtime: "cloudflare-workers",
  environment: "test", databaseReady: workspaceReady, merchantWorkspaceReady: workspaceReady,
});
console.log(`/healthz: 200; database/workspace ready=${workspaceReady}`);
console.log("10 HTTP checks passed.");
