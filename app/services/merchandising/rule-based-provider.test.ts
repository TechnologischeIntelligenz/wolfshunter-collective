import assert from "node:assert/strict";
import test from "node:test";

import { createPhaseOneFixtureState } from "./fixtures.ts";
import {
  RuleBasedRecommendationProvider,
  scoreMerchantProduct,
} from "./rule-based-provider.ts";

test("rule-based recommendations are deterministic", () => {
  const fixture = createPhaseOneFixtureState();
  const provider = new RuleBasedRecommendationProvider();
  const request = {
    tenant: fixture.tenant,
    products: fixture.catalog,
    affinity: fixture.affinity,
    sort: "RECOMMENDED" as const,
  };

  assert.deepEqual(provider.recommend(request), provider.recommend(request));
});

test("every result remains scoped to the requesting tenant", () => {
  const fixture = createPhaseOneFixtureState();
  const provider = new RuleBasedRecommendationProvider();
  const result = provider.recommend({
    tenant: fixture.tenant,
    products: fixture.catalog,
    affinity: fixture.affinity,
    sort: "RECOMMENDED",
  });

  assert.ok(result.products.length > 0);
  assert.ok(
    result.products.every(
      ({ product, score }) =>
        product.tenantId === fixture.tenant.tenantId &&
        score.tenantId === fixture.tenant.tenantId,
    ),
  );
});

test("tenant mismatch fails closed", () => {
  const fixture = createPhaseOneFixtureState();
  const foreignProduct = { ...fixture.catalog[0]!, tenantId: "tenant_foreign" };

  assert.throws(
    () => scoreMerchantProduct(fixture.tenant, foreignProduct, fixture.affinity),
    /Tenant mismatch/,
  );
});

test("margin is derived from prices rather than fixture labels", () => {
  const fixture = createPhaseOneFixtureState();
  const product = fixture.catalog[0]!;
  const score = scoreMerchantProduct(fixture.tenant, product, fixture.affinity);

  assert.equal(
    score.grossMarginAmount,
    product.recommendedRetailPrice - product.wholesalePrice,
  );
  assert.ok(score.grossMarginPercent > 0);
});

test("new arrivals include only products created in the last 30 days", () => {
  const fixture = createPhaseOneFixtureState();
  const provider = new RuleBasedRecommendationProvider();
  const result = provider.recommend({
    tenant: fixture.tenant,
    products: fixture.catalog,
    affinity: fixture.affinity,
    bucket: "NEW_ARRIVALS",
    sort: "NEWEST",
  });

  assert.ok(result.products.length > 0);
  assert.ok(
    result.products.every(({ product }) => {
      const age =
        new Date(fixture.tenant.asOf).getTime() -
        new Date(product.createdAt).getTime();
      return age >= 0 && age <= 30 * 86_400_000;
    }),
  );
});

test("highest-margin sort is monotonic", () => {
  const fixture = createPhaseOneFixtureState();
  const provider = new RuleBasedRecommendationProvider();
  const result = provider.recommend({
    tenant: fixture.tenant,
    products: fixture.catalog,
    affinity: fixture.affinity,
    sort: "HIGHEST_MARGIN",
  });

  const margins = result.products.map(({ score }) => score.grossMarginPercent);
  assert.deepEqual(margins, [...margins].sort((left, right) => right - left));
});

test("premium selection never labels standard products as premium", () => {
  const fixture = createPhaseOneFixtureState();
  const provider = new RuleBasedRecommendationProvider();
  const result = provider.recommend({
    tenant: fixture.tenant,
    products: fixture.catalog,
    affinity: fixture.affinity,
    bucket: "PREMIUM_SELECTION",
    sort: "RECOMMENDED",
  });

  assert.ok(
    result.products.every(({ product }) => product.selection !== "standard"),
  );
});

test("provider returns the rule-based provider identity", () => {
  const fixture = createPhaseOneFixtureState();
  const provider = new RuleBasedRecommendationProvider();
  const result = provider.recommend({
    tenant: fixture.tenant,
    products: fixture.catalog,
    affinity: fixture.affinity,
    sort: "RECOMMENDED",
  });

  assert.equal(result.provider, "RULE_BASED");
});
