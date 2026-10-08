import fs from "node:fs";
import path from "node:path";
export function loadRuntimeEnvironment() {
  process.env.NODE_ENV ??= "production";
  const file=process.env.APP_ENV_FILE || (process.env.NODE_ENV === "production" ? ".env.production" : ".env");
  if (fs.existsSync(file)) process.loadEnvFile(file);
  else if (process.env.APP_ENV_FILE) throw new Error("The configured APP_ENV_FILE does not exist");
}
export function productionConfigErrors(env=process.env) {
  const errors=[];
  for(const key of ["SHOPIFY_API_KEY","SHOPIFY_API_SECRET","SHOPIFY_APP_URL","DATABASE_URL","SOURCE_DATA_DIR","APP_ADMIN_SHOPS","CATALOG_SOURCE_SHOP","SCOPES"]){if(!env[key]?.trim())errors.push(`${key} is required`);}
  try {
    const url=new URL(env.SHOPIFY_APP_URL);
    if(url.protocol!=="https:"||url.username||url.password||url.search||url.hash||url.pathname!=="/"||/^(localhost|127\.|0\.)/.test(url.hostname)||url.hostname.endsWith(".trycloudflare.com")) errors.push("SHOPIFY_APP_URL must be a permanent HTTPS origin");
  }catch{errors.push("SHOPIFY_APP_URL must be a permanent HTTPS origin");}
  const shopPattern=/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;
  if(!shopPattern.test(env.CATALOG_SOURCE_SHOP??"")) errors.push("CATALOG_SOURCE_SHOP must be a Shopify domain");
  const admins=(env.APP_ADMIN_SHOPS??"").split(",").map(s=>s.trim()).filter(Boolean);
  if(admins.some(s=>!shopPattern.test(s))||!admins.includes(env.CATALOG_SOURCE_SHOP))errors.push("The source shop must be in APP_ADMIN_SHOPS");
  if(env.APP_ROLE && !["retailer","supplier"].includes(env.APP_ROLE))errors.push("APP_ROLE must be retailer or supplier");
  const dbPath=(env.DATABASE_URL??"").replace(/^file:/,"").split("?")[0];
  if(!env.DATABASE_URL?.startsWith("file:")||!path.isAbsolute(dbPath)) errors.push("DATABASE_URL must point to an absolute persistent SQLite file for this build");
  if(!path.isAbsolute(env.SOURCE_DATA_DIR??""))errors.push("SOURCE_DATA_DIR must be an absolute persistent directory");
  const port=Number(env.PORT||3001);if(!Number.isInteger(port)||port<1||port>65535||port===3000)errors.push("PORT must be valid and must not use APPHUB port 3000");
  if(!["true","false"].includes(env.BILLING_TEST_MODE??""))errors.push("Set BILLING_TEST_MODE explicitly to true or false");
  if(env.APP_INSTANCES && env.APP_INSTANCES!=="1")errors.push("This SQLite/background-worker build supports one app instance");
  return errors;
}