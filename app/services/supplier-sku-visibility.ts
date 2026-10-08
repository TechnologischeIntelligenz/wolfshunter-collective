export type SkuViewerRole = "admin" | "supplier" | "retailer";

export interface SkuViewer {
  role: SkuViewerRole;
  shop: string;
}

export interface SupplierScopedVariant {
  supplierShop: string;
  supplierSku: string | null;
  [key: string]: unknown;
}

type RedactedSupplierVariant<T extends SupplierScopedVariant> = Omit<
  T,
  "supplierShop" | "supplierSku"
>;

const normalizeShop = (shop: string) => shop.trim().toLowerCase();

export function canViewSupplierSku(
  viewer: SkuViewer,
  supplierShop: string,
) {
  if (viewer.role === "admin") return true;
  if (viewer.role !== "supplier") return false;

  return normalizeShop(viewer.shop) === normalizeShop(supplierShop);
}

/**
 * Defense-in-depth projection for API/loader responses. Retailers and other
 * suppliers receive neither the supplier SKU nor the supplier shop identifier.
 * Database queries must still be tenant-scoped before this projection is used.
 */
export function projectSupplierVariantForViewer<T extends SupplierScopedVariant>(
  record: T,
  viewer: SkuViewer & { role: "admin" },
): T;
export function projectSupplierVariantForViewer<T extends SupplierScopedVariant>(
  record: T,
  viewer: SkuViewer & { role: "retailer" },
): RedactedSupplierVariant<T>;
export function projectSupplierVariantForViewer<T extends SupplierScopedVariant>(
  record: T,
  viewer: SkuViewer,
): T | RedactedSupplierVariant<T>;
export function projectSupplierVariantForViewer<T extends SupplierScopedVariant>(
  record: T,
  viewer: SkuViewer,
): T | RedactedSupplierVariant<T> {
  const { supplierShop, supplierSku, ...safeRecord } = record;

  if (!canViewSupplierSku(viewer, supplierShop)) {
    return safeRecord;
  }

  return { ...safeRecord, supplierShop, supplierSku } as T;
}
