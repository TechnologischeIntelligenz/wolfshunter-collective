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

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  return { shop: session.shop };
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
    return Response.json({ ok: false, error: "Bitte beschreibe kurz dein Problem." }, { status: 400 });
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
      answer: "Die Live-Unterstützung ist gerade nicht erreichbar. Nenne Statuscode, URL und letzte Aktion; prüfe zuerst /healthz und ändere keine Tokens oder Veröffentlichungen.",
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
  const { shop } = useLoaderData<typeof loader>();
  return <SupportView shop={shop} />;
}
