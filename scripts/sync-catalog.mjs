import { cliAdmin } from "./shopify-cli-admin.mjs";
import { getCompleteShopifyCatalog } from "../app/services/catalog-bulk.server.ts";
import { writeSourceData } from "../app/services/catalog-snapshot.server.ts";
import { getCatalogSourceShop } from "../app/services/app-admin.server.ts";

process.loadEnvFile(".env");
const shop = getCatalogSourceShop();
if (!shop) throw new Error("Configure the catalog source shop first");
const admin = cliAdmin(shop);
const catalog = await getCompleteShopifyCatalog(admin, console.log);
await writeSourceData(shop, "catalog.json", { sourceShop: shop, syncedAt: new Date().toISOString(), catalog });
console.log("Complete verified catalog saved for the application.");
