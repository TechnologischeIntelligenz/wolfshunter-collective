import { cliAdmin } from "./shopify-cli-admin.mjs";
import { startSourceSync } from "../app/services/source-sync.server.ts";
import { getCatalogSourceShop } from "../app/services/app-admin.server.ts";
import db from "../app/db.server.ts";
process.loadEnvFile(".env");
try {
  const shop = getCatalogSourceShop();
  if (!shop) throw new Error("Configure the source shop first");
  const { completion } = await startSourceSync(cliAdmin(shop), shop);
  const result = await completion;
  console.log(result);
  if (result.status !== "COMPLETED") process.exitCode = 1;
} finally { await db.$disconnect(); }

