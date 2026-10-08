import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StaticRouter } from "react-router";

const result = await build({
  entryPoints: [fileURLToPath(new URL("../app/features/dashboard/retailer-dashboard-view.tsx", import.meta.url))],
  bundle: true,
  write: false,
  platform: "node",
  format: "cjs",
  packages: "external",
  jsx: "automatic",
});
const compiled = { exports: {} };
new Function("require", "module", "exports", result.outputFiles[0].text)(
  createRequire(import.meta.url), compiled, compiled.exports,
);

const shop = "wolfshunter-ai-dev.myshopify.com";
const authLink = `/auth/login?shop=${encodeURIComponent(shop)}`;
const html = renderToStaticMarkup(React.createElement(StaticRouter, { location: "/app" },
  React.createElement(compiled.exports.RetailerDashboardView, {
    authLink,
    shop,
    sessionType: "Offline session",
    isAppAdmin: false,
    collectiveImportDrafts: 0,
    collectiveImportFailures: 0,
    shopMetrics: {
      totalProducts: null, activeProducts: null, draftProducts: null,
      archivedProducts: null, productVariants: null, source: "unavailable", error: null,
    },
  })));
const links = [...html.matchAll(/<a\b[^>]*>/g)].map(match => match[0]);
const authLinks = links.filter(link => link.includes(`href="${authLink}"`));

test("both authentication links keep the existing shop-specific login URL", () => {
  assert.equal(authLinks.length, 2);
  assert.match(html, /Re-run Shopify auth/);
  assert.match(html, /Open auth link/);
});

test("both authentication links navigate outside the embedded app frame", () => {
  assert.equal(authLinks.length, 2);
  for (const link of authLinks) assert.match(link, /target="_top"/);
});

test("authentication navigation does not use React Router route discovery", () => {
  assert.equal(authLinks.length, 2);
  for (const link of authLinks) assert.doesNotMatch(link, /data-discover=/);
});

test("catalog navigation remains an internal React Router link", () => {
  const catalogLink = links.find(link => link.includes('href="/app/discover"'));
  assert.ok(catalogLink);
  assert.doesNotMatch(catalogLink, /target="_top"/);
  assert.match(catalogLink, /data-discover="true"/);
});
