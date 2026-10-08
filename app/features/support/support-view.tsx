import { useState } from "react";
import { Link, useFetcher } from "react-router";

import {
  FoundationNotice,
  PageHeader,
  SectionHeading,
  StatusPill,
} from "../../components/collective/foundation";

type SupportMode = "technical_support" | "product_advice" | "returns_orders" | "merchant_support";

const supportModes: Array<{
  value: SupportMode;
  label: string;
  description: string;
  questions: string[];
}> = [
  {
    value: "technical_support",
    label: "Technical support",
    description: "401, 404, 410, 500, 502, sessions, and safe next steps.",
    questions: [
      "Why do I get a 401 when opening the app?",
      "What does 410 at /app mean?",
      "Why does Generate Analysis return 502?",
    ],
  },
  {
    value: "product_advice",
    label: "Product advice",
    description: "Catalog, import lists, DRAFT products, and safe approvals.",
    questions: [
      "How do I move a product from the import list into Shopify?",
      "Which products should I test as DRAFTs first?",
    ],
  },
  {
    value: "returns_orders",
    label: "Returns / orders",
    description: "Case intake and explanation; live order access stays separate.",
    questions: [
      "How do I report a return safely?",
      "What information does support need about an order?",
    ],
  },
  {
    value: "merchant_support",
    label: "Merchant support",
    description: "Retailer settings, approvals, import flow, and workspace.",
    questions: [
      "Which merchant settings can I change?",
      "How does the safe import flow work for my shop?",
    ],
  },
];

export function SupportView({ shop, isAdmin = false }: { shop: string; isAdmin?: boolean }) {
  const [mode, setMode] = useState<SupportMode>("technical_support");
  const [message, setMessage] = useState(supportModes[0].questions[0]);
  const fetcher = useFetcher();
  const result = fetcher.data as
    | { ok?: boolean; answer?: string; source?: "openai" | "gemini" | "local"; mode?: SupportMode; model?: string; error?: string }
    | undefined;
  const selectedMode = supportModes.find((item) => item.value === mode) ?? supportModes[0];
  const liveAi = result?.source === "openai" || result?.source === "gemini";

  const changeMode = (nextMode: SupportMode) => {
    setMode(nextMode);
    const nextConfig = supportModes.find((item) => item.value === nextMode);
    setMessage(nextConfig?.questions[0] ?? "");
  };

  return (
    <main className="collective-page">
      <PageHeader
        eyebrow={isAdmin ? "Wolfshunter Brain" : "Retailer support"}
        title={isAdmin ? "Talk to your technical operator." : "Ask Collective Support."}
        description={isAdmin ? "Read-only diagnosis, business context, recovery proposals, and controlled next steps for the connected shop." : "A shop-scoped assistant for connection errors, import workflows, settings, and safe next steps."}
        actions={<StatusPill tone={liveAi ? "positive" : "info"}>{liveAi ? `${result?.model ?? result?.source} assisted` : "Safe fallback ready"}</StatusPill>}
      />
      <FoundationNotice>
        {isAdmin ? "Admin Brain is read-first. Actions remain approval-gated and no raw credentials are sent to the model." : `Support context is limited to ${shop}. No API keys, Cloudflare credentials, or Shopify access tokens are sent to the chat.`}
      </FoundationNotice>

      <section className="collective-section collective-support-shell">
        <SectionHeading
          title="What should we check?"
          description="Choose a support mode first. A status code, URL, and last action help with technical cases."
        />
        <div className="collective-support-mode-grid">
          <label htmlFor="support-mode">Support mode</label>
          <select
            id="support-mode"
            value={mode}
            onChange={(event) => changeMode(event.target.value as SupportMode)}
          >
            {supportModes.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>
          <p>{selectedMode.description}</p>
        </div>
        <div className="collective-support-quick-actions">
          {selectedMode.questions.map((question) => (
            <button key={question} type="button" className="collective-button collective-button-secondary" onClick={() => setMessage(question)}>
              {question}
            </button>
          ))}
        </div>
        <fetcher.Form method="post" className="collective-support-form">
          <input type="hidden" name="mode" value={mode} />
          <label htmlFor="support-message">Your question</label>
          <textarea
            id="support-message"
            name="message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={5}
            maxLength={4000}
            required
          />
          <div className="collective-support-form-actions">
            <button className="collective-button collective-button-primary" type="submit" disabled={fetcher.state !== "idle"}>
              {fetcher.state === "idle" ? "Ask support" : "Checking…"}
            </button>
            <Link className="collective-button collective-button-secondary" to="/app/settings">
              Open retailer settings
            </Link>
          </div>
        </fetcher.Form>

        {result?.answer ? (
          <article className="collective-support-answer" aria-live="polite">
            <div className="collective-support-answer-header">
              <StatusPill tone={liveAi ? "positive" : "attention"}>
                {liveAi ? result.model ?? result.source : "Local diagnosis"}
              </StatusPill>
              <span>Shop-scoped answer</span>
            </div>
            <p>{result.answer}</p>
            {result.error ? <small>Live AI unavailable; safe fallback used.</small> : null}
          </article>
        ) : null}
      </section>
    </main>
  );
}
