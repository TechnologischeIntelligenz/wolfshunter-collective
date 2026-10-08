import fs from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

for (const pathname of ["/", "/healthz"]) {
  const response = await fetch(`https://wolfshunter-collective-test.limoorange99.workers.dev${pathname}`, {
    redirect: "manual", signal: AbortSignal.timeout(20000),
  });
  const body = await response.text();
  const location = response.headers.get("location");
  console.log(JSON.stringify({ pathname, status: response.status,
    redirectHost: location ? new URL(location, response.url).hostname : undefined,
    accessBlocked: body.includes("You don't have permission to view this"),
    appHealth: pathname === "/healthz" && response.headers.get("content-type")?.includes("application/json") ? JSON.parse(body) : undefined,
  }));
}

const config = await fs.readFile(path.join(process.env.APPDATA, "xdg.config/.wrangler/config/default.toml"), "utf8");
const token = config.match(/^oauth_token\s*=\s*"([^"\r\n]+)"/m)?.[1];
if (!token) throw new Error("Cloudflare OAuth is not configured.");
const account = "26772071fc212ec3397c645c6c98a350";
for (const endpoint of ["workers/scripts/wolfshunter-collective-test/subdomain", "access/organizations", "access/apps?aud=c545f23d095b3ded1cedfe68e7a784af1ebb2fa0a5a2dc67e57f1e2530fe5b07&per_page=100", "access/identity_providers"]) {
  await delay(1000);
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(20000),
  });
  const result = await response.json();
  if (!response.ok || !result.success) {
    console.log(JSON.stringify({ endpoint, status: response.status, errors: result.errors?.map(item => ({ code: item.code, message: item.message })) }));
    continue;
  }
  const selected = endpoint.startsWith("access/apps")
    ? result.result.map(item => ({ id: item.id, name: item.name, domain: item.domain, type: item.type, aud: item.aud, destinations: item.destinations, allowed_idps: item.allowed_idps }))
    : endpoint === "access/organizations" ? { name: result.result.name, auth_domain: result.result.auth_domain, deny_unmatched_requests: result.result.deny_unmatched_requests }
    : endpoint === "access/identity_providers" ? result.result.map(item => ({ id: item.id, name: item.name, type: item.type }))
    : result.result;
  console.log(JSON.stringify({ endpoint, result: selected, result_info: result.result_info }));
}
