import "@shopify/shopify-app-react-router/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";
import { BillingInterval } from "@shopify/shopify-api";
import { workerSessionStorage } from "./services/worker-session-storage.server";

function resolveAppUrl() {
  const configuredAppUrl = process.env.SHOPIFY_APP_URL?.trim();
  if (configuredAppUrl) {
    return configuredAppUrl.replace(/\/$/, "");
  }

  const port = process.env.PORT || "3001";
  return `http://localhost:${port}`;
}

export const MONTHLY_PLAN = "WOLFSHUNTER COLLECTIVE Pro";

export function billingIsTestMode() {
  return process.env.NODE_ENV !== "production" || process.env.BILLING_TEST_MODE === "true";
}

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.July26,
  scopes: process.env.SCOPES?.split(","),
  appUrl: resolveAppUrl(),
  authPathPrefix: "/auth",
  sessionStorage: workerSessionStorage,
  distribution: AppDistribution.AppStore,
  billing: {
    [MONTHLY_PLAN]: {
      lineItems: [
        {
          amount: 99,
          currencyCode: "USD",
          interval: BillingInterval.Every30Days,
        },
      ],
    },
  },
  future: {
    expiringOfflineAccessTokens: true,
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const apiVersion = ApiVersion.July26;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
