import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const execute = promisify(execFile);

// Operator-only adapter. CLI credentials remain in Shopify CLI's credential store.
export function cliAdmin(shop) {
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop)) throw new Error("Invalid shop");
  return {
    async graphql(query, { variables = {} } = {}) {
      const directory = path.join("data", "cli", crypto.randomUUID());
      await fs.mkdir(directory, { recursive: true });
      const queryFile = path.join(directory, "query.graphql");
      const variableFile = path.join(directory, "variables.json");
      const outputFile = path.join(directory, "response.json");
      await fs.writeFile(queryFile, query);
      await fs.writeFile(variableFile, JSON.stringify(variables));
      const args = `node node_modules/@shopify/cli/bin/run.js store execute --store ${shop} --query-file ${queryFile} --variable-file ${variableFile} --output-file ${outputFile} --version 2026-07 --json${/^\s*mutation\b/.test(query) ? " --allow-mutations" : ""}`;
      try {
        await execute(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", args], {
          windowsHide: true, timeout: 120000, maxBuffer: 1024 * 1024,
          env: { ...process.env, SHOPIFY_CLI_AGENT_INFO: "n:Codex|v:unknown|p:OpenAI" },
        });
        const data = JSON.parse(await fs.readFile(outputFile, "utf8"));
        return Response.json({ data });
      } catch (error) {
        await fs.writeFile(path.join(directory, "error.log"), String(error.stderr ?? "") + String(error.stdout ?? ""));
        throw new Error("Shopify CLI query failed. Check store authorization and query schema; private diagnostics remain in the CLI.");
      }
    },
  };
}
