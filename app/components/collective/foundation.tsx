import type { ReactNode } from "react";
import { Link } from "react-router";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <header className="collective-page-header">
      <div>
        <div className="collective-page-kicker">
          <img
            src="/wolfshunter-collective-logo.png"
            alt=""
            width="64"
            height="64"
          />
          <p className="collective-eyebrow">{eyebrow}</p>
        </div>
        <h1>{title}</h1>
        <p className="collective-page-description">{description}</p>
      </div>
      {actions ? <div className="collective-header-actions">{actions}</div> : null}
    </header>
  );
}

export function FoundationNotice({ children }: { children?: ReactNode }) {
  return (
    <div className="collective-foundation-notice" role="note">
      <span className="collective-notice-dot" aria-hidden="true" />
      <span>
        {children ??
          "Foundation preview — fixture data only. No Shopify data is being read or changed."}
      </span>
    </div>
  );
}

export function MetricCard({
  label,
  value = "—",
  detail,
  tone = "neutral",
}: {
  label: string;
  value?: string;
  detail: string;
  tone?: "neutral" | "positive" | "attention";
}) {
  return (
    <article className={`collective-metric-card collective-tone-${tone}`}>
      <div className="collective-metric-topline">
        <span>{label}</span>
        <span className="collective-metric-indicator" aria-hidden="true" />
      </div>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}

export function EmptyState({
  eyebrow,
  title,
  description,
  actionLabel,
  actionHref,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="collective-empty-state">
      <div className="collective-empty-mark" aria-hidden="true">
        WC
      </div>
      <p className="collective-eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      <p>{description}</p>
      {actionLabel && actionHref ? (
        <Link className="collective-button collective-button-primary" to={actionHref}>
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

export function StatusPill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "positive" | "attention" | "critical" | "info";
}) {
  return (
    <span className={`collective-status-pill collective-status-${tone}`}>
      {children}
    </span>
  );
}

export function SectionHeading({
  title,
  description,
  accessory,
}: {
  title: string;
  description?: string;
  accessory?: ReactNode;
}) {
  return (
    <div className="collective-section-heading">
      <div>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {accessory ? <div>{accessory}</div> : null}
    </div>
  );
}
