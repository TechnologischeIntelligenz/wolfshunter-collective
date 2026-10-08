import {
  SectionHeading,
  StatusPill,
} from "../../components/collective/foundation";
import type {
  DiagnosticTone,
  ReadOnlyDiagnostics,
} from "../../services/read-only-diagnostics.server";

const toneLabel: Record<DiagnosticTone, string> = {
  green: "Green",
  yellow: "Yellow",
  red: "Red",
};

const pillTone: Record<DiagnosticTone, "positive" | "attention" | "critical"> = {
  green: "positive",
  yellow: "attention",
  red: "critical",
};

const errorCodeGuide = [
  ["401", "Authentication", "Session token is missing or expired; reopen the Shopify app."],
  ["403", "Permission", "Check the scope, Shopify permission, or Cloudflare access rule."],
  ["404", "Route missing", "Check the hostname and path; /healthz is the safe reachability test."],
  ["410", "Bot/Gone response", "No session token at /app; start cleanly through /auth/login."],
  ["500", "Server error", "Check server logs and the affected action; do not delete or reinstall."],
  ["502", "Upstream error", "Check OpenAI, Cloudflare, and the proxy separately; local fallback remains active."],
] as const;

function formatDate(value: string | null | undefined): string {
  if (!value) return "not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Invalid date" : date.toLocaleString("en-US");
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
        description="Health, session, Shopify, OpenAI, Cloudflare, database, and webhooks ? without infrastructure changes."
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
              <h3>Latest failed operations</h3>
            </div>
            <StatusPill tone={diagnostics.recentFailures.length ? "attention" : "positive"}>
              {diagnostics.recentFailures.length ? `${diagnostics.recentFailures.length} open` : "None"}
            </StatusPill>
          </div>
          {diagnostics.recentFailures.length ? (
            <ul className="collective-diagnostics-failures">
              {diagnostics.recentFailures.map((failure) => (
                <li key={failure.id}>
                  <div>
                    <strong>{failure.title}</strong>
                    <small>{failure.status} ? {formatDate(failure.createdAt)}</small>
                  </div>
                  <p>{failure.error || "No error description is stored."}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="collective-diagnostics-empty">No failed import or Shopify operations are stored.</p>
          )}
          {diagnostics.recentFailuresNote ? <small>{diagnostics.recentFailuresNote}</small> : null}
        </article>

        <article className="collective-diagnostics-subpanel">
          <div className="collective-diagnostics-subpanel-header">
            <div>
              <p className="collective-eyebrow">Quick reference</p>
              <h3>Error code guide</h3>
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
      <p className="collective-diagnostics-checked">Last checked: {formatDate(diagnostics.checkedAt)}</p>
    </section>
  );
}
