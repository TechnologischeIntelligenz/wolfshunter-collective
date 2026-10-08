# Cloudflare test checkpoint — 18 September 2026

This checkpoint covers the separate `wolfshunter-collective-cloudflare-test`
working copy. The original project and snapshot archive were not changed.
The test is a partial hosting migration; the merchant application and database
are not operational on Cloudflare yet.

## Deployment and external availability

- Worker: `wolfshunter-collective-test`.
- URL: https://wolfshunter-collective-test.limoorange99.workers.dev
- Successfully uploaded/deployed version:
  `a141361e-12d7-41ac-83a9-835eeb591515`.
- An unauthenticated external request to `/` returned HTTP **302**, redirecting
  to Cloudflare Access at `polished-wind-d0fe.cloudflareaccess.com`.
- Public HTTP 200 from the deployed application has therefore **not** been
  verified. A successful deployment does not establish public availability or
  successful database access.
- The final route guards, readiness fields, and test banner were built and are
  included in the deployed version above. There have been no runtime source
  edits since that deployment; only documentation, smoke-test, and inspection
  scripts have been added.
- The Worker subdomain API reports `enabled: true` and `previews_enabled: true`.
  The Access applications API returned success with an empty result array. This
  does not establish the absence of an applicable policy; the origin of the
  Access protection remains unresolved.
- The official remote preview also stopped explicitly because Access required
  authentication and no service token was available in the noninteractive run.

Access must be inspected before making any change. It can originate from a
hostname rule, a rule for this Worker, or an account-wide rule that applies to
new Workers. `workers_dev` and `preview_urls` configure URLs, not Access policy.
See the [Cloudflare Access documentation](https://developers.cloudflare.com/workers/configuration/cloudflare-access/).

## Implemented in the test copy

- `workers/app.ts` adapts the compiled React Router application to Workers and
  serves a separate runtime health response.
- The existing landing, support, privacy, and terms pages are preserved. Server
  rendering uses `renderToReadableStream` from `react-dom/server.browser`.
- Prisma's schema now targets PostgreSQL with `engineType = "client"`.
  `PrismaPg` and a lazy request scope provide the database connection scaffold.
  Session storage is instantiated lazily to avoid database polling during module
  initialization.
- No external database is connected. The Worker currently passes an undefined
  connection string to the request scope.
- `/app`, `/auth`, `/webhooks`, `/extensions`, and their subpaths deliberately
  return HTTP 503 at the Worker entry point. These guards must remain until their
  actual dependencies and behavior are ready.
- `/healthz` reports runtime availability while explicitly returning
  `databaseReady: false` and `merchantWorkspaceReady: false`.
- `/phase-one-preview` returns HTTP 404 in production. The fixture preview is not
  evidence of a working merchant application.

## Verification recorded so far

The React Router production build, TypeScript check, and Wrangler deployment dry
run passed. The final local version passed all ten HTTP checks in
`scripts/smoke-workers.mjs`:

- `/`, `/support`, `/privacy`, and `/terms`: HTTP 200 with expected content and
  `X-Robots-Tag: noindex, nofollow`.
- `/app` and `/auth/login`: HTTP 503.
- `/phase-one-preview`, `/.env`, and `/prisma/dev.sqlite`: HTTP 404.
- `/healthz`: HTTP 200 with the exact expected JSON, including
  `databaseReady: false` and `merchantWorkspaceReady: false`.

The deployed URL failed the public smoke test because `/` returned HTTP 302 to
Cloudflare Access. Thus local runtime checks passed; equivalent live application
responses have not been verified.

Run from this test directory, using the installed dependencies:

```powershell
npm.cmd run build
npm.cmd run typecheck
npx.cmd wrangler deploy --dry-run
npx.cmd wrangler dev --ip 127.0.0.1 --port 8787
```

With the local Worker running, use a second terminal:

```powershell
node scripts/smoke-workers.mjs http://127.0.0.1:8787
```

The same smoke script accepts the deployed URL once Access permits the intended
requests. A redirect to Access fails its public-availability assertion and is
not an application success. `scripts/cloudflare-inspect.mjs` performs read-only
account checks using the existing local login. Its successful empty Access-app
result has not resolved which protection causes the observed redirects.

`npm.cmd run deploy` invokes **Shopify app deployment**, not Cloudflare deployment.
The Cloudflare CLI deployment command is `npx.cmd wrangler deploy` and changes the
deployed Worker.

## Database migration is incomplete

The existing files under `prisma/migrations` were written for SQLite and are not a
PostgreSQL migration history. **Do not run `npm.cmd run setup`,
`prisma migrate deploy`, or `npm.cmd run docker-start` against a PostgreSQL URL in
this state.** Changing the Prisma provider and regenerating the client does not
convert migrations or copy data.

The choice of Supabase organization for a new test project is pending the user.
No external database project/data mutation has been performed. Before enabling
database routes, prepare and review a PostgreSQL migration, migrate the intended
data, verify row counts and tenant boundaries, and configure the connection
through the deployment's secret/binding mechanism.

## Catalog and background work require further changes

The actual saved catalog contains 8,237 products in a **101,939,340-byte** file
(approximately 97.2 MiB). A local Node read/parse measurement showed approximately
335 MiB additional heap, 452 MiB additional RSS, 287 ms parsing wall time, and
501 ms process CPU time. This is a local measurement, not a Cloudflare benchmark,
but the current whole-file representation cannot be treated as fitting Workers'
128 MB memory limit or the Free plan's 10 ms CPU allowance.

Uploading that JSON unchanged to object storage and calling `response.json()`
would retain the same memory problem. Use the existing `CatalogKnowledgeProduct`
read model with database filters, explicit display fields, and bounded pages.
Preserve global ranking and bucket counts in database/precomputed logic; ranking
only a fetched page would silently change the existing behavior. Single-product
actions should validate the requested product directly instead of loading the
entire catalog.

Source catalog/commerce files, filesystem locks, and detached/global background
jobs are still implemented for a persistent Node server. They have not been
migrated to durable cloud storage or resumable job execution. Bulk synchronization,
order processing, uninstall/compliance deletion, and related failure recovery
need runtime-specific validation before their routes can be enabled.

See [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
and [Workers filesystem behavior](https://developers.cloudflare.com/workers/runtime-apis/nodejs/fs/).

## Next concrete checks

Latest Access recheck after the user restored LinkedIn login: unauthenticated
GET `/` and `/healthz` both return HTTP 403 with the Cloudflare Access denial
page. This is still not a successful live application check. `wrangler whoami`
renewed the existing OAuth session successfully; the Worker subdomain API confirms
`enabled: true`. The organization Access API returns HTTP 403 Authentication
error. Access applications filtered by the reported audience and identity
providers return empty lists, which do not identify the blocking policy.
The available Wrangler OAuth scopes omit Access management, so this login cannot
change that policy. No Access or DNS settings were changed during diagnosis.

Connection audit subsequently found a real `cloudflare-api` MCP server bundled
with the installed Cloudflare plugin (`https://mcp.cloudflare.com/mcp`), although
its tools were absent from this session. The active `codex mcp list` showed only
the five Hostinger servers. Added the official Cloudflare server using
`codex mcp add cloudflare-api --url https://mcp.cloudflare.com/mcp`; OAuth browser
authorization initially completed but the connection still failed authentication.
Repeating login with `--oauth-client-registration dcr` succeeded. The active chat
tool connection retained stale authentication; an ephemeral local Codex app-server
connection successfully used the saved MCP OAuth login, without extracting secrets
or starting a model turn. No LinkedIn client secret was needed.

### Access resolved and live HTTP checks passed (2026-09-18 05:50 UTC)

The authenticated API identified `All Workers` application
`237bb20f-dac3-4ce4-8d15-d241a695f2e2` as the source of the reported AUD. Its policy
was `non_identity` with `any_valid_service_token`; LinkedIn browser authentication
could not meet that rule. Created only this exact-host exception:

- Application: `62e32b93-974a-4509-a2ee-58dff2161a18`,
  `Wolfshunter test public preview`.
- Domain: `wolfshunter-collective-test.limoorange99.workers.dev`.
- Policy: `f1322467-2132-4cde-b01d-414bd04ac307`, `bypass`, include `everyone`,
  precedence 1, not reusable.
- The create API returned HTTP 201. Existing Access applications, account-wide
  protection, and shop DNS were not changed. Reversing this exception would mean
  removing only that newly created Access application.

All 10 assertions in `scripts/smoke-workers.mjs` subsequently passed against the
deployed URL: `/`, `/support`, `/privacy`, `/terms`, and `/healthz` return 200;
`/app` and `/auth/login` intentionally return 503; the private-file and retired
preview probes return 404. Health reports both database and merchant workspace
readiness false. This proves public test-page availability, not merchant flow or
database readiness.

The authenticated dashboard path is Workers & Pages >
`wolfshunter-collective-test` > Access. Disable only that Worker's rule, or use
"Make this Worker public" if account-level protection is inherited. The actual
blocking rule still needs confirmation; hostname/path policies take precedence.
Keep account-wide protection and shop DNS unchanged. See the
[Worker Access documentation](https://developers.cloudflare.com/workers/configuration/cloudflare-access/#make-a-worker-public-when-all-workers-are-protected).

1. Completed: resolve Cloudflare Access for the exact test hostname and verify
   the existing public pages on the deployed URL (10 assertions passed).
2. Resolve the Supabase organization/project choice and prepare a valid
   PostgreSQL migration and bounded catalog queries.
3. Migrate durable storage and background jobs, then test authentication and each
   merchant/webhook flow before removing its HTTP 503 guard.

This checkpoint does not establish installation, billing, product import,
synchronization, fulfillment, or public App Store readiness.
