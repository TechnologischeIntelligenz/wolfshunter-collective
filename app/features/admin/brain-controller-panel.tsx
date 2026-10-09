import { useFetcher } from "react-router";

import { SectionHeading, StatusPill } from "../../components/collective/foundation";

type BrainRole =
  | "operator_advisor"
  | "retailer_sales"
  | "superadmin2"
  | "security_officer";

type BrainResult = {
  ok: boolean;
  role: BrainRole;
  roleLabel: string;
  requestClass: "advisory" | "approval_required";
  approvalRequired: boolean;
  execution: "not_executed";
  source: "openai" | "gemini" | "combined" | "local";
  answer: string;
  model?: string;
  error?: string;
};

const roles: Array<{ value: BrainRole; label: string; detail: string }> = [
  {
    value: "operator_advisor",
    label: "Operator-Berater",
    detail: "App-Zustand, Architektur, Releases und Prioritäten",
  },
  {
    value: "retailer_sales",
    label: "Retailer-Verkaufsprofi",
    detail: "Sortiment, Positionierung, Conversion und Marge",
  },
  {
    value: "superadmin2",
    label: "Superadmin 2 – Operator-Vertretung",
    detail: "Systemweite Zusammenhänge und kontrollierte Abläufe",
  },
  {
    value: "security_officer",
    label: "Sicherheitsbeauftragter",
    detail: "Zugriffsrechte, Secrets, Backups und Wiederherstellung",
  },
];

export function BrainControllerPanel() {
  const fetcher = useFetcher<{ brain?: BrainResult; error?: string }>();
  const result = fetcher.data?.brain;
  const live = result?.source === "openai" || result?.source === "combined";
  const pending = fetcher.state !== "idle";

  return (
    <section className="collective-section collective-brain-controller">
      <SectionHeading
        title="WOLFSHUNTER BrainController"
        description="OpenAI-gestützter Operator-Berater mit Shop-Kontext, Projektwissen und getrennten Rollen. Die Rollen beraten; sie erteilen selbst keine technischen oder administrativen Rechte."
        accessory={
          <StatusPill tone={live ? "positive" : "info"}>
            {result ? (live ? result.model ?? "OpenAI live" : "Lokaler Fallback") : "Bereit"}
          </StatusPill>
        }
      />
      <div className="collective-admin-grid">
        {roles.map((role) => (
          <article className="collective-admin-card" key={role.value}>
            <h3>{role.label}</h3>
            <p>{role.detail}</p>
          </article>
        ))}
      </div>
      <fetcher.Form method="post" className="collective-brain-form">
        <input type="hidden" name="intent" value="brain" />
        <label htmlFor="brain-role">Arbeitsrolle</label>
        <select id="brain-role" name="role" defaultValue="operator_advisor">
          {roles.map((role) => (
            <option key={role.value} value={role.value}>{role.label}</option>
          ))}
        </select>
        <label htmlFor="brain-message">Aufgabe an den BrainController</label>
        <textarea
          id="brain-message"
          name="message"
          rows={4}
          maxLength={3000}
          required
          placeholder="Zum Beispiel: Analysiere die aktuellen Blocker und nenne den nächsten überprüfbaren Reparaturschritt."
        />
        <button
          className="collective-button collective-button-primary"
          type="submit"
          disabled={pending}
        >
          {pending ? "Analysiere …" : "BrainController fragen"}
        </button>
      </fetcher.Form>
      {fetcher.data?.error ? <p role="alert">{fetcher.data.error}</p> : null}
      {result ? (
        <article className="collective-ai-brief-answer" aria-live="polite">
          <div className="collective-service-summary">
            <StatusPill tone={result.approvalRequired ? "attention" : "positive"}>
              {result.approvalRequired ? "Manuelle Freigabe erforderlich" : "Beratung"}
            </StatusPill>
            <StatusPill tone="neutral">{result.roleLabel}</StatusPill>
            <StatusPill tone="neutral">Nichts ausgeführt</StatusPill>
          </div>
          <div className="collective-brain-answer">{result.answer}</div>
          {result.error ? (
            <small>Live-AI nicht vollständig verfügbar; der sichere Fallback wurde verwendet.</small>
          ) : null}
        </article>
      ) : null}
      <p className="collective-muted">
        Bitte keine Passwörter oder API-Schlüssel in den Chat eingeben. Erkannte Geheimnisse werden vor dem KI-Aufruf redigiert. Produktänderungen, Deployments, Löschungen, Zahlungsentscheidungen und Zugangsumstellungen werden hier nicht automatisch ausgeführt.
      </p>
    </section>
  );
}
