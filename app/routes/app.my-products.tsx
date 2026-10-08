import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { MyProductsView } from "../features/products/my-products-view";
import { authenticatedRetailerLoader } from "../services/authenticated-app-loader.server";
import { getImportedProductPushes } from "../services/retailer-commerce.server";

export async function loader(args: LoaderFunctionArgs) {
  const data = await authenticatedRetailerLoader(args);
  return { ...data, pushes: await getImportedProductPushes(data.shop) };
}

export default function MyProductsRoute() {
  const loaderData = useLoaderData<typeof loader>();
  return <MyProductsView shop={loaderData.shop} pushes={loaderData.pushes} />;
}
