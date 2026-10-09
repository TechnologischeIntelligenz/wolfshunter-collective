# WOLFSHUNTER COLLECTIVE — Codex continuation

## Reopen the project

- Repository: `wolfshunter-collective-cloudflare-test`
- Branch: `recovery-20261008`
- GitHub remote: `github` (`TechnologischeIntelligenz/wolfshunter-collective`)
- Previous verified checkpoint: `8406cc1` (`checkpoint: durable admin shipping sync`)
- Do not deploy until the affected flows have been checked twice and the result is reviewed.

## Current objective

Recover and verify the complete app, fix release blockers, and release only after review. Keep the existing visual design and working behavior intact. The production source/admin shop and the dev-shop retailer view use the same Cloudflare Worker, so changes need checks on both roles.

## Retailer requirements from the merchant

1. Product thumbnails must show in Import Lists and My Products.
2. Favoriting removes a product from Discover and shows it in Favorites, with no duplicate listing.
3. Retailer destinations must reflect the source shop's real shipping policies and destinations.
4. The catalog target is approximately 80% CJ and the remaining eligible Wolfshunter/Worldshop catalog.
5. Stock must be current and evidence-based in Discover and in Shopify drafts. Never guess unknown stock.
6. Merchants can enter shipment tracking; retailers can follow it.
7. Orders must stay synchronized with Shopify.
8. Hide supplier names and source SKUs from retailers; use generated retailer SKUs.

## Verified code findings at the last inspection

- `app/routes/app.import-lists.tsx` creates a DRAFT and sets its price, but does not copy source variants or set inventory quantities. Do not claim draft stock is implemented.
- `app/services/shopify-source-catalog.server.ts` maps `totalInventory` to the retailer stock display. This is not per-variant supplier stock evidence.
- `app/routes/app.tracking.tsx` still labels tracking as planned, not active.
- `app/routes/app.orders.tsx` syncs Shopify orders into the app; this does not implement shipment tracking.
- Favorites are filtered in the Discover and Favorites loaders and toggled optimistically in the UI; authenticated browser behavior still needs verification.
- The My Products image loader used only the current paginated catalog page to match thumbnails to saved imports.

## Local work after checkpoint

Two uncommitted changes were started after `8406cc1`:

- `app/components/collective/product-image-stage.tsx`: reset load/failure state when the image URL changes.
- `app/routes/app.my-products.tsx`: match saved imports against the complete retailer catalog snapshot, not only the current page.

Inspect `git status` before continuing. These changes are not deployed or yet verified against the authenticated Shopify UI.

## Important boundaries

- Do not modify `AppData` or `LocalAppData`.
- Do not print, copy, commit, or ask the user to paste API keys, Shopify tokens, or Cloudflare secrets.
- An OpenAI API key does not restore Codex file access, Shopify/Cloudflare access, or this chat's working context. The app already has an OpenAI-backed assistant in `app/services/openai-assistant.server.ts`; keep its key in server-side secrets only.
- Never claim live behavior based on source code alone. Check the authenticated source/admin shop and dev retailer shop.
- The merchant asked for two checks before any deployment. Make no deployment until those checks pass and the reviewed changes are concrete.

## Resume instruction

Read this file and the current `git status` first. Continue with the two local thumbnail changes, verify them, then work through the retailer requirements above. Give short German progress updates and show concrete results instead of repeating plans.
