import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { getCatalogSourceShop } from "./app-admin.server.ts";
import { catalogGraphql, type CatalogAdmin } from "./catalog-bulk.server.ts";
import { prismaJobStore, runDurableJobStep } from "./durable-job.server.ts";

type CommerceState = { phase: "info" | "markets" | "profiles"; startedAt: string; after: string | null; recentCursors: string[]; pages: number; snapshot: any | null };
export const newCommerceCheckpoint = (): CommerceState => ({ phase: "info", startedAt: new Date().toISOString(), after: null, recentCursors: [], pages: 0, snapshot: null });

function nextPage(state: CommerceState, page: any) {
  if (typeof page?.hasNextPage !== "boolean") throw new Error("Missing commerce pagination");
  if (!page.hasNextPage) return false;
  if (!page.endCursor || page.endCursor === state.after || page.endCursor.length > 4096 || state.recentCursors.includes(page.endCursor)) throw new Error("Commerce pagination stalled");
  state.recentCursors = [...state.recentCursors, page.endCursor].slice(-32);
  state.after = page.endCursor;
  return true;
}

export async function prepareCommerceStep(admin: CatalogAdmin, shop: string, checkpoint: CommerceState) {
  const state = structuredClone(checkpoint) as CommerceState; state.pages++;
  if (state.phase === "info") {
    const info = await catalogGraphql<any>(admin, `query SourceCommerce { shop { name myshopifyDomain shipsToCountries features { marketDrivenShipping } shopPolicies { id title body type url } } locations(first: 250) { nodes { id name isActive fulfillsOnlineOrders address { countryCode } } pageInfo { hasNextPage endCursor } } }`);
    if (info.shop?.myshopifyDomain !== shop) throw new Error("Source shop mismatch");
    if (info.shop.features.marketDrivenShipping) throw new Error("Market-driven shipping is not supported by legacy delivery profiles");
    if (!Array.isArray(info.shop.shopPolicies) || info.shop.shopPolicies.some((p: any) => !p.id) || !Array.isArray(info.locations?.nodes) || info.locations.pageInfo.hasNextPage) throw new Error("Policies or location list incomplete");
    state.snapshot = { sourceShop: shop, syncedAt: state.startedAt, shopName: info.shop.name, shippingCountries: info.shop.shipsToCountries, eligibleCountries: [], markets: [], profiles: [], locations: info.locations.nodes, policies: info.shop.shopPolicies, processingLabel: "" };
    state.phase = "markets"; return { state, done: false, effects: undefined };
  }
  const snapshot = state.snapshot; if (!snapshot || snapshot.sourceShop !== shop) throw new Error("Source checkpoint is invalid");
  if (state.phase === "markets") {
    const result = await catalogGraphql<any>(admin, `query SourceMarkets($after: String) { markets(first: 10, after: $after) { nodes { id name status conditions { regionsCondition { regions(first: 250) { nodes { ... on MarketRegionCountry { code name } } pageInfo { hasNextPage endCursor } } } } } pageInfo { hasNextPage endCursor } } } }`, { after: state.after });
    if (!Array.isArray(result.markets?.nodes) || result.markets.nodes.length > 10) throw new Error("Incomplete market response");
    for (const market of result.markets.nodes) { const regions = market.conditions?.regionsCondition?.regions; if (regions?.pageInfo.hasNextPage) throw new Error("Market region list incomplete"); snapshot.markets.push({ id: market.id, name: market.name, status: market.status, countries: (regions?.nodes ?? []).filter((r: any) => Boolean(r.code && r.name)) }); }
    if (!nextPage(state, result.markets.pageInfo)) { state.phase = "profiles"; state.after = null; state.recentCursors = []; }
    return { state, done: false, effects: undefined };
  }
  const result = await catalogGraphql<any>(admin, `query SourceDelivery($after: String) { deliveryProfiles(first: 5, after: $after) { nodes { id name default profileLocationGroups { locationGroupZones(first: 10) { nodes { zone { id name countries { code { countryCode restOfWorld } name provinces { code name } } } methodDefinitions(first: 20) { nodes { id name active description rateProvider { ... on DeliveryRateDefinition { price { amount currencyCode } } } methodConditions { field operator conditionCriteria { ... on MoneyV2 { amount currencyCode } ... on Weight { value unit } } } } pageInfo { hasNextPage endCursor } } } pageInfo { hasNextPage endCursor } } } } pageInfo { hasNextPage endCursor } } }`, { after: state.after });
  if (!Array.isArray(result.deliveryProfiles?.nodes) || result.deliveryProfiles.nodes.length > 5) throw new Error("Incomplete shipping response");
  for (const profile of result.deliveryProfiles.nodes) { const zones: any[] = []; for (const group of profile.profileLocationGroups) { if (group.locationGroupZones.pageInfo.hasNextPage) throw new Error("Shipping zones incomplete"); for (const item of group.locationGroupZones.nodes) { if (item.methodDefinitions.pageInfo.hasNextPage) throw new Error("Shipping methods incomplete"); zones.push({ zone: item.zone, methods: item.methodDefinitions.nodes }); } } snapshot.profiles.push({ id: profile.id, name: profile.name, default: profile.default, zones }); }
  const done = !nextPage(state, result.deliveryProfiles.pageInfo);
  if (done) { const countries = new Map(snapshot.markets.flatMap((m: any) => m.countries).map((c: any) => [c.code, c])); snapshot.eligibleCountries = snapshot.shippingCountries.map((c: string) => countries.get(c) ?? { code: c, name: c }).sort((a: any, b: any) => a.name.localeCompare(b.name)); const policy = snapshot.policies.find((p: any) => p.type === "SHIPPING_POLICY"); const processing = (policy?.body?.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ") ?? "").match(/processed within\s+(\d+\s*[–-]\s*\d+)\s+business days/i); snapshot.processingLabel = processing ? `Processing: ${processing[1]} business days. Delivery estimate and shipping charges at checkout.` : "Processing and delivery follow the shipping policy; final charges and estimates at checkout."; snapshot.syncedAt = new Date().toISOString(); }
  return { state, done, effects: undefined };
}

export async function processSourceCommercePage(admin: CatalogAdmin, shop: string) {
  if (shop !== getCatalogSourceShop()) throw new Error("Only the configured source can synchronize");
  const store = prismaJobStore(shop, "source-commerce", async (tx: Prisma.TransactionClient, _lease: any, step: any) => {
    if (!step.done || !step.state.snapshot) return;
    const snapshot = step.state.snapshot;
    await tx.runtimeSourceState.upsert({ where: { shop_kind: { shop, kind: "commerce" } }, create: { shop, kind: "commerce", payloadJson: JSON.stringify(snapshot) }, update: { payloadJson: JSON.stringify(snapshot) } });
    for (const policy of snapshot.policies) { const body = (policy.body ?? "").replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ").replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/\s+/g, " ").trim(); const record = { title: policy.title ?? policy.type ?? "Shop policy", body, bodyHash: createHash("sha256").update(JSON.stringify(body)).digest("hex"), metadataJson: JSON.stringify({ type: policy.type, url: policy.url, shopName: snapshot.shopName }), lastSyncedAt: new Date() }; await tx.knowledgeDocument.upsert({ where: { shop_domain_sourceKey: { shop, domain: "policy", sourceKey: policy.id } }, create: { shop, domain: "policy", sourceKey: policy.id, ...record }, update: record }); }
    await tx.knowledgeDocument.deleteMany({ where: { shop, domain: "policy", sourceKey: { notIn: snapshot.policies.map((p: any) => p.id) } } });
    await tx.runtimeSourceState.upsert({ where: { shop_kind: { shop, kind: "sync-state" } }, create: { shop, kind: "sync-state", payloadJson: JSON.stringify({ status: "COMPLETED", startedAt: step.state.startedAt, finishedAt: snapshot.syncedAt, message: "Synchronized markets, shipping and policies" }) }, update: { payloadJson: JSON.stringify({ status: "COMPLETED", startedAt: step.state.startedAt, finishedAt: snapshot.syncedAt, message: "Synchronized markets, shipping and policies" }) } });
  });
  return runDurableJobStep(store, async (lease) => { const step = await prepareCommerceStep(admin, shop, lease.state as CommerceState); if (JSON.stringify(step.state).length > 1e6) throw new Error("Shipping snapshot exceeds the bounded worker limit"); return step; });
}
