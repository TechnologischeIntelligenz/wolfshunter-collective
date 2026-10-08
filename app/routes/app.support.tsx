import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";

import { SupportView } from "../features/support/support-view";
import {
  askCollectiveAssistant,
  isAssistantMode,
  type AssistantMode,
  type AssistantResult,
} from "../services/openai-assistant.server";
import { recordSupportCase } from "../services/support-case.server";
import { authenticate } from "../shopify.server";
import { isAppAdminSession } from "../services/app-admin.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  return { shop: session.shop, isAdmin: isAppAdminSession(session) };
}

export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const message = String(formData.get("message") ?? "").trim();
  const submittedMode = formData.get("mode");
  const mode: AssistantMode =
    isAssistantMode(submittedMode) && submittedMode !== "operations_analysis"
      ? submittedMode
      : "technical_support";

  if (!message) {
    return Response.json({ ok: false, error: "Please briefly describe the problem." }, { status: 400 });
  }

  let result: AssistantResult;
  try {
    result = await askCollectiveAssistant({ shop: session.shop, message, mode });
  } catch (error) {
    console.error("[retailer-support] assistant failed", {
      name: error instanceof Error ? error.name : "unknown",
    });
    result = {
      ok: true,
      source: "local",
      mode,
      answer: "Live support is currently unavailable. Include the status code, URL, and last action; check /healthz first and do not change tokens or publications.",
      error: "support_fallback",
    };
  }

  try {
    await recordSupportCase({ shop: session.shop, mode, message, result });
  } catch (error) {
    console.error("[retailer-support] support case logging failed", {
      name: error instanceof Error ? error.name : "unknown",
    });
  }

  return Response.json(result);
}

export default function SupportRoute() {
  const { shop, isAdmin } = useLoaderData<typeof loader>();
  return <SupportView shop={shop} isAdmin={isAdmin} />;
}
