import {
  SectionHeading,
  StatusPill,
} from "../../components/collective/foundation";
import type {
  DiagnosticTone,
  ReadOnlyDiagnostics,
} from "../../services/read-only-diagnostics.server";

const toneLabel: Record<DiagnosticTone, string> = {
  green: "Grün",
  yellow: "Gelb",
  red: "Rot",
};

const pillTone: Record<DiagnosticTone, "positive" | "attention" | "critical"> = {
  green: "positive",
  yellow: "attention",
  red: "critical",
};

const errorCodeGuide = [
  ["401", "Authentifizierung", "Session-Token fehlt oder ist abgelaufen; Shopify-App erneut öffnen."],
  ["403", "Berechtigung", "Scope, Shopify-Berechtigung oder Cloudflare-Access-Regel prüfen."],
  ["404", "Route fehlt", "Hostname und Pfad prüfen; /healthz ist der sichere Erreichbarkeitstest."],
  ["410", "Bot-/Gone-Antwort", "Kein Session-Token bei /app; sauber über /auth/login starten."],
  ["500", "Serverfehler", "Server-Logs und betroffene Aktion prüfen; nichts löschen oder neu installieren."],
  ["502", "Upstreamfehler", "OpenAI/Cloudflare/Proxy getrennt prüfen; lokaler Fallback bleibt aktiv."],
] as const;

function formatDate(value: string | null | undefined): string {
  if (!value) return "nicht vorhanden";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "ungültiges Datum" : date.toLocaleString("de-AT");
}

function metadataEntries(metadata: Record<string, string | number | boolean | null> | undefined) {
  if (!metadata) return [];
  return Object.entries(metadata).filter(([, value]) => value !== null && value !== "");
}

export function ReadOnlyDiagnosticsPanel({ diagnostics }: { diagnostics: ReadOnlyDiagnostics }) {
  return (
    <section className="collective-section collective-diagnostics" aria-label="Read-only diagnostics">
      <SectionHeading
        title="Read-only system diagnosis"
        description="Health, Session, Shopify, OpenAI, Cloudflare, Datenbank und Webhooks – ohne Änderungen an deiner Infrastruktur."
        accessory={<StatusPill tone={pillTone[diagnostics.overallTone]}>{toneLabel[diagnostics.overallTone]}</StatusPill>}
      />

      <div className="collective-diagnostics-grid">
        {diagnostics.checks.map((check) => (
          <article key={check.key} className={`collective-diagnostic-card collective-diagnostic-${check.tone}`}>
            <div className="collective-diagnostic-card-header">
              <div>
                <span className="collective-diagnostic-dot" aria-hidden="true" />
                <strong>{check.label}</strong>
              </div>
              <StatusPill tone={pillTone[check.tone]}>{toneLabel[check.tone]}</StatusPill>
            </div>
            <p className="collective-diagnostic-status">{check.status}</p>
            <p>{check.detail}</p>
            {check.metadata ? (
              <dl className="collective-diagnostic-meta">
                {metadataEntries(check.metadata).map(([key, value]) => (
                  <div key={key}>
                    <dt>{key}</dt>
                    <dd>{String(value)}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </article>
        ))}
      </div>

      <div className="collective-diagnostics-lower-grid">
        <article className="collective-diagnostics-subpanel">
          <div className="collective-diagnostics-subpanel-header">
            <div>
              <p className="collective-eyebrow">Evidence log</p>
              <h3>Letzte fehlgeschlagene Vorgänge</h3>
            </div>
            <StatusPill tone={diagnostics.recentFailures.length ? "attention" : "positive"}>
              {diagnostics.recentFailures.length ? `${diagnostics.recentFailures.length} offen` : "Keine"}
            </StatusPill>
          </div>
          {diagnostics.recentFailures.length ? (
            <ul className="collective-diagnostics-failures">
              {diagnostics.recentFailures.map((failure) => (
                <li key={failure.id}>
                  <div>
                    <strong>{failure.title}</strong>
                    <small>{failure.status} · {formatDate(failure.createdAt)}</small>
                  </div>
                  <p>{failure.error || "Keine Fehlerbeschreibung gespeichert."}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="collective-diagnostics-empty">Keine fehlgeschlagenen Import-/Shopify-Vorgänge gespeichert.</p>
          )}
          {diagnostics.recentFailuresNote ? <small>{diagnostics.recentFailuresNote}</small> : null}
        </article>

        <article className="collective-diagnostics-subpanel">
          <div className="collective-diagnostics-subpanel-header">
            <div>
              <p className="collective-eyebrow">Quick reference</p>
              <h3>Fehlercode-Erklärung</h3>
            </div>
          </div>
          <div className="collective-error-code-list">
            {errorCodeGuide.map(([code, label, detail]) => (
              <div key={code}>
                <strong>{code}</strong>
                <span><b>{label}:</b> {detail}</span>
              </div>
            ))}
          </div>
        </article>
      </div>

      <p className="collective-diagnostics-checked">Zuletzt geprüft: {formatDate(diagnostics.checkedAt)}</p>
    </section>
  );
}
