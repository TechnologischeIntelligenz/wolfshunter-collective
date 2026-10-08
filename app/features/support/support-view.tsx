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
    label: "Technik-Support",
    description: "401, 404, 410, 500, 502, Session und sichere nächste Schritte.",
    questions: [
      "Warum bekomme ich 401 beim Öffnen der App?",
      "Was bedeutet 410 bei /app?",
      "Warum kommt Generate Analysis mit 502 zurück?",
    ],
  },
  {
    value: "product_advice",
    label: "Produktberatung",
    description: "Katalog, Import-Liste, DRAFT-Produkte und sichere Freigaben.",
    questions: [
      "Wie bekomme ich ein Produkt aus der Import-Liste in Shopify?",
      "Welche Produkte sollte ich zuerst als DRAFT testen?",
    ],
  },
  {
    value: "returns_orders",
    label: "Rückgabe / Bestellung",
    description: "Fallaufnahme und Erklärung; Live-Bestellzugriff bleibt getrennt.",
    questions: [
      "Wie melde ich eine Rückgabe sicher?",
      "Welche Informationen braucht der Support zu einer Bestellung?",
    ],
  },
  {
    value: "merchant_support",
    label: "Händler-Support",
    description: "Retailer-Settings, Freigaben, Import-Ablauf und Workspace.",
    questions: [
      "Welche Händler-Einstellungen darf ich ändern?",
      "Wie läuft der sichere Import für meinen Shop?",
    ],
  },
];

export function SupportView({ shop }: { shop: string }) {
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
        eyebrow="Retailer support"
        title="Ask Collective Support."
        description="A shop-scoped assistant for connection errors, import workflows, settings, and safe next steps."
        actions={<StatusPill tone={liveAi ? "positive" : "info"}>{liveAi ? `${result?.model ?? result?.source} assisted` : "Safe fallback ready"}</StatusPill>}
      />
      <FoundationNotice>
        Support context is limited to {shop}. No API keys, Cloudflare credentials, or Shopify access tokens are sent to the chat.
      </FoundationNotice>

      <section className="collective-section collective-support-shell">
        <SectionHeading
          title="Was soll geprüft werden?"
          description="Wähle zuerst einen Support-Modus. Statuscode, URL und letzte Aktion helfen bei technischen Fällen."
        />
        <div className="collective-support-mode-grid">
          <label htmlFor="support-mode">Support-Modus</label>
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
