import { isAppAdminSession } from "./app-admin.server.ts";

export type AppRole = "retailer" | "supplier";
export type SessionRole = AppRole | "admin";

type ShopSession = {
  shop?: string | null;
  email?: string | null;
};

export function getAppRole(): AppRole {
  return process.env.APP_ROLE?.trim().toLowerCase() === "supplier"
    ? "supplier"
    : "retailer";
}

export function getSessionRole(session: ShopSession): SessionRole {
  if (isAppAdminSession(session)) return "admin";
  return getAppRole();
}

export function requireRetailerSession(session: ShopSession) {
  if (getSessionRole(session) !== "retailer") {
    throw new Response("Forbidden", { status: 403 });
  }
}
