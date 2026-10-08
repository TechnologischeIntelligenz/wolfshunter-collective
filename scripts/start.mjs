import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadRuntimeEnvironment, productionConfigErrors } from "./production-config.mjs";
loadRuntimeEnvironment();
if(process.env.NODE_ENV === "production") {
  const errors=productionConfigErrors();
  if(errors.length){console.error("Production configuration is incomplete:\n"+errors.map(error=>"- "+error).join("\n"));process.exit(1);}
}
const require=createRequire(import.meta.url);
const servePackageJson=require.resolve("@react-router/serve/package.json");
await import(pathToFileURL(path.join(path.dirname(servePackageJson),"bin.js")).href);