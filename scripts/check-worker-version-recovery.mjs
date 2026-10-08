import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const accountId = "26772071fc212ec3397c645c6c98a350";
const scriptName = "wolfshunter-collective-test";
const versionId = process.argv[2] ?? "94057a72-d8e2-4f6b-88f5-184ab22944b4";
const auth = spawnSync(
  process.execPath,
  ["node_modules/wrangler/bin/wrangler.js", "auth", "token", "--json"],
  { cwd: process.cwd(), encoding: "utf8" },
);
if (auth.status !== 0) throw new Error("Cloudflare authentication unavailable");
const token = JSON.parse(auth.stdout).token;
const url = new URL(
  `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/workers/${scriptName}/versions/${versionId}`,
);
url.searchParams.set("include", "modules");
const response = await fetch(url, {
  headers: { Authorization: `Bearer ${token}` },
});
if (!response.ok) {
  console.log(JSON.stringify({ status: response.status, recovered: false }));
  process.exit(1);
}

const envelope = await response.json();
const version = envelope.result ?? {};
const metadata = version.metadata ?? {};
const resources = version.resources ?? {};
const scriptResource = resources.script ?? {};
const modules =
  version.modules ??
  metadata.modules ??
  resources.modules ??
  scriptResource.modules ??
  [];
const recoveryDirectory = path.join(
  process.cwd(),
  "_recovery",
  `cloudflare-worker-${versionId}`,
);
await fs.mkdir(recoveryDirectory, { recursive: true });
const missingFiles = [
  "scheduled-jobs.server.ts",
  "worker-session-storage.server.ts",
  "product-import.server.ts",
  "import-variants.server.ts",
  "import-readiness.server.ts",
  "source-stock-job.server.ts",
  "import-stock-job.server.ts",
];
const summaries = [];
for (const [index, module] of modules.entries()) {
  const encoded = module.content_base64 ?? module.content ?? "";
  const decoded = Buffer.from(encoded, "base64");
  const safeName = path.basename(module.name ?? `module-${index}`);
  await fs.writeFile(path.join(recoveryDirectory, safeName), decoded);
  let sourceMap = null;
  if (module.name?.endsWith(".map")) {
    try {
      const map = JSON.parse(decoded.toString("utf8"));
      sourceMap = {
        sourceCount: map.sources?.length ?? 0,
        includesSourcesContent: Array.isArray(map.sourcesContent),
        missingSourceNames: missingFiles.filter((name) =>
          map.sources?.some((source) => source.endsWith(name)),
        ),
        hasSourceContentForMissingFiles: missingFiles.filter((name) =>
          map.sources?.some(
            (source, index) => source.endsWith(name) && Boolean(map.sourcesContent?.[index]),
          ),
        ),
      };
    } catch {
      sourceMap = { parseable: false };
    }
  }
  summaries.push({
    name: module.name,
    contentType: module.content_type,
    bytes: decoded.length,
    sourceMap,
  });
}
const javascript = modules
  .filter((module) => module.content_type?.includes("javascript"))
  .map((module) => Buffer.from(module.content_base64 ?? "", "base64").toString("utf8"))
  .join("\n");
const refreshMarkers = [
  "refresh_token",
  "refreshToken",
  "refreshAccessToken",
  "grant_type",
];
console.log(
  JSON.stringify(
    {
      status: response.status,
      versionId: version.id,
      resultKeys: Object.keys(version),
      metadataKeys: Object.keys(metadata),
      resourcesKeys: Object.keys(resources),
      scriptResourceKeys: Object.keys(scriptResource),
      moduleCount: modules.length,
      modules: summaries,
      refreshSupportMarkers: Object.fromEntries(
        refreshMarkers.map((marker) => [marker, javascript.includes(marker)]),
      ),
    },
    null,
    2,
  ),
);
