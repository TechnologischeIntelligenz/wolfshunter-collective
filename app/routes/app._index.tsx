import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";

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
      message: "Analyze the current retailer workspace, import status, and Shopify DRAFT status. List the key risks and safest next steps.",
    }),
    );
  } catch (error) {
    console.error("[dashboard-analysis] assistant failed", {
      name: error instanceof Error ? error.name : "unknown",
    });
    return Response.json({
      ok: true,
      source: "local",
      answer: "Live analysis is currently unavailable. Safe next steps: review the import list, check Shopify DRAFT status, and publish nothing automatically.",
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
    </>
  );
}
