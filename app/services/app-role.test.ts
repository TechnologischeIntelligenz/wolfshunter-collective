import assert from "node:assert/strict";
import test from "node:test";

import { getSessionRole, requireRetailerSession } from "./app-role.server.ts";

function withRoleEnvironment(run: () => void) {
  const previousAdminShops = process.env.APP_ADMIN_SHOPS;
  const previousRole = process.env.APP_ROLE;
  process.env.APP_ADMIN_SHOPS = "3ddd6b-2.myshopify.com";
  process.env.APP_ROLE = "retailer";

  try {
    run();
  } finally {
    if (previousAdminShops === undefined) delete (process.env as Record<string, string | undefined>).APP_ADMIN_SHOPS;
    else process.env.APP_ADMIN_SHOPS = previousAdminShops;

    if (previousRole === undefined) delete (process.env as Record<string, string | undefined>).APP_ROLE;
    else process.env.APP_ROLE = previousRole;
  }
}

test("the canonical WOLFSHUNTER shop receives only the admin role", () => {
  withRoleEnvironment(() => {
    const session = { shop: "3DDD6B-2.myshopify.com" };
    assert.equal(getSessionRole(session), "admin");
    assert.throws(
      () => requireRetailerSession(session),
      (error) => error instanceof Response && error.status === 403,
    );
  });
});

test("the retailer development shop retains the retailer role", () => {
  withRoleEnvironment(() => {
    const session = { shop: "wolfshunter-ai-dev.myshopify.com" };
    assert.equal(getSessionRole(session), "retailer");
    assert.doesNotThrow(() => requireRetailerSession(session));
  });
});
