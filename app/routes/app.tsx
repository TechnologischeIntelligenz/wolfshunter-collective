import type { ReactNode } from "react";
import type { HeadersFunction } from "react-router";
import {
  Link,
  Outlet,
  redirect,
  useLoaderData,
  useLocation,
  useRouteError,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { NavMenu } from "@shopify/app-bridge-react";
import { SupportPopup } from "../features/support/support-popup";
import { getAppRole } from "../services/app-role.server";
import { isAppAdminSession } from "../services/app-admin.server";

const SHOP_DOMAIN_PATTERN = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i;

function normalizeShopDomain(value: unknown) {
  if (typeof value !== "string") return null;
  const shop = value.trim().toLowerCase();
  return SHOP_DOMAIN_PATTERN.test(shop) ? shop : null;
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  return atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
}

function shopFromSessionToken(token: string | null) {
  if (!token) return null;
  try {
    const payload = JSON.parse(decodeBase64Url(token.split(".")[1] ?? "")) as {
      dest?: unknown;
    };
    if (typeof payload.dest !== "string") return null;
    return normalizeShopDomain(new URL(payload.dest).hostname);
  } catch {
    return null;
  }
}

function shopFromEmbeddedRequest(url: URL, authorization: string | null) {
  const directShop = normalizeShopDomain(url.searchParams.get("shop"));
  if (directShop) return directShop;

  const idTokenShop = shopFromSessionToken(url.searchParams.get("id_token"));
  if (idTokenShop) return idTokenShop;

  const bearerToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1] ?? null;
  const authorizationShop = shopFromSessionToken(bearerToken);
  if (authorizationShop) return authorizationShop;

  const host = url.searchParams.get("host");
  if (host) {
    try {
      const decodedHost = decodeBase64Url(host);
      const storeHandle = decodedHost.match(/(?:^|\/)store\/([a-z0-9-]+)/i)?.[1];
      const hostShop = normalizeShopDomain(
        storeHandle ? `${storeHandle}.myshopify.com` : null,
      );
      if (hostShop) return hostShop;
    } catch {
      // Ignore malformed display context; authenticated child routes fail closed.
    }
  }

  return null;
}

export const loader = async ({ request }: { request: Request }) => {
  // Child routes perform the single request authentication they need. Keeping
  // the layout loader side-effect free avoids concurrent Shopify token refresh
  // calls when an embedded page opens. The parent still owns the unauthenticated
  // entry guard so every /app/* route redirects instead of falling into Shopify's
  // 410 response.
  const url = new URL(request.url);
  const shop = shopFromEmbeddedRequest(url, request.headers.get("authorization"));
  const hasSessionToken =
    url.searchParams.has("id_token") || request.headers.has("authorization");

  // Shopify may load the embedded shell with shop/host context before App Bridge
  // sends its session token. Let the authenticated child route complete that flow.
  if (shop && !hasSessionToken) {
    return {
      apiKey: process.env.SHOPIFY_API_KEY || "",
      appRole: getAppRole(),
      isAdminShop: isAppAdminSession({ shop }),
    };
  }

  const appRole = getAppRole();
  const pathname = url.pathname.replace(/\/$/, "");
  const supplierAllowedPaths = new Set(["/app", "/app/support", "/app/admin"]);
  const adminAllowedPaths = new Set(["/app", "/app/support", "/app/admin", "/app/orders", "/app/privacy", "/app/privacy-export"]);
  const isAdminShop = Boolean(shop && isAppAdminSession({ shop }));

  if (appRole === "supplier" && !supplierAllowedPaths.has(pathname)) {
    throw redirect("/app");
  }

  if (isAdminShop && !adminAllowedPaths.has(pathname)) {
    throw redirect("/app");
  }

  return {
    apiKey: process.env.SHOPIFY_API_KEY || "",
    appRole,
    isAdminShop,
  };
};

function AppNavLink({
  children,
  to,
  home = false,
}: {
  children: ReactNode;
  to: string;
  home?: boolean;
}) {
  const location = useLocation();
  const target = location.search ? `${to}${location.search}` : to;

  return (
    <Link to={target} rel={home ? "home" : undefined}>
      {children}
    </Link>
  );
}

export default function App() {
  const { apiKey, appRole, isAdminShop } = useLoaderData<typeof loader>();
  const isSupplier = appRole === "supplier";

  return (
    <AppProvider embedded apiKey={apiKey}>
      <NavMenu>
        <AppNavLink home to="/app">
          {isSupplier ? "Supplier dashboard" : "Dashboard"}
        </AppNavLink>
        {isAdminShop ? (
          <AppNavLink to="/app/admin">Admin controls</AppNavLink>
        ) : isSupplier ? null : (
          <>
            <AppNavLink to="/app/discover">Discover</AppNavLink>
            <AppNavLink to="/app/favorites">Favorites</AppNavLink>
            <AppNavLink to="/app/import-lists">Import Lists</AppNavLink>
            <AppNavLink to="/app/my-products">My Products</AppNavLink>
            <AppNavLink to="/app/analytics">Analytics</AppNavLink>
            <AppNavLink to="/app/subscription">Subscription</AppNavLink>
            <AppNavLink to="/app/settings">Settings</AppNavLink>
          </>
        )}
        <AppNavLink to="/app/support">Support</AppNavLink>
      <AppNavLink to="/app/privacy">Privacy requests</AppNavLink>
      {!isSupplier ? <AppNavLink to="/app/orders">Orders</AppNavLink> : null}
          </NavMenu>
      <Outlet />
      {!isSupplier && !isAdminShop ? <SupportPopup /> : null}
    </AppProvider>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
