import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { AdminDashboardView } from "../features/admin/admin-dashboard-view";
import { authenticatedAppLoader } from "../services/authenticated-app-loader.server";
import { isAppAdminSession } from "../services/app-admin.server";
import { authenticate } from "../shopify.server";

export async function loader(args: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(args.request);
  if (!isAppAdminSession(session)) throw new Response("Forbidden", { status: 403 });
  return authenticatedAppLoader(args);
}

export default function CatalogRoute() {
  const data = useLoaderData<typeof loader>();
  return <AdminDashboardView {...data} />;
}
