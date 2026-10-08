import { Link } from "react-router";

import {
  FoundationNotice,
  MetricCard,
  PageHeader,
  SectionHeading,
  StatusPill,
} from "../../components/collective/foundation";
import type { AuthenticatedAppLoaderData } from "../../services/authenticated-app-loader.server";

const signals = [
  ["Inventory sync health", "Waiting for an approved supplier inventory connection."],
  ["Mapping health", "Mappings appear after a product DRAFT is created."],
  ["Low stock alerts", "Requires verified, fresh supplier inventory signals."],
  ["Margin-risk alerts", "Requires verified supplier costs and retailer pricing."],
  ["Pending fulfillment", "Order routing is protected until the workflow is live."],
  ["Tracking exceptions", "Shipment monitoring starts after fulfillment integration."],
] as const;

export function RetailerDashboardView({
  authLink,
  sessionType,
  shop,
  isAppAdmin,
  shopMetrics,
  collectiveImportDrafts,
  collectiveImportFailures,
}: AuthenticatedAppLoaderData) {
  const isConnected = Boolean(shop);
  const countLabel = (metric: { count: number; precision: string } | null) =>
    metric ? `${metric.count}${metric.precision === "EXACT" ? "" : "+"}` : "—";
  const countDetail = (metric: { count: number; precision: string } | null) =>
    metric
      ? `Shopify Admin · ${metric.precision === "EXACT" ? "exact count" : "lower bound"}`
      : "Shopify read-only query unavailable";
  const metrics = [
    ["Shopify products", countLabel(shopMetrics.totalProducts), countDetail(shopMetrics.totalProducts)],
    ["Active products", countLabel(shopMetrics.activeProducts), countDetail(shopMetrics.activeProducts)],
    ["Shopify DRAFTs", countLabel(shopMetrics.draftProducts), countDetail(shopMetrics.draftProducts)],
    ["Archived products", countLabel(shopMetrics.archivedProducts), countDetail(shopMetrics.archivedProducts)],
    ["Product variants", countLabel(shopMetrics.productVariants), countDetail(shopMetrics.productVariants)],
    ["Collective DRAFTs", String(collectiveImportDrafts), "Created through approved Import Lists"],
    ["Import failures", String(collectiveImportFailures), collectiveImportFailures ? "Review and retry safely" : "No failed imports recorded"],
    ["Catalog source", shopMetrics.source === "shopify" ? "LIVE" : "CHECK", shopMetrics.error ?? "Aggregated read-only Shopify data"],
  ] as const;

  return (
    <main className="collective-page">
      <PageHeader
        eyebrow="Retailer operations"
        title="A calm view across your commerce network."
        description="Curate supplier products, protect margins, and move approved products into your Shopify store from one premium workspace."
        actions={
          <>
            <Link className="collective-button collective-button-secondary" to={authLink}>
              Re-run Shopify auth
            </Link>
            <Link className="collective-button collective-button-primary" to="/app/discover">
              Explore the catalog
            </Link>
            {isAppAdmin ? (
              <Link className="collective-button collective-button-secondary" to="/app/admin">
                App admin
              </Link>
            ) : null}
          </>
        }
      />

      <FoundationNotice>
        Retailer workflow: Discover, save, review in Import List, then create an
        unpublished Shopify DRAFT with one explicit approval. Nothing is
        published automatically. Supplier SKUs and supplier identities are not
        included in the retailer response.
      </FoundationNotice>

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
          description="Your real Shopify catalog is summarized here without loading thousands of products into the browser."
          accessory={<StatusPill tone={shopMetrics.source === "shopify" ? "positive" : "attention"}>{shopMetrics.source === "shopify" ? "Shopify live read" : "Shopify check needed"}</StatusPill>}
        />
        <div className="collective-metric-grid">
          {metrics.map(([label, value, detail]) => (
            <MetricCard key={label} label={label} value={value} detail={detail} />
          ))}
        </div>
      </section>

      <section className="collective-section">
        <SectionHeading
          title="Operational health"
          description="Signals are derived from mapped, tenant-scoped records, never invented activity."
        />
        <div className="collective-signal-grid">
          {signals.map(([title, description]) => (
            <article key={title} className="collective-signal-card">
              <div className="collective-signal-marker" aria-hidden="true" />
              <div>
                <h3>{title}</h3>
                <p>{description}</p>
              </div>
              <span>—</span>
            </article>
          ))}
        </div>
      </section>

      <section className="collective-dashboard-callout">
        <div>
          <p className="collective-eyebrow">Retailer workflow</p>
          <h2>Build the assortment before touching the store.</h2>
          <p>
            Discover, favorite, and stage products for review. An explicit
            Import List approval creates an unpublished Shopify DRAFT;
            publication, inventory synchronization, and fulfillment remain
            protected until their real workflows are ready.
          </p>
        </div>
        <div className="collective-mini-flow" aria-label="Retailer product workflow">
          <span>Discover</span>
          <i>?</i>
          <span>Favorite</span>
          <i>?</i>
          <span>Import List</span>
          <i>?</i>
          <span>Create DRAFT</span>
        </div>
      </section>
    </main>
  );
}
