import assert from "node:assert/strict";
import test from "node:test";

import {
  canViewSupplierSku,
  projectSupplierVariantForViewer,
} from "./supplier-sku-visibility.ts";

const variant = {
  id: "variant_1",
  title: "Black / Medium",
  supplierShop: "supplier-one.myshopify.com",
  supplierSku: "SUPPLIER-SECRET-001",
};

test("retailers never receive supplier SKU or supplier identity", () => {
  const projected = projectSupplierVariantForViewer(variant, {
    role: "retailer",
    shop: "retailer.myshopify.com",
  });

  assert.equal("supplierSku" in projected, false);
  assert.equal("supplierShop" in projected, false);
});

test("supplier sees only its own SKU", () => {
  assert.equal(
    canViewSupplierSku(
      { role: "supplier", shop: "SUPPLIER-ONE.myshopify.com" },
      variant.supplierShop,
    ),
    true,
  );
  assert.equal(
    canViewSupplierSku(
      { role: "supplier", shop: "supplier-two.myshopify.com" },
      variant.supplierShop,
    ),
    false,
  );

  const projected = projectSupplierVariantForViewer(variant, {
    role: "supplier",
    shop: "supplier-two.myshopify.com",
  });
  assert.equal("supplierSku" in projected, false);
});

test("admin can inspect the internal supplier mapping", () => {
  const projected = projectSupplierVariantForViewer(variant, {
    role: "admin",
    shop: "worldshoponlinestore.myshopify.com",
  });

  assert.equal(projected.supplierSku, variant.supplierSku);
  assert.equal(projected.supplierShop, variant.supplierShop);
});
