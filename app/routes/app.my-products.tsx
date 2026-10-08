import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { MyProductsView } from "../features/products/my-products-view";
import { authenticatedRetailerLoader } from "../services/authenticated-app-loader.server";
import { getImportedProductPushes } from "../services/retailer-commerce.server";

export async function loader(args: LoaderFunctionArgs) {
  const data = await authenticatedRetailerLoader(args);
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
  return { ...data, pushes };
}

export default function MyProductsRoute() {
  const loaderData = useLoaderData<typeof loader>();
  return <MyProductsView shop={loaderData.shop} pushes={loaderData.pushes} />;
}
