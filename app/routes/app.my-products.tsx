import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { MyProductsView } from "../features/products/my-products-view";
import { authenticatedRetailerLoader } from "../services/authenticated-app-loader.server";
import { getImportedProductPushes } from "../services/retailer-commerce.server";
import { authenticate } from "../shopify.server";
import { requireRetailerSession } from "../services/app-role.server";

export async function loader(args: LoaderFunctionArgs) {
  const data = await authenticatedRetailerLoader(args);
  const { admin } = await authenticate.admin(args.request);
  let publications: { id: string; name: string; supportsFuturePublishing: boolean }[] = [];
  try {
    const response = await admin.graphql(`query RetailerPublications { publications(first: 20) { nodes { id name supportsFuturePublishing } } }`);
    const payload: any = await response.json();
    publications = payload.data?.publications?.nodes ?? [];
  } catch {
    publications = [];
  }
  const catalogById = new Map(data.catalog.map((product) => [product.id, product]));
  const pushes = (await getImportedProductPushes(data.shop)).map((push) => {
    const catalogProduct = catalogById.get(push.sourceProductId);
    return {
      ...push,
      imageUrl: catalogProduct?.imageUrl ?? null,
      imageCount: catalogProduct?.imageCount ?? 0,
      variantImageUrls: catalogProduct?.variantImageUrls ?? [],
    };
  });
  return { ...data, pushes, publications };
}

export async function action({ request }: ActionFunctionArgs) {
  const { admin, session } = await authenticate.admin(request);
  requireRetailerSession(session);
  const form = await request.formData();
  if (form.get("intent") !== "publish") return Response.json({ ok: false, error: "Unknown action." }, { status: 400 });
  const productId = form.get("productId");
  const publicationId = form.get("publicationId");
  if (typeof productId !== "string" || !/^gid:\/\/shopify\/Product\/\d+$/.test(productId) || typeof publicationId !== "string" || !/^gid:\/\/shopify\/Publication\/\d+$/.test(publicationId)) {
    return Response.json({ ok: false, error: "A valid Collective product and publication are required." }, { status: 400 });
  }
  const push = await getImportedProductPushes(session.shop);
  if (!push.some((item) => item.shopifyProductId === productId && item.status === "DRAFT_CREATED")) {
    return Response.json({ ok: false, error: "Only an imported Collective DRAFT can be published." }, { status: 403 });
  }
  try {
    const response = await admin.graphql(`mutation PublishCollectiveProduct($id: ID!, $input: [PublicationInput!]!) { publishablePublish(id: $id, input: $input) { userErrors { field message } } }`, { variables: { id: productId, input: [{ publicationId }] } });
    const payload: any = await response.json();
    const errors = payload.data?.publishablePublish?.userErrors ?? payload.errors ?? [];
    if (errors.length) return Response.json({ ok: false, error: errors.map((error: { message?: string }) => error.message ?? "Shopify rejected publication.").join("; ").slice(0, 300) }, { status: 400 });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message.slice(0, 300) : "Publication failed." }, { status: 400 });
  }
}

export default function MyProductsRoute() {
  const loaderData = useLoaderData<typeof loader>();
  return <MyProductsView shop={loaderData.shop} pushes={loaderData.pushes} publications={loaderData.publications} />;
}
