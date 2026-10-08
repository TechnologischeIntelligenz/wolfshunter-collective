import fs from "node:fs/promises";
import { catalogGraphql, type CatalogAdmin } from "./catalog-bulk.server.ts";
import { sourceDataPath, writeSourceData } from "./catalog-snapshot.server.ts";
import db from "../db.server.ts";

type Connection<T> = { nodes: T[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } };
export interface SourcePolicy { id: string; title: string; body: string; type: string; url: string }
export interface SourceMarket { id: string; name: string; status: string; countries: Array<{ code: string; name: string }> }
export interface ShippingZone {
  id: string; name: string; countries: Array<{ code: { countryCode: string | null; restOfWorld: boolean }; name: string; provinces: Array<{ code: string; name: string }> }>;
}
export interface ShippingMethod { id: string; name: string; active: boolean; description: string | null; rateProvider?: { price?: { amount: string; currencyCode: string } }; methodConditions?: unknown[] }
export interface ShippingProfile { id: string; name: string; default: boolean; zones: Array<{ zone: ShippingZone; methods: ShippingMethod[] }> }
export interface SourceCommerce {
  sourceShop: string; syncedAt: string; shopName: string;
  shippingCountries: string[]; eligibleCountries: Array<{ code: string; name: string }>;
  markets: SourceMarket[]; profiles: ShippingProfile[];
  locations: Array<{ id: string; name: string; isActive: boolean; fulfillsOnlineOrders: boolean; address: { countryCode: string } }>;
  policies: SourcePolicy[];
  processingLabel: string;
}

export async function syncSourceCommerce(admin: CatalogAdmin, sourceShop: string): Promise<SourceCommerce> {
  const info = await catalogGraphql<{ shop: { name: string; myshopifyDomain: string; shipsToCountries: string[]; features: { marketDrivenShipping: boolean }; shopPolicies: SourcePolicy[] }; locations: Connection<SourceCommerce["locations"][number]> }>(admin,
    `query SourceCommerce { shop { name myshopifyDomain shipsToCountries features { marketDrivenShipping } shopPolicies { id title body type url } } locations(first: 250) { nodes { id name isActive fulfillsOnlineOrders address { countryCode } } pageInfo { hasNextPage endCursor } } }`);
  if (info.shop.myshopifyDomain !== sourceShop) throw new Error("Source shop mismatch");
  if (info.shop.features.marketDrivenShipping) throw new Error("This shop uses market-driven shipping; legacy delivery profiles must not be imported");
  if (info.locations.pageInfo.hasNextPage) throw new Error("Location list incomplete");
  const markets: SourceMarket[] = [];
  let after: string | null = null;
  do {
    type MarketNode = { id: string; name: string; status: string; conditions: { regionsCondition: { regions: Connection<{ code?: string; name?: string }> } | null } };
    const result: { markets: Connection<MarketNode> } = await catalogGraphql(admin,
      `query SourceMarkets($after: String) { markets(first: 2, after: $after) { nodes { id name status conditions { regionsCondition { regions(first: 250) { nodes { ... on MarketRegionCountry { code name } } pageInfo { hasNextPage endCursor } } } } } pageInfo { hasNextPage endCursor } } }`, { after });
    for (const market of result.markets.nodes) {
      const regions = market.conditions.regionsCondition?.regions;
      if (regions?.pageInfo.hasNextPage) throw new Error("Market region list incomplete");
      markets.push({ id: market.id, name: market.name, status: market.status, countries: (regions?.nodes ?? []).filter((r): r is { code: string; name: string } => Boolean(r.code && r.name)) });
    }
    if (!result.markets.pageInfo.hasNextPage) break;
    if (!result.markets.pageInfo.endCursor || result.markets.pageInfo.endCursor === after) throw new Error("Market pagination stalled");
    after = result.markets.pageInfo.endCursor;
  } while (after);
  const profiles: ShippingProfile[] = [];
  after = null;
  do {
    type RawProfile = { id: string; name: string; default: boolean; profileLocationGroups: Array<{ locationGroupZones: Connection<{ zone: ShippingZone; methodDefinitions: Connection<ShippingMethod> }> }> };
    const result: { deliveryProfiles: Connection<RawProfile> } = await catalogGraphql(admin,
      `query SourceDelivery($after: String) { deliveryProfiles(first: 1, after: $after) { nodes { id name default profileLocationGroups { locationGroupZones(first: 10) { nodes { zone { id name countries { code { countryCode restOfWorld } name provinces { code name } } } methodDefinitions(first: 20) { nodes { id name active description rateProvider { ... on DeliveryRateDefinition { price { amount currencyCode } } } methodConditions { field operator conditionCriteria { ... on MoneyV2 { amount currencyCode } ... on Weight { value unit } } } } pageInfo { hasNextPage endCursor } } } pageInfo { hasNextPage endCursor } } } } pageInfo { hasNextPage endCursor } } }`, { after });
    for (const profile of result.deliveryProfiles.nodes) {
      const zones: ShippingProfile["zones"] = [];
      for (const group of profile.profileLocationGroups) {
        if (group.locationGroupZones.pageInfo.hasNextPage) throw new Error("Shipping zones incomplete");
        for (const item of group.locationGroupZones.nodes) {
          if (item.methodDefinitions.pageInfo.hasNextPage) throw new Error("Shipping methods incomplete");
          zones.push({ zone: item.zone, methods: item.methodDefinitions.nodes });
        }
      }
      profiles.push({ id: profile.id, name: profile.name, default: profile.default, zones });
    }
    if (!result.deliveryProfiles.pageInfo.hasNextPage) break;
    if (!result.deliveryProfiles.pageInfo.endCursor || result.deliveryProfiles.pageInfo.endCursor === after) throw new Error("Profile pagination stalled");
    after = result.deliveryProfiles.pageInfo.endCursor;
  } while (after);
  const activeCountries = new Map(markets.filter(m => m.status === "ACTIVE").flatMap(m => m.countries).map(c => [c.code, c]));
  const shippingPolicy = info.shop.shopPolicies.find(p => p.type === "SHIPPING_POLICY");
  const plain = shippingPolicy?.body.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ") ?? "";
  const processing = plain.match(/processed within\s+(\d+\s*[–-]\s*\d+)\s+business days/i);
  const snapshot: SourceCommerce = {
    sourceShop, syncedAt: new Date().toISOString(), shopName: info.shop.name,
    shippingCountries: info.shop.shipsToCountries,
    eligibleCountries: info.shop.shipsToCountries.filter(c => activeCountries.has(c)).map(c => activeCountries.get(c)!).sort((a,b) => a.name.localeCompare(b.name)),
    markets, profiles, locations: info.locations.nodes, policies: info.shop.shopPolicies,
    processingLabel: processing ? `Processing: ${processing[1]} business days. Delivery estimate and shipping charges at checkout.` : "Processing and delivery follow the shipping policy; final charges and estimates at checkout.",
  };
  await writeSourceData(sourceShop, "commerce.json", snapshot);
  return snapshot;
}

export async function readSourceCommerce(shop: string): Promise<SourceCommerce | null> {
  // Cloudflare Workers have no writable project filesystem. The durable
  // database snapshot is authoritative; the file is only a local-dev reserve.
  const runtimeState = await db.runtimeSourceState.findUnique({
    where: { shop_kind: { shop, kind: "commerce" } },
    select: { payloadJson: true },
  });
  if (runtimeState) {
    try {
      const value = JSON.parse(runtimeState.payloadJson) as SourceCommerce;
      if (value.sourceShop === shop) return value;
    } catch {
      // Fall through to the local development snapshot.
    }
  }

  try {
    const value = JSON.parse(await fs.readFile(sourceDataPath(shop, "commerce.json"), "utf8")) as SourceCommerce;
    return value.sourceShop === shop ? value : null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  return null;
}

