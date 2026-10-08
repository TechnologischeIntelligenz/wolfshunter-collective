import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { RetailerSettingsView } from "../features/settings/retailer-settings-view";
import { requireRetailerSession } from "../services/app-role.server";
import { authenticate } from "../shopify.server";
import { getCatalogSourceShop } from "../services/app-admin.server";
import { getRetailerSettings, updateRetailerSettings } from "../services/retailer-commerce.server";
import { readSourceCommerce } from "../services/source-commerce.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  requireRetailerSession(session);
  const sourceShop = getCatalogSourceShop();
  const [settings, sourceCommerce] = await Promise.all([
    getRetailerSettings(session.shop),
    sourceShop ? readSourceCommerce(sourceShop) : Promise.resolve(null),
  ]);
  return { shop: session.shop, settings, sourceCommerce };
}

export async function action({ request }: { request: Request }) {
  const { session } = await authenticate.admin(request);
  requireRetailerSession(session);
  const formData = await request.formData();
  const marketCountry = String(formData.get("marketCountry") ?? "").trim().toUpperCase();
  const warehouse = String(formData.get("warehouse") ?? "").trim();
  const marginPercent = Number(formData.get("marginPercent"));
  const requireApproval = formData.get("requireApproval") === "on";

  if (
    marketCountry.length !== 2 ||
    warehouse.length < 2 ||
    !Number.isFinite(marginPercent) ||
    marginPercent < 0 ||
    marginPercent > 100
  ) {
    return Response.json({ ok: false, error: "Please check the market, warehouse, and margin." }, { status: 400 });
  }

  try {
    const settings = await updateRetailerSettings(session.shop, {
      marketCountry,
      warehouse,
      marginPercent,
      requireApproval,
    });
    return Response.json({ ok: true, settings });
  } catch {
    return Response.json({ ok: false, error: "The retailer settings could not be saved." }, { status: 400 });
  }
}

export default function SettingsRoute() {
  const loaderData = useLoaderData<typeof loader>();

  return <RetailerSettingsView commerce={loaderData.sourceCommerce} shop={loaderData.shop} settings={loaderData.settings} />;
}
