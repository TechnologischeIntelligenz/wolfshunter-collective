import { useLoaderData } from "react-router";
import { RetailerSettingsView } from "../features/settings/retailer-settings-view";
import {
  authenticatedRetailerLoader,
  type AuthenticatedAppLoaderData,
} from "../services/authenticated-app-loader.server";
import { requireRetailerSession } from "../services/app-role.server";
import { authenticate } from "../shopify.server";
import { updateRetailerSettings } from "../services/retailer-commerce.server";

export { authenticatedRetailerLoader as loader };

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
    return Response.json({ ok: false, error: "Bitte prüfe Markt, Lager und Marge." }, { status: 400 });
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
    return Response.json({ ok: false, error: "Die Händler-Einstellungen konnten nicht gespeichert werden." }, { status: 400 });
  }
}

export default function SettingsRoute() {
  const loaderData = useLoaderData<AuthenticatedAppLoaderData>();

  return <RetailerSettingsView commerce={loaderData.sourceCommerce} shop={loaderData.shop} settings={loaderData.retailerSettings} />;
}
