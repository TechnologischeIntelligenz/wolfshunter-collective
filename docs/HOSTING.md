# WOLFSHUNTER COLLECTIVE — Hosting Preparation

Status: **PREPARED, NOT DEPLOYED.** This document describes the intended
production setup. No Shopify deploy, billing activation, Cloudflare change,
or APPHUB change has been performed.

## Public target

| Item | Value |
| --- | --- |
| STOREFRONT PRIMARY DOMAIN | `https://www.wolfshunter.com` |
| STOREFRONT PREVIOUS DOMAIN | `https://www.worldshopstore.org` |
| ADMIN SHOP / INTEGRATION IDENTITY | `3ddd6b-2.myshopify.com` |
| ADDITIONAL MYSHOPIFY DOMAIN | `worldshoponlinestore.myshopify.com` |
| COLLECTIVE APP HOSTNAME | `https://collective.wolfshunter.com` |
| COLLECTIVE LOCAL SERVICE | `http://127.0.0.1:3001` |
| RETAILER DEVELOPMENT SHOP | `wolfshunter-ai-dev.myshopify.com` |
| SUPPLIER HOSTNAME | `https://supplier.collective.wolfshunter.com` |
| APPHUB (UNTOUCHED) | `http://127.0.0.1:3000` |

- `www.wolfshunter.com` is the current public Shopify storefront. It replaced
  `www.worldshopstore.org`; do not route the Collective runtime or a public
  admin page over this hostname.
- WOLFSHUNTER operator controls open inside the authenticated Shopify Admin for
  `3ddd6b-2.myshopify.com`, the canonical integration identity behind
  `www.wolfshunter.com`. The app must still validate the shop value supplied by
  Shopify OAuth and never derive identity from the visible custom domain.
- `collective.wolfshunter.com` is the embedded Collective app's application
  host for the allowlisted production admin shop and the retailer installation.
- `supplier.collective.wolfshunter.com` is reserved for the separate Supplier
  Shopify app and is not active until its second Partner app/client ID exists.
- Cloudflare is managed separately and must proxy `collective.wolfshunter.com`
  to the local runtime at `http://127.0.0.1:3001` when cutover is approved.
- Collective runs independently on port **3001**. APPHUB keeps port **3000**.
  Never run Collective on 3000 and never kill APPHUB.

The current `/app/admin` route remains server-side allowlisted and is intended
for the WOLFSHUNTER production store's embedded Shopify Admin context. It must
never be treated as a public storefront route.

Shopify can list both the original and renamed `*.myshopify.com` domains. For
this store, `3ddd6b-2.myshopify.com` is the original integration identity;
`worldshoponlinestore.myshopify.com` is an additional/renamed domain from the
earlier branding. OAuth remains authoritative for each authenticated request.

## Production environment requirements

Required environment variables (no secrets are listed here):

| Variable          | Exact value                            |
| ----------------- | -------------------------------------- |
| `SHOPIFY_APP_URL` | `https://collective.wolfshunter.com`   |
| `PORT`            | `3001`                                 |
| `NODE_ENV`        | `production`                           |
| `APP_ADMIN_SHOPS` | `3ddd6b-2.myshopify.com`               |

Also required at runtime (set via the Shopify CLI / Partner Dashboard, never
printed or committed):

- `SHOPIFY_API_KEY`
- `SHOPIFY_API_SECRET`
- `SCOPES` (comma-separated, unchanged)
- `DATABASE_URL` (production Prisma database with migrations applied)

`.env` is gitignored. `SHOPIFY_API_SECRET` and access tokens must never be
committed or logged.

## Shopify app configuration (`shopify.app.toml`)

Already set and verified against the installed
`@shopify/shopify-app-react-router` implementation:

- `application_url = "https://collective.wolfshunter.com"`
- `embedded = true`
- Client ID, client secret, and scopes: **unchanged**
- `[auth] redirect_urls = [ "https://collective.wolfshunter.com/auth/callback" ]`

The exact OAuth redirect URI required by this project is:

```
https://collective.wolfshunter.com/auth/callback
```

It is constructed by the library as `{appUrl}{authPathPrefix}/callback`
(`authPathPrefix = "/auth"` in `app/shopify.server.ts`).

## Runtime commands

```shell
npm run build        # production build (react-router build)
npm run start:3001   # react-router-serve on PORT=3001
npm run dev:3001     # dev via Shopify CLI on PORT=3001 (isolated)
```

`npm run start` is also available and honors the `PORT` env var.

## Health check

`GET /healthz` returns:

```json
{ "status": "ok", "service": "wolfshunter-collective" }
```

Suitable for Cloudflare/runtime checks. It exposes no tokens, secrets,
credentials, or Shopify session data.

## Routes

| Route                 | Behavior                                                            |
| --------------------- | ------------------------------------------------------------------- |
| `/`                   | Premium public landing / install entry (WOLFSHUNTER COLLECTIVE).    |
| `/auth/*`             | Shopify OAuth (begin, callback, login, session-token, exit-iframe). |
| `/app/*`              | Authenticated embedded Collective workspace (requires valid session).|
| `/healthz`            | Safe JSON health check.                                             |
| `/phase-one-preview`  | Development-only preview; 404 when `NODE_ENV=production`.           |

## Safeguards

- Do NOT run `npm run deploy` / `shopify app deploy` without owner approval.
- Do NOT activate billing.
- Do NOT execute product/inventory/order mutations.
- Do NOT modify Cloudflare or APPHUB.
- Do NOT run Collective on port 3000.

## Update 18 September 2026
Source snapshots use SOURCE_DATA_DIR (default ./data). Compose sets /data/source on the persistent collective-data volume. Populate that directory with the verified current catalog manifest, referenced generation, commerce.json and sync-state.json before production cutover. See RELEASE-REVIEW-20260918.md for current blockers; earlier readiness and scope statements in this document are historical.

