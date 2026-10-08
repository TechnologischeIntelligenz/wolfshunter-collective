type AppAdminSession = {
  email?: string | null;
  shop?: string | null;
};

function configuredValues(name: string) {
  return (process.env[name] ?? "")
    .split(",")
    .map((candidate) => candidate.trim().toLowerCase())
    .filter(Boolean);
}

const SHOP_DOMAIN_PATTERN = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;

export function configuredAppAdminShops() {
  return configuredValues("APP_ADMIN_SHOPS").filter((shop) =>
    SHOP_DOMAIN_PATTERN.test(shop),
  );
}

export function getCatalogSourceShop() {
  const configuredSource = process.env.CATALOG_SOURCE_SHOP?.trim().toLowerCase();
  const allowedShops = configuredAppAdminShops();

  if (configuredSource) {
    if (!SHOP_DOMAIN_PATTERN.test(configuredSource)) {
      throw new Error("CATALOG_SOURCE_SHOP must be a canonical myshopify.com domain");
    }
    if (!allowedShops.includes(configuredSource)) {
      throw new Error("CATALOG_SOURCE_SHOP must also be present in APP_ADMIN_SHOPS");
    }
    return configuredSource;
  }

  return allowedShops[0] ?? null;
}

export function isAppAdminSession(session: unknown) {
  if (!session || typeof session !== "object") return false;

  const candidate = session as AppAdminSession;
  const email = candidate.email?.trim().toLowerCase();
  const shop = candidate.shop?.trim().toLowerCase();
  const allowedEmails = configuredValues("APP_ADMIN_EMAILS");
  const allowedShops = configuredAppAdminShops();

  if (allowedShops.length) return Boolean(shop && allowedShops.includes(shop));
  return Boolean(
    (email && allowedEmails.includes(email)) ||
      (shop && allowedShops.includes(shop)),
  );
}

export function appAdminConfigurationState() {
  return {
    allowlistConfigured: Boolean(
      process.env.APP_ADMIN_EMAILS?.trim() || process.env.APP_ADMIN_SHOPS?.trim(),
    ),
    allowlistMode: process.env.APP_ADMIN_EMAILS?.trim()
      ? process.env.APP_ADMIN_SHOPS?.trim()
        ? "email + shop"
        : "email"
      : "shop",
    aiProviderConfigured: Boolean(
      process.env.OPENAI_API_KEY?.trim() ||
        process.env.DEIN_NEUER_OPENAI_PROJECT_KEY?.trim() ||
        process.env.GEMINI_API_KEY?.trim(),
    ),
    productWritesScoped: true,
    automaticPublicationEnabled: false,
  };
}
