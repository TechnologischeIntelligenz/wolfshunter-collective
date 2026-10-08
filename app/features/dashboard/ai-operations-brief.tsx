import { useFetcher } from "react-router";

import { SectionHeading, StatusPill } from "../../components/collective/foundation";

export function AiOperationsBrief() {
  const fetcher = useFetcher();
  const result = fetcher.data as
    | { ok?: boolean; answer?: string; source?: "openai" | "gemini" | "local"; model?: string; error?: string }
    | undefined;
  const liveAi = result?.source === "openai" || result?.source === "gemini";

  return (
    <section className="collective-section collective-ai-brief">
      <SectionHeading
        title="AI operations brief"
        description="Generate a shop-scoped explanation of current import, connection, and approval state."
        accessory={
          <StatusPill tone={liveAi ? "positive" : "info"}>
            {liveAi ? result?.model ?? result?.source : "On demand"}
          </StatusPill>
        }
      />
      <div className="collective-ai-brief-body">
        <p>
          The assistant can explain what is happening and recommend a safe next step. It cannot publish, delete, rotate credentials, or change Cloudflare rules.
        </p>
        <fetcher.Form method="post">
          <input type="hidden" name="intent" value="analysis" />
          <button className="collective-button collective-button-primary" type="submit" disabled={fetcher.state !== "idle"}>
            {fetcher.state === "idle" ? "Generate analysis" : "Analyzing…"}
          </button>
        </fetcher.Form>
      </div>
      {result?.answer ? (
        <article className="collective-ai-brief-answer" aria-live="polite">
          <div>
            <StatusPill tone={liveAi ? "positive" : "attention"}>
              {liveAi ? `${result.source} analysis` : "Local analysis"}
            </StatusPill>
          </div>
          <p>{result.answer}</p>
          {result.error ? <small>Live AI unavailable; safe fallback used.</small> : null}
        </article>
      ) : null}
    </section>
  );
}
