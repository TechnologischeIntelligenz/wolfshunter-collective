import fs from "node:fs/promises";
import { parseEnv } from "node:util";

const source = parseEnv(await fs.readFile(new URL("../.env", import.meta.url), "utf8"));
const allowed = ["SHOPIFY_API_KEY", "SHOPIFY_API_SECRET"];
const lines = allowed.map(key => {
  if (!source[key]) throw new Error(`Missing ${key}`);
  return `${key}=${JSON.stringify(source[key])}`;
});
await fs.writeFile(new URL("../.dev.vars", import.meta.url), `${lines.join("\n")}\n`, { mode: 0o600 });
console.log("Prepared two Shopify credentials in the ignored test secret file. Values were not printed.");
