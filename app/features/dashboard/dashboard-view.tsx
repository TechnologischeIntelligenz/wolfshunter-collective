import { Link } from "react-router";

import {
  FoundationNotice,
  MetricCard,
  PageHeader,
  SectionHeading,
  StatusPill,
} from "../../components/collective/foundation";
import type { AuthenticatedAppLoaderData } from "../../services/authenticated-app-loader.server";

const unavailableMetrics = [
  ["Available catalog", "Catalog source not connected"],
  ["Favorites", "Retailer persistence begins in a later phase"],
  ["Import list products", "No staged products yet"],
  ["Live products", "No Shopify products have been pushed"],
  ["Orders", "No retailer order data is connected"],
  ["Retail revenue", "Calculated only from verified order data"],
  ["Wholesale cost", "Calculated only from accepted Network Orders"],
  ["Estimated gross margin", "No verified revenue or cost data"],
] as const;

const operationalSignals = [
  {
    title: "Inventory sync health",
    description: "Waiting for an approved location and mapped inventory items.",
  },
  {
    title: "Mapping health",
    description: "No Collective-to-Shopify variant mappings exist yet.",
  },
  {
    title: "Low stock alerts",
    description: "Alerts will appear only from verified ATS inventory signals.",
  },
  {
    title: "Margin-risk alerts",
    description: "Margin policy is ready for a future verified cost feed.",
  },
  {
    title: "Pending fulfillment",
    description: "No retailer orders are connected or routed.",
  },
  {
    title: "Tracking exceptions",
    description: "No shipments are being monitored.",
  },
] as const;

export function DashboardView({ authLink, sessionType, shop }: AuthenticatedAppLoaderData) {
  const isConnected = Boolean(shop);

  return (
    <main className="collective-page">
      <PageHeader
        eyebrow="Retailer operations"
        title="A calm view across your commerce network."
        description="Curate products, protect margins, and prepare fulfillment from one premium operating workspace."
        actions={
          <>
            <Link className="collective-button collective-button-secondary" to={authLink}>
              Re-run Shopify auth
            </Link>
            <Link className="collective-button collective-button-primary" to="/app/discover">
              Explore the catalog
            </Link>
          </>
        }
      />

      <FoundationNotice />

      <section className="collective-auth-callout" aria-label="Shopify authentication link">
        <div>
          <p className="collective-eyebrow">Shopify auth</p>
          <h2>Open the auth link directly.</h2>
          <p>
            If the embedded app looks blank or Shopify asks for a fresh session,
            use this visible link to restart auth.
          </p>
        </div>
        <div className="collective-auth-panel">
          <Link className="collective-button collective-button-primary" to={authLink}>
            Open auth link
          </Link>
          <div className="collective-auth-url-wrap">
            <span>Direct link</span>
            <code className="collective-auth-url">{authLink}</code>
          </div>
        </div>
      </section>

      <section className="collective-status-strip" aria-label="Retailer account status">
        <div>
          <span className="collective-status-icon">A</span>
          <div>
            <small>Authenticated store</small>
            <strong>{isConnected ? shop : "Not connected"}</strong>
          </div>
        </div>
        <StatusPill tone={isConnected ? "positive" : "attention"}>
          {isConnected ? "Auth OK" : "Auth needed"}
        </StatusPill>
        <div className="collective-status-divider" />
        <div>
          <span className="collective-status-icon">S</span>
          <div>
            <small>Session</small>
            <strong>{sessionType}</strong>
          </div>
        </div>
        <StatusPill tone="neutral">Visible</StatusPill>
      </section>

      <section className="collective-section">
        <SectionHeading
          title="Commerce overview"
          description="Metrics remain blank until verified retailer and Network Order data exists."
        />
        <div className="collective-metric-grid">
          {unavailableMetrics.map(([label, detail]) => (
            <MetricCard key={label} label={label} detail={detail} />
          ))}
        </div>
      </section>

      <section className="collective-section">
        <SectionHeading
          title="Operational health"
          description="Each signal will be derived from mapped, tenant-scoped records—not inferred activity."
        />
        <div className="collective-signal-grid">
          {operationalSignals.map((signal) => (
            <article key={signal.title} className="collective-signal-card">
              <div className="collective-signal-marker" aria-hidden="true" />
              <div>
                <h3>{signal.title}</h3>
                <p>{signal.description}</p>
              </div>
              <span>—</span>
            </article>
          ))}
        </div>
      </section>

      <section className="collective-dashboard-callout">
        <div>
          <p className="collective-eyebrow">Phase 1 workflow</p>
          <h2>Build the assortment before touching the store.</h2>
          <p>
            Discover, favorite, and stage products for review. Product creation,
            inventory synchronization, publication, and fulfillment stay disabled.
          </p>
        </div>
        <div className="collective-mini-flow" aria-label="Phase 1 product workflow">
          <span>Discover</span>
          <i>?</i>
          <span>Favorite</span>
          <i>?</i>
          <span>Import list</span>
          <i>?</i>
          <span>Review</span>
        </div>
      </section>
    </main>
  );
}
