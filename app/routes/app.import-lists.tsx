import { CatalogPagination } from "../components/collective/catalog-pagination";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { ImportListsView } from "../features/import-lists/import-lists-view";
import { authenticatedRetailerLoader } from "../services/authenticated-app-loader.server";
import { authenticate } from "../shopify.server";
import { requireRetailerSession } from "../services/app-role.server";
import {
  getImportedProductPush,
  getImportedProductPushes,
  getRetailerSettings,
  markImportedProductDraftCreated,
  markImportedProductPushFailed,
  markImportedProductPushing,
} from "../services/retailer-commerce.server";
import {
  getRetailerWorkspace,
  updateRetailerWorkspace,
} from "../services/retailer-workspace.server";
import { getRetailerCatalogSnapshot } from "../services/shopify-source-catalog.server";
import { getCatalogSourceShop } from "../services/app-admin.server";
import { createImportedProductDraft, readImportVariantPlan } from "../../_recovery/live-import-runtime.mjs";
import type { CatalogProduct } from "../services/merchandising/types";

export async function loader(args: LoaderFunctionArgs) {
  const data = await authenticatedRetailerLoader(args, { includeCollections: true });
  const pushes = await getImportedProductPushes(data.shop);
  const importedProducts = data.catalog.filter((product) =>
    data.importedProductIds.includes(product.id),
  );

  return { ...data, importedProducts, pushes };
}

type UserError = { field?: string[] | null; message: string };

type GraphqlError = {
  message?: string;
  extensions?: { code?: string } | null;
};

type GraphqlPayload<T> = {
  data?: T;
  errors?: GraphqlError[];
};

class ShopifyGraphqlError extends Error {
  constructor(
    message: string,
    readonly operation: string,
    readonly httpStatus?: number,
  ) {
    super(message);
    this.name = "ShopifyGraphqlError";
  }
}

const summarizeErrors = (errors: UserError[]) =>
  errors.map((error) => error.message).filter(Boolean).join("; ") ||
  "Shopify rejected the product creation request.";

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ] ?? character,
  );

const safeErrorDetail = (error: unknown) => {
  const raw = error instanceof Error ? error.message : String(error);
  const detail = raw.replace(/\s+/g, " ").trim();
  if (!detail || detail === "[object Object]") return "Unknown Shopify error";
  return detail.slice(0, 240);
};

const graphQLErrorDetail = (errors: GraphqlError[] | undefined) =>
  (errors ?? [])
    .map((error) => {
      const code = error.extensions?.code;
      return code
        ? `${error.message ?? "GraphQL error"} (${code})`
        : error.message;
    })
    .filter(Boolean)
    .join("; ");

async function maybeAutoPublish(
  admin: { graphql: (query: string, options?: { variables?: Record<string, unknown> }) => Promise<Response> },
  response: Response,
) {
  if (process.env.AUTO_PUBLISH_IMPORTED_PRODUCTS !== "true") return response;
  const publicationId = process.env.AUTO_PUBLISH_PUBLICATION_ID?.trim() ?? "";
  if (!/^gid:\/\/shopify\/Publication\/\d+$/.test(publicationId)) return response;
  const payload = await response.clone().json().catch(() => null) as { ok?: boolean; push?: { shopifyProductId?: string; status?: string } } | null;
  const productId = payload?.push?.shopifyProductId;
  if (!payload?.ok || payload.push?.status !== "DRAFT_CREATED" || !productId) return response;
  const activate = await admin.graphql(
    `mutation ActivateCollectiveProduct($product: ProductUpdateInput!) { productUpdate(product: $product) { product { id status } userErrors { message } } }`,
    { variables: { product: { id: productId, status: "ACTIVE" } } },
  );
  const activatePayload: any = await activate.json();
  if (activatePayload.data?.productUpdate?.userErrors?.length) return response;
  const publish = await admin.graphql(
    `mutation PublishCollectiveProduct($id: ID!, $input: [PublicationInput!]!) { publishablePublish(id: $id, input: $input) { userErrors { message } } }`,
    { variables: { id: productId, input: [{ publicationId }] } },
  );
  const publishPayload: any = await publish.json();
  if (publishPayload.data?.publishablePublish?.userErrors?.length || publishPayload.errors?.length) return response;
  return Response.json({ ...payload, autoPublished: true });
}

const collectiveImportReviewNoticeHtml = (product: CatalogProduct) =>
  `<p>Imported as an unpublished WOLFSHUNTER COLLECTIVE DRAFT. Source category: ${escapeHtml(product.category)}. Review product copy, variants, media, pricing, size charts, shipping claims, and legal claims before publication.</p>`;

export function buildCollectiveDescriptionHtml(product: CatalogProduct) {
  const sourceDescription = product.descriptionHtml?.trim();
  const notice = collectiveImportReviewNoticeHtml(product);
  if (sourceDescription) return `${sourceDescription}<hr>${notice}`;

  return `<p>Curated through WOLFSHUNTER COLLECTIVE. Category: ${escapeHtml(product.category)}.</p>${notice}`;
}

export function buildCollectiveMedia(product: CatalogProduct) {
  const seen = new Set<string>();
  return [...product.imageUrls, product.imageUrl, ...product.variantImageUrls]
    .filter((url): url is string => Boolean(url?.trim()))
    .map((url) => url.trim())
    .filter((url) => {
      if (!/^https?:\/\//i.test(url) || seen.has(url)) return false;
      seen.add(url);
      return true;
    })
    .slice(0, 10)
    .map((url, index) => ({
      originalSource: url,
      alt: index === 0 ? product.title : `${product.title} image ${index + 1}`,
      mediaContentType: "IMAGE" as const,
    }));
}

export function buildCollectiveImportHandle(productId: string) {
  const sourceId = productId.split("/").pop() ?? productId;
  const safeId = sourceId
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180);
  return `wolfshunter-collective-${safeId || "product"}`;
}

async function readShopifyData<T>(
  response: Response,
  operation: string,
): Promise<T> {
  let payload: GraphqlPayload<T>;
  try {
    payload = (await response.json()) as GraphqlPayload<T>;
  } catch {
    throw new ShopifyGraphqlError(
      `Shopify ${operation} returned no readable response.`,
      operation,
      response.status,
    );
  }

  const topLevelErrors = graphQLErrorDetail(payload.errors);
  if (!response.ok || topLevelErrors) {
    throw new ShopifyGraphqlError(
      topLevelErrors ||
        `Shopify ${operation} antwortete mit HTTP ${response.status}.`,
      operation,
      response.status,
    );
  }

  if (!payload.data) {
    throw new ShopifyGraphqlError(
      `Shopify ${operation} returned no data.`,
      operation,
      response.status,
    );
  }

  return payload.data;
}

export async function action({ request }: ActionFunctionArgs) {
  const { admin, session } = await authenticate.admin(request);
  requireRetailerSession(session);
  const formData = await request.formData();
  const intent = formData.get("intent");
  const productId = formData.get("productId");
  const collectionId = formData.get("collectionId");

  if (typeof productId !== "string") {
    return Response.json({ ok: false, error: "No product selected." }, { status: 400 });
  }

  if (intent === "favorite" || intent === "import") {
    const settings = await getRetailerSettings(session.shop);
    const catalogSnapshot = await getRetailerCatalogSnapshot(session.shop, settings);
    try {
      const workspace = await updateRetailerWorkspace(session.shop, {
        intent,
        productId,
        selected: formData.get("selected") === "true",
        allowedProductIds: catalogSnapshot.catalog.map((product) => product.id),
      });
      return Response.json(workspace);
    } catch {
      return Response.json(
        { ok: false, error: "The merchant selection could not be saved." },
        { status: 400 },
      );
    }
  }

  if (intent !== "push-product") {
    return Response.json({ ok: false, error: "Unknown import action." }, { status: 400 });
  }

  const settings = await getRetailerSettings(session.shop);
  const catalogSnapshot = await getRetailerCatalogSnapshot(session.shop, settings);
  const product = catalogSnapshot.catalog.find((candidate) => candidate.id === productId);
  const workspace = await getRetailerWorkspace(session.shop);

  if (!product || !workspace.importedProductIds.includes(productId)) {
    return Response.json(
      {
        ok: false,
        error: "The product must be confirmed in the import list first.",
      },
      { status: 400 },
    );
  }

  if (workspace.importedProductIds.length >= 99) {
    return Response.json({ ok: false, error: "The 99-product trial limit has been reached. Please upgrade to continue importing products." }, { status: 403 });
  }

  const sourceShop = getCatalogSourceShop();
  if (sourceShop) {
    try {
      const variantPlan = await readImportVariantPlan(
        admin,
        sourceShop,
        product,
        settings.marginPercent,
      );
      const draftResponse = await createImportedProductDraft(
        admin,
        session.shop,
        product,
        typeof collectionId === "string" && collectionId ? collectionId : null,
        variantPlan,
      );
      return await maybeAutoPublish(admin, draftResponse);
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 300) : "The source variants could not be verified.";
      return Response.json({ ok: false, error: message }, { status: 400 });
    }
  }

  // Enforce 99-product trial limit
  if (workspace.importedProductIds.length >= 99) {
    return Response.json(
      {
        ok: false,
        error: "The 99-product trial limit has been reached. Please upgrade to continue importing products.",
      },
      { status: 403 },
    );
  }

  const existing = await getImportedProductPush(session.shop, productId);
  if (existing?.status === "DRAFT_CREATED" && existing.shopifyProductId) {
    return Response.json({ ok: true, alreadyExists: true, push: existing });
  }
  if (existing?.status === "PUSHING") {
    return Response.json(
      { ok: false, error: "This product is already being processed." },
      { status: 409 },
    );
  }

  await markImportedProductPushing(session.shop, product);

  // A deterministic handle makes retries recover an existing DRAFT instead
  // of creating a duplicate after a timeout or interrupted response.
  const handle = buildCollectiveImportHandle(product.id);
  const productInput = {
    title: product.title,
    handle,
    descriptionHtml: buildCollectiveDescriptionHtml(product),
    productType: product.category,
    vendor: "WOLFSHUNTER COLLECTIVE",
    status: "DRAFT",
    tags: ["wolfshunter-collective", "collective-import"],
    ...(typeof collectionId === "string" && collectionId
      ? { collectionsToJoin: [collectionId] }
      : {}),
  };

  try {
    const existingResponse = await admin.graphql(
      `#graphql
      query ExistingCollectiveProduct($handle: String!) {
        productByHandle(handle: $handle) {
          id
          title
          status
          variants(first: 1) {
            nodes { id }
          }
        }
      }`,
      { variables: { handle } },
    );
    const existingData = await readShopifyData<{
      productByHandle?: {
        id: string;
        title: string;
        status: string;
        variants?: { nodes?: Array<{ id: string }> };
      } | null;
    }>(existingResponse, "Product check");
    const existingProduct = existingData.productByHandle;

    if (existingProduct && existingProduct.status !== "DRAFT") {
      const message =
        `A Shopify product with the safe import handle already exists (${existingProduct.status}) and will not be changed.`;
      await markImportedProductPushFailed(session.shop, productId, message);
      return Response.json({ ok: false, error: message }, { status: 409 });
    }

    let shopifyProductId = existingProduct?.id ?? null;
    let shopifyVariantId = existingProduct?.variants?.nodes?.[0]?.id ?? null;
    let draftWarning: string | null = null;

    if (!shopifyProductId) {
      const media = buildCollectiveMedia(product);
      const createResponse = await admin.graphql(
        `#graphql
        mutation CreateCollectiveProduct($product: ProductCreateInput!, $media: [CreateMediaInput!]) {
          productCreate(product: $product, media: $media) {
            product {
              id
              title
              variants(first: 1) {
                nodes { id }
              }
            }
            userErrors { field message }
          }
        }`,
        { variables: { product: productInput, media: media.length ? media : undefined } },
      );
      const createData = await readShopifyData<{
        productCreate?: {
          product?: {
            id: string;
            title: string;
            variants?: { nodes?: Array<{ id: string }> };
          } | null;
          userErrors?: UserError[];
        };
      }>(createResponse, "DRAFT creation");
      const createResult = createData.productCreate;
      const createErrors = createResult?.userErrors ?? [];

      if (createErrors.length || !createResult?.product?.id) {
        const message = summarizeErrors(createErrors);
        await markImportedProductPushFailed(session.shop, productId, message);
        return Response.json({ ok: false, error: message }, { status: 400 });
      }

      shopifyProductId = createResult.product.id;
      shopifyVariantId = createResult.product.variants?.nodes?.[0]?.id ?? null;
    }

    if (!shopifyProductId) {
      throw new ShopifyGraphqlError(
        "Shopify did not return a product ID for the draft.",
        "DRAFT creation",
      );
    }

    if (!shopifyVariantId) {
      draftWarning =
        "The Shopify DRAFT was created, but its initial variant is not readable yet; check the price in Shopify Admin.";
    }

    if (shopifyVariantId) {
      try {
        // Supplier SKUs are intentionally not copied into the retailer's
        // Shopify product. Order routing uses the stored Shopify variant ID and
        // a server-side supplier mapping instead.
        const priceResponse = await admin.graphql(
          `#graphql
          mutation PriceCollectiveProduct($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
            productVariantsBulkUpdate(productId: $productId, variants: $variants) {
              productVariants { id price }
              userErrors { field message }
            }
          }`,
          {
            variables: {
              productId: shopifyProductId,
              variants: [
                {
                  id: shopifyVariantId,
                  price: product.recommendedRetailPrice.toFixed(2),
                },
              ],
            },
          },
        );
        const priceData = await readShopifyData<{
          productVariantsBulkUpdate?: { userErrors?: UserError[] };
        }>(priceResponse, "Price update");
        const priceErrors = priceData.productVariantsBulkUpdate?.userErrors ?? [];

        if (priceErrors.length) {
          draftWarning =
            `DRAFT created, but the price could not be set yet: ${summarizeErrors(priceErrors)}`;
        }
      } catch (error) {
        console.error("[import-list] Shopify price update failed", {
          operation:
            error instanceof ShopifyGraphqlError
              ? error.operation
              : "Price update",
          status:
            error instanceof ShopifyGraphqlError
              ? error.httpStatus ?? null
              : null,
          message: safeErrorDetail(error),
        });
        draftWarning =
          `DRAFT created, but the price could not be confirmed yet: ${safeErrorDetail(error)}`;
      }
    }

    const push = await markImportedProductDraftCreated(
      session.shop,
      productId,
      shopifyProductId,
      shopifyVariantId,
      draftWarning,
    );

    return Response.json({
      ok: true,
      push,
      ...(draftWarning ? { warning: draftWarning } : {}),
    });
  } catch (error) {
    console.error("[import-list] Shopify draft action failed", {
      operation:
        error instanceof ShopifyGraphqlError ? error.operation : "DRAFT creation",
      status:
        error instanceof ShopifyGraphqlError ? error.httpStatus ?? null : null,
      message: safeErrorDetail(error),
    });
    const message = `Shopify could not create the DRAFT: ${safeErrorDetail(error)}`;
    await markImportedProductPushFailed(session.shop, productId, message);
    return Response.json({ ok: false, error: message }, { status: 502 });
  }
}

export default function ImportListsRoute() {
  const loaderData = useLoaderData<typeof loader>();

  return (
    <>
    <CatalogPagination page={loaderData.catalogPage} />
    <ImportListsView
      stagedProducts={loaderData.importedProducts}
      pushes={loaderData.pushes}
      collections={loaderData.collections}
    />
    <CatalogPagination page={loaderData.catalogPage} />
    </>
  );
}
