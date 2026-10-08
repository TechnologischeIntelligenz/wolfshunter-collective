/* eslint-env node */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';
import { validateDestination } from './import-sqlite-postgres.mjs';

const shop = 'wolfshunter-ai-dev.myshopify.com';
const mode = process.argv[2];
const withVariants = mode?.endsWith('-variants');
if (!['inspect', 'create', 'verify', 'inspect-variants', 'create-variants', 'verify-variants', 'audit-stock-media', 'audit-title', 'repair-readiness', 'audit-locations', 'audit-shipping', 'stock-start', 'stock-step', 'stock-status', 'stock-drain', 'stock-missing', 'imports-stock', 'supplier-tags', 'stock-stop-legacy-export', 'stock-resume-existing-data', 'stock-report', 'stock-suppliers', 'stock-verify-counts', 'reconcile-deletions', 'imports-summary', 'verify-selection', 'clear-confirmed-stock-errors'].includes(mode)) throw new Error('Unsupported import check mode');
Object.assign(process.env, parseEnv(await fs.readFile(new URL('../.dev.vars', import.meta.url), 'utf8')), {
  NODE_ENV: 'production', BILLING_TEST_MODE: 'true', APP_ROLE: 'retailer',
  APP_ADMIN_SHOPS: '3ddd6b-2.myshopify.com', CATALOG_SOURCE_SHOP: '3ddd6b-2.myshopify.com',
  SHOPIFY_APP_URL: 'https://wolfshunter-collective-test.limoorange99.workers.dev',
});
const env = parseEnv(await fs.readFile(new URL('../.env.cloudflare-database', import.meta.url), 'utf8'));
const connection = new URL(validateDestination(env.MIGRATION_DATABASE_URL, 'roggwnlqgjbrnrwzrjsm'));
connection.searchParams.set('sslmode', 'verify-full');
connection.searchParams.set('sslrootcert', fileURLToPath(new URL('../_recovery/supabase-prod-ca-2021.crt', import.meta.url)));
const runtime = await import('../_recovery/live-import-runtime.mjs');
try {
  await runtime.withDatabase(connection.href, async () => {
    const { admin } = await runtime.unauthenticated.admin(shop);
    const identity = await (await admin.graphql('query ImportTestIdentity { shop { myshopifyDomain currencyCode } currentAppInstallation { app { apiKey } } }')).json();
    assert.equal(identity.data?.shop?.myshopifyDomain, shop);
    assert.equal(identity.data?.currentAppInstallation?.app?.apiKey, '51671c87d216d57415143f2ad8729399');
    if (mode === 'supplier-tags') {
      const vendors = await runtime.db.catalogKnowledgeProduct.groupBy({ by: ['vendor'], where: { sourceShop: '3ddd6b-2.myshopify.com' }, _count: { _all: true }, orderBy: { _count: { vendor: 'desc' } } });
      console.log(JSON.stringify({ vendors }));
      const tags = await runtime.db.$queryRawUnsafe(`SELECT tag, COUNT(*)::integer AS products FROM "CatalogKnowledgeProduct", jsonb_array_elements_text("tagsJson"::jsonb) AS tag WHERE "sourceShop"=$1 AND tag ~* '(dear|trend|fast.*us|cj)' GROUP BY tag ORDER BY products DESC LIMIT 80`, '3ddd6b-2.myshopify.com');
      console.log(JSON.stringify({ tags }));
      const source = await runtime.unauthenticated.admin('3ddd6b-2.myshopify.com');
      const live = await (await source.admin.graphql('query LiveSupplierTags { shop { myshopifyDomain primaryDomain { host } } dear: productsCount(query: "tag:dearlover", limit: null) { count precision } trendsi: productsCount(query: "tag:trendsi", limit: null) { count precision } samples: products(first: 5, query: "tag:dearlover OR tag:trendsi") { nodes { id title tags } } }')).json();
      assert.ok(!live.errors?.length);
      console.log(JSON.stringify({ live: live.data }));
      return;
    }
    if (mode === 'stock-missing') {
      const rows = await runtime.db.$queryRawUnsafe(`SELECT c."sourceProductId", c.title, c.vendor, c."totalInventory", (s."payloadJson"::jsonb->>'unknownVariants')::integer AS missing FROM "CatalogKnowledgeProduct" c JOIN "RuntimeSourceState" s ON s.shop=c."sourceShop" AND s.kind='stock:' || c."sourceProductId" WHERE c."sourceShop"=$1 AND (s."payloadJson"::jsonb->>'quantity') IS NULL ORDER BY c."sourceProductId" LIMIT 8`, '3ddd6b-2.myshopify.com');
      const source = await runtime.unauthenticated.admin('3ddd6b-2.myshopify.com');
      const ids = rows.map(row => row.sourceProductId);
      const body = await (await source.admin.graphql('query MissingStockLocations($ids: [ID!]!) { nodes(ids: $ids) { ... on Product { id title variants(first: 2) { nodes { title inventoryItem { tracked inventoryLevels(first: 10) { nodes { location { id name } quantities(names: ["available"]) { name quantity } } pageInfo { hasNextPage } } } } } } } }', { variables: { ids } })).json();
      assert.ok(!body.errors?.length);
      console.log(JSON.stringify({ catalogSamples: rows, sourceSamples: body.data.nodes }));
      await fs.writeFile(new URL('../docs/CATALOG-STOCK-MISSING-SAMPLES-20260918.json', import.meta.url), JSON.stringify({ catalogSamples: rows, sourceSamples: body.data.nodes }, null, 2) + '\n', 'utf8');
      return;
    }
    if (mode === 'verify-selection') {
      const settings = await runtime.getRetailerSettings(shop), workspace = await runtime.getRetailerWorkspace(shop);
      const id = 'gid://shopify/Product/7460933402713';
      const report = [];
      for (const view of ['all', 'favorites']) {
        const snapshot = await runtime.getRetailerCatalogSnapshot(shop, settings, { params: new URLSearchParams({ q: 'Hunting Clothes Medium Length' }), affinity: { ...workspace, orderedCategoryCounts: {} }, view });
        assert.equal(snapshot.source, 'shopify');
        assert.ok(!snapshot.catalog.some(row => row.id === id));
        assert.ok(!snapshot.favoriteProductIds.includes(id));
        report.push({ view, transferredTrenchCoatExcluded: true });
      }
      console.log(JSON.stringify({ shop, report }));
      await fs.writeFile(new URL('../docs/SELECTION-EXCLUSION-20260918.json', import.meta.url), JSON.stringify({ checkedAt: new Date().toISOString(), shop, report }, null, 2) + '\n', 'utf8');
      return;
    }
    if (mode === 'clear-confirmed-stock-errors') {
      const changed = await runtime.db.$executeRawUnsafe(`UPDATE "ImportedProductPush" p SET "errorMessage"=NULL,"updatedAt"=NOW() FROM "BackgroundJob" j WHERE p.shop=$1 AND p."sourceProductId" IN ('gid://shopify/Product/8306311168089','gid://shopify/Product/7900759654489') AND p."errorMessage"='The image/stock check could not finish. Retry shortly.' AND j.shop=p.shop AND j.kind='import-readiness:' || p."sourceProductId" AND j.status='COMPLETED' AND (j."stateJson"::jsonb->'summary'->>'stockMatched')::integer=(j."stateJson"::jsonb->'summary'->>'variants')::integer AND (j."stateJson"::jsonb->'summary'->>'skuConfirmed')::integer=(j."stateJson"::jsonb->'summary'->>'variants')::integer AND NOT ((j."stateJson"::jsonb->'summary'->'notes') ? 'The image/stock check could not finish. Retry shortly.')`, shop);
      console.log(JSON.stringify({ clearedConfirmedTransientErrors: changed }));
      return;
    }
    if (mode === 'imports-summary') {
      const items = await runtime.db.$queryRawUnsafe(`SELECT p.id,p."sourceProductId",p."sourceTitle",p."shopifyProductId",p."errorMessage",j."stateJson"::jsonb->'summary' AS summary FROM "ImportedProductPush" p LEFT JOIN "BackgroundJob" j ON j.shop=p.shop AND j.kind='import-readiness:' || p."sourceProductId" WHERE p.shop=$1 ORDER BY p.id LIMIT 100`, shop);
      console.log(JSON.stringify({ items }));
      await fs.writeFile(new URL('../docs/ALL-IMPORTS-STOCK-20260918.json', import.meta.url), JSON.stringify({ checkedAt: new Date().toISOString(), items }, null, 2) + '\n', 'utf8');
      return;
    }
    if (mode === 'imports-stock') {
      const sourceShop = '3ddd6b-2.myshopify.com';
      const source = await runtime.unauthenticated.admin(sourceShop);
      const sourceJob = await runtime.db.backgroundJob.findUniqueOrThrow({ where: { shop_kind: { shop: sourceShop, kind: 'source-stock' } } });
      assert.equal(sourceJob.status, 'COMPLETED');
      const sourceRun = JSON.parse(sourceJob.stateJson).startedAt;
      await runtime.db.backgroundJob.upsert({ where: { shop_kind: { shop, kind: 'import-stock' } }, create: { shop, kind: 'import-stock', stateJson: JSON.stringify({ after: 0, checked: 0, matched: 0, needsReview: 0, startedAt: new Date().toISOString(), sourceRun }) }, update: {} });
      for (let step = 0; step < 30; step++) {
        const outcome = await runtime.processImportStock(admin, source.admin, shop);
        const job = await runtime.db.backgroundJob.findUniqueOrThrow({ where: { shop_kind: { shop, kind: 'import-stock' } } });
        console.log(JSON.stringify({ status: job.status, outcome, ...JSON.parse(job.stateJson) }));
        if (outcome !== 'pending') break;
      }
      return;
    }
    if (mode === 'reconcile-deletions') {
      const sourceShop = '3ddd6b-2.myshopify.com';
      const source = await runtime.unauthenticated.admin(sourceShop);
      let after = null;
      const deleted = [];
      for (let page = 0; page < 10; page++) {
        const result = await (await source.admin.graphql('query RecentProductDeletions($after: String) { shop { myshopifyDomain } events(first: 250, after: $after, query: "action:destroy AND subject_type:PRODUCT AND created_at:>=2026-09-18T00:00:00Z") { nodes { ... on BasicEvent { action subjectId subjectType createdAt } } pageInfo { hasNextPage endCursor } } }', { variables: { after } })).json();
        assert.ok(!result.errors?.length, 'Product deletion events must be available');
        assert.equal(result.data.shop.myshopifyDomain, sourceShop);
        for (const event of result.data.events.nodes) {
          assert.equal(event.action, 'destroy'); assert.equal(event.subjectType, 'PRODUCT');
          assert.match(event.subjectId, /^gid:\/\/shopify\/Product\/\d+$/);
          deleted.push(event.subjectId);
        }
        if (!result.data.events.pageInfo.hasNextPage) break;
        assert.ok(page < 9 && result.data.events.pageInfo.endCursor !== after);
        after = result.data.events.pageInfo.endCursor;
      }
      const candidates = await runtime.db.catalogKnowledgeProduct.findMany({ where: { sourceShop, status: { not: 'REMOVED' }, sourceProductId: { in: deleted } }, select: { sourceProductId: true } });
      let removed = 0;
      for (let offset = 0; offset < candidates.length; offset += 100) {
        const ids = candidates.slice(offset, offset + 100).map(row => row.sourceProductId);
        const verified = await (await source.admin.graphql('query ConfirmDeletedProducts($ids: [ID!]!) { nodes(ids: $ids) { id } }', { variables: { ids } })).json();
        assert.ok(!verified.errors?.length && verified.data.nodes.length === ids.length);
        const missing = ids.filter((_id, index) => verified.data.nodes[index] === null);
        removed += (await runtime.db.catalogKnowledgeProduct.updateMany({ where: { sourceShop, sourceProductId: { in: missing } }, data: { status: 'REMOVED' } })).count;
      }
      console.log(JSON.stringify({ deletionEvents: deleted.length, cachedProductsConfirmedDeleted: removed, shopifyProductsDeletedByThisTool: 0 }));
      return;
    }
    if (mode === 'stock-report') {
      const rows = await runtime.db.$queryRawUnsafe(`SELECT CASE WHEN LOWER(c.vendor)='trendsi' THEN 'trendsi' WHEN LOWER(c.vendor) IN ('dear-lover dropshipping','dearlover') THEN 'dear-lover' ELSE 'cj' END AS supplier, COUNT(*)::integer AS products, COUNT(*) FILTER (WHERE s."payloadJson"::jsonb->>'quantity' IS NULL)::integer AS unknown, COUNT(*) FILTER (WHERE (s."payloadJson"::jsonb->>'quantity')::bigint>0)::integer AS positive, COUNT(*) FILTER (WHERE (s."payloadJson"::jsonb->>'quantity')::bigint=0)::integer AS zero FROM "CatalogKnowledgeProduct" c LEFT JOIN "RuntimeSourceState" s ON s.shop=c."sourceShop" AND s.kind='stock:' || c."sourceProductId" WHERE c."sourceShop"=$1 AND c.status <> 'REMOVED' GROUP BY 1 ORDER BY 1`, '3ddd6b-2.myshopify.com');
      console.log(JSON.stringify({ suppliers: rows }));
      await fs.writeFile(new URL('../docs/CATALOG-STOCK-COVERAGE-20260918.json', import.meta.url), JSON.stringify({ checkedAt: new Date().toISOString(), suppliers: rows }, null, 2) + '\n', 'utf8');
      return;
    }
    if (mode === 'stock-resume-existing-data') {
      const sourceShop = '3ddd6b-2.myshopify.com';
      const previous = await runtime.db.backgroundJob.findUniqueOrThrow({ where: { shop_kind: { shop: sourceShop, kind: 'source-stock' } } });
      const checkpoint = JSON.parse(previous.stateJson);
      assert.equal(checkpoint.operationId, 'gid://shopify/BulkOperation/7532614352985');
      assert.equal(checkpoint.phase, 'poll');
      assert.equal(previous.status, 'CANCELLED');
      const changed = await runtime.db.backgroundJob.updateMany({ where: { id: previous.id, revision: previous.revision, status: 'CANCELLED' }, data: { status: 'PENDING', stateJson: JSON.stringify({ ...checkpoint, vendorFromCatalog: true }), nextRunAt: new Date(), attempts: 0, errorMessage: null, revision: { increment: 1 } } });
      assert.equal(changed.count, 1);
      console.log(JSON.stringify({ resumedExistingExport: checkpoint.operationId, newExportStarted: false }));
      return;
    }
    if (mode === 'stock-stop-legacy-export') {
      const sourceShop = '3ddd6b-2.myshopify.com';
      const previous = await runtime.db.backgroundJob.findUniqueOrThrow({ where: { shop_kind: { shop: sourceShop, kind: 'source-stock' } } });
      const checkpoint = JSON.parse(previous.stateJson);
      assert.equal(checkpoint.operationId, 'gid://shopify/BulkOperation/7532614352985');
      assert.equal(checkpoint.phase, 'poll');
      assert.equal(previous.status, 'PENDING');
      const source = await runtime.unauthenticated.admin(sourceShop);
      const result = await (await source.admin.graphql('query LegacyStockExport($id: ID!) { node(id: $id) { ... on BulkOperation { status } } }', { variables: { id: checkpoint.operationId } })).json();
      assert.ok(!result.errors?.length);
      assert.ok(['COMPLETED', 'FAILED', 'CANCELED', 'EXPIRED'].includes(result.data?.node?.status), 'Wait for the old export to finish before replacing it');
      const changed = await runtime.db.backgroundJob.updateMany({ where: { id: previous.id, revision: previous.revision, status: 'PENDING' }, data: { status: 'CANCELLED', errorMessage: 'Stopped at merchant request: no repeated whole-catalog scans; prior export lacks vendor fields', revision: { increment: 1 } } });
      assert.equal(changed.count, 1);
      console.log(JSON.stringify({ status: 'CANCELLED', replacementStarted: false }));
      return;
    }
    if (mode === 'stock-verify-counts') {
      const sourceShop = '3ddd6b-2.myshopify.com';
      const source = await runtime.unauthenticated.admin(sourceShop);
      const counts = await (await source.admin.graphql('query VerifyStockCount { productsCount(limit: null) { count precision } }')).json();
      const previous = await runtime.db.backgroundJob.findUniqueOrThrow({ where: { shop_kind: { shop: sourceShop, kind: 'source-stock' } } });
      const checkpoint = JSON.parse(previous.stateJson);
      const persisted = await runtime.db.$queryRawUnsafe(`SELECT COUNT(*)::integer AS products FROM "RuntimeSourceState" WHERE shop=$1 AND kind LIKE 'stock:%' AND "payloadJson"::jsonb->>'checkedAt'=$2`, sourceShop, checkpoint.startedAt);
      console.log(JSON.stringify({ live: counts.data, persisted, expected: checkpoint.expected, attempts: previous.attempts }));
      return;
    }
    if (mode.startsWith('stock-')) {
      const sourceShop = '3ddd6b-2.myshopify.com';
      if (mode === 'stock-start') await runtime.queueSourceStock(sourceShop);
      if (mode === 'stock-suppliers') {
        const previous = await runtime.db.backgroundJob.findUniqueOrThrow({ where: { shop_kind: { shop: sourceShop, kind: 'source-stock' } } });
        const checkpoint = JSON.parse(previous.stateJson);
        if (previous.status === 'PENDING' && checkpoint.operationId === 'gid://shopify/BulkOperation/7532614352985' && checkpoint.phase === 'verify' && checkpoint.products === 8237) {
          const changed = await runtime.db.backgroundJob.updateMany({ where: { id: previous.id, revision: previous.revision, status: 'PENDING' }, data: { status: 'FAILED', errorMessage: 'Source count changed from 8237 to 8137 after existing export; supplier subset reconciliation required', revision: { increment: 1 } } });
          assert.equal(changed.count, 1);
        }
        await runtime.queueSourceStock(sourceShop, 'vendor:"Dear-Lover Dropshipping" OR vendor:Trendsi');
      }
      if (mode !== 'stock-status') {
        const source = await runtime.unauthenticated.admin(sourceShop);
        for (let step = 0; step < (mode === 'stock-drain' ? 120 : 1); step++) {
          const outcome = await runtime.processSourceStock(source.admin, sourceShop);
          const current = await runtime.db.backgroundJob.findUniqueOrThrow({ where: { shop_kind: { shop: sourceShop, kind: 'source-stock' } } });
          const progress = JSON.parse(current.stateJson);
          console.log(JSON.stringify({ step: outcome, phase: progress.phase, products: progress.products, expected: progress.expected, unknownProducts: progress.unknownProducts }));
          if (outcome !== 'pending' || progress.phase === 'poll') break;
        }
      }
      const job = await runtime.db.backgroundJob.findUniqueOrThrow({ where: { shop_kind: { shop: sourceShop, kind: 'source-stock' } } });
      const { phase, expected, products, variants, unknownProducts, offset, size, operationId } = JSON.parse(job.stateJson);
      console.log(JSON.stringify({ status: job.status, phase, expected, products, variants, unknownProducts, offset, size, operationId, error: job.errorMessage }));
      return;
    }
    if (mode === 'audit-shipping') {
      const sourceShop = '3ddd6b-2.myshopify.com';
      const source = await runtime.unauthenticated.admin(sourceShop);
      const reports = [];
      for (const [domain, client] of [[sourceShop, source.admin], [shop, admin]]) {
        const info = await (await client.graphql('query ShippingAuditIdentity { shop { myshopifyDomain shopPolicies { type body } } }')).json();
        assert.ok(!info.errors?.length && info.data?.shop?.myshopifyDomain === domain);
        const policy = info.data.shop.shopPolicies.find(row => row.type === 'SHIPPING_POLICY')?.body ?? '';
        const profiles = [];
        let after = null;
        for (let page = 0; page < 20; page++) {
          const body = await (await client.graphql(`query ShippingAuditProfiles($after: String) {
            deliveryProfiles(first: 2, after: $after) { nodes { id name default
              profileLocationGroups { locationGroup { id locations(first: 20, includeLegacy: true) { nodes { id name } pageInfo { hasNextPage } } }
                locationGroupZones(first: 10) { nodes { zone { id name countries { code { countryCode restOfWorld } } }
                  methodDefinitions(first: 20) { nodes { id name active rateProvider { __typename ... on DeliveryRateDefinition { price { amount currencyCode } } }
                    methodConditions { field operator conditionCriteria { ... on MoneyV2 { amount currencyCode } ... on Weight { value unit } } }
                  } pageInfo { hasNextPage } }
                } pageInfo { hasNextPage } }
              }
            } pageInfo { hasNextPage endCursor } }
          }`, { variables: { after } })).json();
          assert.ok(!body.errors?.length, 'Shipping profile query must succeed');
          const data = body.data.deliveryProfiles;
          profiles.push(...data.nodes);
          if (!data.pageInfo.hasNextPage) break;
          assert.ok(data.pageInfo.endCursor && data.pageInfo.endCursor !== after && page < 19);
          after = data.pageInfo.endCursor;
        }
        const nestedComplete = profiles.every(profile => profile.profileLocationGroups.every(group => !group.locationGroup.locations.pageInfo.hasNextPage && !group.locationGroupZones.pageInfo.hasNextPage && group.locationGroupZones.nodes.every(zone => !zone.methodDefinitions.pageInfo.hasNextPage)));
        const report = { shop: domain, policyPresent: !!policy, policyHash: policy ? createHash('sha256').update(policy).digest('hex') : null, nestedComplete, profiles };
        reports.push(report);
        console.log(JSON.stringify({ shop: domain, policyPresent: report.policyPresent, nestedComplete, profiles: profiles.map(profile => ({ id: profile.id, name: profile.name, default: profile.default, groups: profile.profileLocationGroups.map(group => ({ locations: group.locationGroup.locations.nodes, zones: group.locationGroupZones.nodes.map(zone => ({ name: zone.zone.name, countries: zone.zone.countries.length, activeRates: zone.methodDefinitions.nodes.filter(method => method.active).map(method => ({ name: method.name, provider: method.rateProvider })) })) })) })) }));
      }
      console.log(JSON.stringify({ shippingPolicyIdentical: !!reports[0].policyHash && reports[0].policyHash === reports[1].policyHash }));
      await fs.writeFile(new URL('../docs/IMPORT-SHIPPING-AUDIT-20260918.json', import.meta.url), JSON.stringify({ checkedAt: new Date().toISOString(), reports }, null, 2) + '\n', 'utf8');
      return;
    }
    if (mode === 'audit-locations') {
      const response = await admin.graphql('query AuditImportLocations { currentAppInstallation { id app { id title apiKey } } shop { fulfillmentServices { id serviceName handle callbackUrl inventoryManagement trackingSupport type location { id name } } } locations(first: 20, includeInactive: true, includeLegacy: true) { nodes { id name isActive fulfillsOnlineOrders fulfillmentService { id serviceName inventoryManagement } } pageInfo { hasNextPage } } }');
      const body = await response.json();
      const services = body.data?.shop?.fulfillmentServices?.map(({ callbackUrl, ...service }) => ({ ...service, callbackHost: callbackUrl ? new URL(callbackUrl).hostname : null }));
      const report = { checkedAt: new Date().toISOString(), shop, currentAppInstallation: body.data?.currentAppInstallation, services, locations: body.data?.locations, errors: body.errors?.map(row => row.message) };
      console.log(JSON.stringify(report));
      assert.ok(!body.errors?.length);
      await fs.writeFile(new URL('../docs/IMPORT-LOCATIONS-20260918.json', import.meta.url), JSON.stringify(report, null, 2) + '\n', 'utf8');
      return;
    }
    if (mode.startsWith('inspect')) {
      const candidates = await runtime.db.catalogKnowledgeProduct.findMany({
        where: { sourceShop: '3ddd6b-2.myshopify.com', status: 'ACTIVE', variantCount: withVariants ? { gte: 2, lte: 12 } : 1, priceMinimum: { gt: 0 }, currency: identity.data.shop.currencyCode },
        orderBy: { sourceProductId: 'asc' }, take: 3,
        select: { sourceProductId: true, title: true, variantCount: true, imageCount: true, priceMinimum: true },
      });
      console.log(JSON.stringify({ shop, currency: identity.data.shop.currencyCode, candidates }));
      return;
    }
    let sourceProductId = process.argv[3];
    let targetProductId;
    if (mode === 'audit-title') {
      const title = process.argv[3];
      assert.ok(title && title.length <= 250);
      const candidates = await runtime.db.catalogKnowledgeProduct.findMany({ where: { sourceShop: '3ddd6b-2.myshopify.com', title: { contains: title, mode: 'insensitive' } }, take: 5, select: { sourceProductId: true, title: true, variantCount: true } });
      const searchTitle = process.argv[4] || title;
      const response = await admin.graphql('query FindAuditedProduct($query: String!) { products(first: 10, query: $query) { nodes { id title } } }', { variables: { query: `title:"${searchTitle.replace(/["\\]/g, '')}"` } });
      const body = await response.json();
      assert.ok(!body.errors?.length, 'Product lookup must succeed');
      const targets = body.data?.products?.nodes ?? [];
      const imports = candidates.length === 1 ? await runtime.db.importedProductPush.findMany({ where: { sourceProductId: candidates[0].sourceProductId }, take: 5, select: { shop: true, shopifyProductId: true, status: true } }) : [];
      console.log(JSON.stringify({ sourceCandidates: candidates, targetCandidates: targets, imports }));
      assert.equal(candidates.length, 1, 'Expected one source match; inspect candidates before continuing');
      const saved = imports.filter(row => row.shop === shop && row.shopifyProductId);
      assert.ok(targets.length === 1 || (targets.length === 0 && saved.length === 1), 'Expected one target or saved import match');
      sourceProductId = candidates[0].sourceProductId;
      targetProductId = targets[0]?.id ?? saved[0].shopifyProductId;
    }
    assert.match(sourceProductId ?? '', /^gid:\/\/shopify\/Product\/\d+$/);
    if (mode === 'repair-readiness') {
      const source = await runtime.unauthenticated.admin('3ddd6b-2.myshopify.com');
      const details = await runtime.readImportDetails(source.admin, '3ddd6b-2.myshopify.com', sourceProductId);
      console.log(JSON.stringify({ sourceProductId, variants: details.variants.length, knownCJStock: details.variants.filter(row => row.quantity !== null).length, images: details.imageUrls.length }));
      const result = await runtime.repairImportedReadiness(admin, shop, sourceProductId, details);
      await fs.writeFile(new URL(`../docs/IMPORT-REPAIR-${sourceProductId.split('/').pop()}-20260918.json`, import.meta.url), JSON.stringify({ checkedAt: new Date().toISOString(), shop, sourceProductId, ...result }, null, 2) + '\n', 'utf8');
      console.log(JSON.stringify(result));
      return;
    }
    if (mode === 'audit-stock-media' || mode === 'audit-title') {
      if (!targetProductId) {
        const push = await runtime.db.importedProductPush.findUniqueOrThrow({ where: { shop_sourceProductId: { shop, sourceProductId } } });
        targetProductId = push.shopifyProductId;
      }
      const sourceShop = '3ddd6b-2.myshopify.com';
      const source = await runtime.unauthenticated.admin(sourceShop);
      const read = async (client, expectedShop, id) => {
        let result;
        let after = null;
        for (let page = 0; page < 5; page++) {
        const response = await client.graphql(`query AuditImportStockMedia($id: ID!, $after: String) {
          shop { myshopifyDomain }
          product(id: $id) { id title status totalInventory variantsCount { count }
            images(first: 50) { nodes { id url } pageInfo { hasNextPage } }
            variants(first: 50, after: $after) { nodes { id title inventoryQuantity inventoryPolicy availableForSale
              selectedOptions { name value }
              media(first: 5) { nodes { id ... on MediaImage { image { url } } } pageInfo { hasNextPage } }
              inventoryItem { tracked inventoryLevels(first: 5) { nodes { location { id name } quantities(names: ["available", "on_hand", "committed"]) { name quantity } } pageInfo { hasNextPage } } }
            } pageInfo { hasNextPage endCursor } }
          }
        }`, { variables: { id, after } });
        const body = await response.json();
        if (body.errors?.length) console.log(JSON.stringify({ shop: expectedShop, errors: body.errors.map(error => error.message.slice(0, 240)) }));
        assert.equal(response.status, 200);
        assert.ok(!body.errors?.length, 'Stock/media query must succeed');
        assert.equal(body.data?.shop?.myshopifyDomain, expectedShop);
        assert.equal(body.data?.product?.id, id);
        const product = body.data.product;
        if (!result) result = product;
        else result.variants.nodes.push(...product.variants.nodes);
        if (!product.variants.pageInfo.hasNextPage) {
          result.variants.pageInfo = product.variants.pageInfo;
          assert.equal(result.variants.nodes.length, result.variantsCount.count);
          return result;
        }
        assert.ok(product.variants.pageInfo.endCursor && product.variants.pageInfo.endCursor !== after);
        after = product.variants.pageInfo.endCursor;
        }
        throw new Error('Audit supports at most 250 variants');
      };
      const sourceProduct = await read(source.admin, sourceShop, sourceProductId);
      const targetProduct = await read(admin, shop, targetProductId);
      const report = { checkedAt: new Date().toISOString(), readOnly: true, sourceShop, shop, source: sourceProduct, target: targetProduct };
      const filename = `../docs/IMPORT-STOCK-MEDIA-${sourceProductId.split('/').pop()}-20260918.json`;
      await fs.writeFile(new URL(filename, import.meta.url), JSON.stringify(report, null, 2) + '\n', 'utf8');
      for (const [side, data] of [['source', sourceProduct], ['target', targetProduct]]) console.log(JSON.stringify({ side, id: data.id, title: data.title, status: data.status, totalInventory: data.totalInventory, images: data.images.nodes.length, moreImages: data.images.pageInfo.hasNextPage, variantCount: data.variants.nodes.length, withStock: data.variants.nodes.filter(row => row.inventoryQuantity > 0).length, tracked: data.variants.nodes.filter(row => row.inventoryItem.tracked).length, available: data.variants.nodes.filter(row => row.availableForSale).length, withVariantMedia: data.variants.nodes.filter(row => row.media.nodes.length).length, samples: data.variants.nodes.slice(0, 3).map(row => ({ title: row.title, inventoryQuantity: row.inventoryQuantity, tracked: row.inventoryItem.tracked, availableForSale: row.availableForSale, inventoryPolicy: row.inventoryPolicy, mediaCount: row.media.nodes.length, levels: row.inventoryItem.inventoryLevels })) }));
      return;
    }
    const settings = await runtime.getRetailerSettings(shop);
    const product = await runtime.getRetailerCatalogProduct(shop, settings, sourceProductId);
    assert.ok(product, 'The selected source product must be available to the retailer');
    const source = withVariants ? await runtime.unauthenticated.admin('3ddd6b-2.myshopify.com') : null;
    const plan = source ? await runtime.readImportVariantPlan(source.admin, '3ddd6b-2.myshopify.com', product, settings.marginPercent) : undefined;
    if (mode.startsWith('create')) {
      await runtime.updateRetailerWorkspace(shop, { intent: 'import', productId: sourceProductId, selected: true, allowedProductIds: [sourceProductId] });
      const response = await runtime.createImportedProductDraft(admin, shop, product, undefined, plan);
      const result = await response.json();
      console.log(JSON.stringify({ status: response.status, ok: result.ok, alreadyExists: result.alreadyExists, warning: result.warning, error: result.error, productId: result.push?.shopifyProductId }));
      assert.equal(result.ok, true);
    }
    const push = await runtime.db.importedProductPush.findUniqueOrThrow({ where: { shop_sourceProductId: { shop, sourceProductId } } });
    const response = await admin.graphql(`query VerifyImportedDraft($id: ID!) {
      product(id: $id) { id title status handle variantsCount { count } images(first: 10) { nodes { url } }
        variants(first: 250) { nodes { id price selectedOptions { name value } inventoryItem { sku } } } }
    }`, { variables: { id: push.shopifyProductId } });
    const data = await response.json();
    assert.ok(!data.errors?.length, 'Shopify verification query failed');
    const draft = data.data?.product;
    assert.ok(draft, 'Created product must exist in Shopify');
    assert.equal(draft.status, 'DRAFT');
    if (plan) {
      const key = row => JSON.stringify(row.selectedOptions.map(option => [option.name, option.value]).sort());
      const expected = new Map(plan.variants.map(row => [key(row), row.price]));
      assert.equal(draft.variantsCount.count, expected.size);
      assert.equal(new Set(draft.variants.nodes.map(key)).size, expected.size);
      for (const row of draft.variants.nodes) assert.equal(row.price, expected.get(key(row)));
    } else {
      assert.equal(Number(draft.variants.nodes[0].price), product.recommendedRetailPrice);
      assert.equal(draft.variantsCount.count, 1);
    }
    assert.ok(draft.variants.nodes.every(row => !row.inventoryItem.sku), 'Supplier SKU must not be exposed');
    const report = { checkedAt: new Date().toISOString(), proof: 'Real Shopify API and Supabase; same import service as the route. Browser interaction not covered.', shop, sourceProductId, title: draft.title, productId: draft.id, status: draft.status, price: draft.variants.nodes[0].price, currency: identity.data.shop.currencyCode, variantCount: draft.variantsCount.count, images: draft.images.nodes.length, supplierSkuEmpty: true, importStatus: push.status, warning: push.errorMessage, adminUrl: `https://${shop}/admin/products/${draft.id.split('/').pop()}` };
    if (withVariants) report.variants = draft.variants.nodes.map(({ id, price, selectedOptions }) => ({ id, price, selectedOptions }));
    await fs.writeFile(new URL(withVariants ? '../docs/VARIANT-IMPORT-LIVE-20260918.json' : '../docs/IMPORT-LIVE-READINESS-20260918.json', import.meta.url), JSON.stringify(report, null, 2) + '\n', 'utf8');
    console.log(JSON.stringify(report));
  });
} catch (error) {
  console.error(JSON.stringify({ failed: true, code: error.code ?? error.name, check: error instanceof assert.AssertionError || error.name === 'ReadinessError' ? error.message : 'Import runner failed; no credentials printed.' }));
  process.exitCode = 1;
}
