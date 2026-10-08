import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect, useLoaderData } from "react-router";

import { AiOperationsBrief } from "../features/dashboard/ai-operations-brief";
import { RetailerDashboardView } from "../features/dashboard/retailer-dashboard-view";
import { ReadOnlyDiagnosticsPanel } from "../features/dashboard/read-only-diagnostics";
import { authenticatedAppLoader } from "../services/authenticated-app-loader.server";
import { isAppAdminSession } from "../services/app-admin.server";
import { startSourceSync } from "../services/source-sync.server";
import { askCollectiveAssistant } from "../services/openai-assistant.server";

import { authenticate } from "../shopify.server";
import { SupplierDashboardView } from "../features/supplier/supplier-dashboard-view";
import { AdminDashboardView } from "../features/admin/admin-dashboard-view";

export async function loader(args: LoaderFunctionArgs) {
  const url = new URL(args.request.url);
  const hasSessionToken =
    url.searchParams.has("id_token") || args.request.headers.has("authorization");
  const shop = url.searchParams.get("shop");

  if (shop && !hasSessionToken) {
    throw redirect(`/auth/login?shop=${encodeURIComponent(shop)}`);
  }

  return authenticatedAppLoader(args);
}

export async function action({ request }: ActionFunctionArgs) {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  if (formData.get("intent") === "sync-knowledge") {
    if (!isAppAdminSession(session)) {
      return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    try {
      await startSourceSync(admin, session.shop);
      return Response.json({ ok: true, status: "RUNNING" });
    } catch (error) {
      console.error("[dashboard-sync] knowledge sync failed", {
        name: error instanceof Error ? error.name : "unknown",
      });
      return Response.json(
        {
          ok: false,
          error:
            error instanceof Error
              ? error.message.slice(0, 240)
              : "Knowledge sync failed",
        },
        { status: 500 },
      );
    }
  }

  if (formData.get("intent") !== "analysis") {
    return Response.json({ ok: false, error: "Unknown dashboard action" }, { status: 400 });
  }

  try {
    return Response.json(
    await askCollectiveAssistant({
      shop: session.shop,
      mode: "operations_analysis",
      message: "Analysiere den aktuellen Retailer-Workspace, Import- und Shopify-DRAFT-Status. Nenne die wichtigsten Risiken und die nächsten sicheren Schritte.",
    }),
    );
  } catch (error) {
    console.error("[dashboard-analysis] assistant failed", {
      name: error instanceof Error ? error.name : "unknown",
    });
    return Response.json({
      ok: true,
      source: "local",
      answer: "Die Live-Analyse ist gerade nicht erreichbar. Sichere nächste Schritte: Import-Liste prüfen, Shopify-DRAFT-Status kontrollieren und nichts automatisch veröffentlichen.",
      error: "analysis_fallback",
    });
  }
}

export default function DashboardRoute() {
  const loaderData = useLoaderData<typeof authenticatedAppLoader>();

  if (loaderData.appRole === "supplier") {
    return (
      <SupplierDashboardView
        shop={loaderData.shop}
        sessionType={loaderData.sessionType}
      />
    );
  }

  if (loaderData.isAppAdmin) {
    return (
      <>
        <AdminDashboardView {...loaderData} />
        <ReadOnlyDiagnosticsPanel diagnostics={loaderData.diagnostics} />
        <AiOperationsBrief />
      </>
    );
  }

  return (
    <>
      <RetailerDashboardView {...loaderData} />
      <ReadOnlyDiagnosticsPanel diagnostics={loaderData.diagnostics} />
      <AiOperationsBrief />
    </>
  );
}
