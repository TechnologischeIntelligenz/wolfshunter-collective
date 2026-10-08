import { useEffect } from "react";
import { CatalogPagination } from "../../components/collective/catalog-pagination";
import { Link, useFetcher, useSearchParams, useRevalidator } from "react-router";

import {
  FoundationNotice,
  MetricCard,
  PageHeader,
  SectionHeading,
  StatusPill,
} from "../../components/collective/foundation";
import type { AuthenticatedAppLoaderData } from "../../services/authenticated-app-loader.server";

type SyncActionResult = {
  ok?: boolean;
  status?: string;
  catalog?: { scannedCount: number; upsertedCount: number };
  policies?: { scannedCount: number };
  error?: string;
};

export function AdminDashboardView({
  shop,
  sessionType,
  shopMetrics,
  collectiveImportDrafts,
  collectiveImportFailures,
  diagnostics,
  adminCatalog,
  supportInsights,
  knowledgeSummary,
  catalogPage,
  sourceSyncState,
}: AuthenticatedAppLoaderData) {
  const [params, setParams] = useSearchParams();
  const filter = (name: string, value: string) => { const next = new URLSearchParams(params); next.set(name, value); next.set("page", "1"); setParams(next, { preventScrollReset: true }); };
  const syncFetcher = useFetcher<SyncActionResult>();
  const revalidator = useRevalidator();
  const running = sourceSyncState?.status === "RUNNING";
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => { if (revalidator.state === "idle") revalidator.revalidate(); }, 5000);
    return () => clearInterval(timer);
  }, [running, revalidator]);
  const syncBusy = syncFetcher.state !== "idle" || running;
  const metrics = [
    ["Connected shop", shop, "Current authenticated tenant"],
    ["Shopify products", shopMetrics.totalProducts ? `${shopMetrics.totalProducts.count}${shopMetrics.totalProducts.precision === "EXACT" ? "" : "+"}` : "—", "Read-only live count"],
    ["Shopify DRAFTs", shopMetrics.draftProducts ? `${shopMetrics.draftProducts.count}${shopMetrics.draftProducts.precision === "EXACT" ? "" : "+"}` : "—", "Unpublished merchant products"],
    ["Collective DRAFTs", String(collectiveImportDrafts), "Created through approved import flow"],
    ["Import failures", String(collectiveImportFailures), collectiveImportFailures ? "Needs operator review" : "No failures recorded"],
    ["Session", sessionType, "Authenticated server session"],
  ] as const;

  return (
    <main className="collective-page">
      <PageHeader
        eyebrow="Operator control plane"
        title="WOLFSHUNTER administration"
        description="Your operator dashboard is separate from the retailer workspace. Review health, imports, policy boundaries, and the connected shop without exposing these controls to retailers."
        actions={
          <>
            <StatusPill tone="positive">Admin allowlist</StatusPill>
            <syncFetcher.Form method="post">
              <input type="hidden" name="intent" value="sync-knowledge" />
              <button
                className="collective-button collective-button-primary"
                type="submit"
                disabled={syncBusy}
              >
                {syncBusy ? "Syncing..." : "Synchronize source shop"}
              </button>
            </syncFetcher.Form>
            <Link className="collective-button collective-button-secondary" to="/app/admin">
              Admin controls
            </Link>
          </>
        }
      />

      <FoundationNotice>
        This view is protected by the server-side admin allowlist. Retailers
        continue to see the olive-green Discover, Import Lists, and DRAFT-first
        workspace for their own shop only. Supplier SKU mappings stay available
        only to this admin context and to the supplier that owns each mapping.
      </FoundationNotice>

      <section className="collective-dashboard-callout collective-brain-hero">
        <div>
          <p className="collective-eyebrow">Wolfshunter Brain</p>
          <h2>Your technical operator and business assistant</h2>
          <p>
            Start with diagnosis, customer-support context, product knowledge,
            and safe recovery suggestions. Writes remain approval-gated until a
            defined emergency rule applies.
          </p>
        </div>
        <div className="collective-brain-hero-actions">
          <StatusPill tone="positive">Read and diagnose</StatusPill>
          <Link className="collective-button collective-button-primary" to="/app/brain">
            Open Brain chat
          </Link>
        </div>
      </section>

      <section className="collective-section">
        <SectionHeading
          title="Operator overview"
          description="Only verified data from the currently connected Shopify shop is shown here."
          accessory={<StatusPill tone={diagnostics.overallTone === "green" ? "positive" : "attention"}>{diagnostics.overallTone}</StatusPill>}
        />
        <div className="collective-metric-grid">
          {metrics.map(([label, value, detail]) => (
            <MetricCard key={label} label={label} value={value} detail={detail} />
          ))}
        </div>
        {sourceSyncState ? <FoundationNotice>{sourceSyncState.status}: {sourceSyncState.message}</FoundationNotice> : null}
        {syncFetcher.data?.status === "RUNNING" && !sourceSyncState ? <FoundationNotice>Synchronization started in the background.</FoundationNotice> : null}
        {syncFetcher.data?.error ? <FoundationNotice>{syncFetcher.data.error}</FoundationNotice> : null}
      </section>

      <section className="collective-section">
        <SectionHeading
          title="Knowledge bank and sync audit"
          description="Admin-controlled product, collection, inventory, policy, release, and RAG source state."
          accessory={<StatusPill tone="info">{knowledgeSummary?.documents ?? 0} docs</StatusPill>}
        />
        <div className="collective-service-summary">
          <span>{knowledgeSummary?.products ?? 0} products indexed</span>
          <span>{knowledgeSummary?.activeProducts ?? 0} active products</span>
          <span>{knowledgeSummary?.collections ?? 0} collections</span>
          <span>{knowledgeSummary?.policies ?? 0} policies</span>
        </div>
        {knowledgeSummary?.releasesByStatus.length ? (
          <div className="collective-service-summary">
            {knowledgeSummary.releasesByStatus.map((entry) => (
              <span key={entry.status}>{entry.count} {entry.status}</span>
            ))}
          </div>
        ) : null}
        {knowledgeSummary?.recentRuns.length ? (
          <div className="collective-support-inbox">
            {knowledgeSummary.recentRuns.map((run) => (
              <article className="collective-support-ticket" key={run.id}>
                <div className="collective-support-ticket-head">
                  <div>
                    <strong>{run.scope}</strong>
                    <small>{run.shop} · {new Date(run.startedAt).toLocaleString()}</small>
                  </div>
                  <StatusPill tone={run.status === "FAILED" ? "critical" : "positive"}>
                    {run.status}
                  </StatusPill>
                </div>
                <p>{run.scannedCount} scanned · {run.upsertedCount} updated</p>
                {run.errorMessage ? <small>{run.errorMessage}</small> : null}
              </article>
            ))}
          </div>
        ) : (
          <FoundationNotice>No knowledge sync runs recorded yet.</FoundationNotice>
        )}
      </section>

      <section className="collective-section">
        <SectionHeading
          title="Customer service inbox"
          description="Retailer popup and support assistant messages are recorded here for operator review."
          accessory={
            <StatusPill tone={supportInsights?.needsAttention ? "attention" : "positive"}>
              {supportInsights?.needsAttention ?? 0} need review
            </StatusPill>
          }
        />
        <div className="collective-service-summary">
          <span>{supportInsights?.total ?? 0} total conversations</span>
          <span>{supportInsights?.liveAiAnswers ?? 0} AI answers</span>
          <span>{supportInsights?.fallbackAnswers ?? 0} local fallbacks</span>
        </div>
        {supportInsights?.latest.length ? (
          <div className="collective-support-inbox">
            {supportInsights.latest.map((item) => (
              <article className="collective-support-ticket" key={item.id}>
                <div className="collective-support-ticket-head">
                  <div>
                    <strong>{item.shop}</strong>
                    <small>{item.mode} · {new Date(item.createdAt).toLocaleString()}</small>
                  </div>
                  <StatusPill tone={item.status === "NEEDS_ATTENTION" ? "attention" : "positive"}>
                    {item.source}
                  </StatusPill>
                </div>
                <p>{item.message}</p>
                <blockquote>{item.answer}</blockquote>
                {item.errorCode ? <small>{item.errorCode}</small> : null}
              </article>
            ))}
          </div>
        ) : (
          <FoundationNotice>No support conversations have been recorded yet.</FoundationNotice>
        )}
      </section>

      <section className="collective-section">
        <SectionHeading
          title="Synchronized product catalog"
          description="Complete source catalog synchronized from WOLFSHUNTER. Up to 250 products are shown per page."
          accessory={
            <StatusPill tone={adminCatalog?.source === "shopify" ? "positive" : "attention"}>
              {adminCatalog?.source === "shopify" ? "Shopify catalog" : "Not connected"}
            </StatusPill>
          }
        />
        <form onSubmit={event => { event.preventDefault(); filter("q", String(new FormData(event.currentTarget).get("q") ?? "")); }}>
          <label>Search the complete catalog <input name="q" type="search" defaultValue={catalogPage?.search} /></label>
          <button className="collective-button collective-button-secondary" type="submit">Search</button>
          <label>Collection <select value={catalogPage?.collection ?? "ALL_COLLECTIONS"} onChange={event => filter("collection", event.target.value)}>
            <option value="ALL_COLLECTIONS">All collections</option>
            {catalogPage?.collections.map(c => <option key={c.id} value={c.id}>{c.title} ({c.count})</option>)}
          </select></label>
        </form>
        <CatalogPagination page={catalogPage} />
        {adminCatalog?.error ? (
          <FoundationNotice>{adminCatalog.error}</FoundationNotice>
        ) : adminCatalog?.products.length ? (
          <div className="collective-table-wrap">
            <table className="collective-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Preview</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Status</th>
                  <th>Vendor</th>
                  <th>Type</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {adminCatalog.products.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <strong>{product.title}</strong>
                      <small>/{product.handle}</small>
                    </td>
                    <td>
                      {product.images[0] ? (
                        <img
                          className="collective-admin-product-thumb"
                          src={product.images[0].url}
                          alt={product.images[0].altText ?? product.title}
                          loading="lazy"
                        />
                      ) : (
                        <span className="collective-admin-product-thumb is-empty" aria-label="No product image">W/C</span>
                      )}
                    </td>
                    <td>
                      {product.priceRange
                        ? new Intl.NumberFormat("en-GB", {
                            style: "currency",
                            currency: product.priceRange.currency,
                          }).format(product.priceRange.minimum)
                        : "—"}
                    </td>
                    <td>{product.totalInventory}</td>
                    <td>
                      <StatusPill
                        tone={
                          product.status === "ACTIVE"
                            ? "positive"
                            : product.status === "DRAFT"
                              ? "attention"
                              : "neutral"
                        }
                      >
                        {product.status}
                      </StatusPill>
                    </td>
                    <td>{product.vendor || "—"}</td>
                    <td>{product.productType || "—"}</td>
                    <td>{product.updatedAt.slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <FoundationNotice>No Shopify products were returned for this shop.</FoundationNotice>
        )}
      </section>

      <section className="collective-section">
        <SectionHeading
          title="Shopify collections"
          description="The first 25 collections are read live from the same shop; they are not duplicated into Collective storage."
          accessory={<StatusPill tone="neutral">{adminCatalog?.collections.length ?? 0} visible</StatusPill>}
        />
        {adminCatalog?.collections.length ? (
          <div className="collective-table-wrap">
            <table className="collective-table">
              <thead>
                <tr>
                  <th>Collection</th>
                  <th>Handle</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {adminCatalog.collections.map((collection) => (
                  <tr key={collection.id}>
                    <td><strong>{collection.title}</strong></td>
                    <td>/{collection.handle}</td>
                    <td>{collection.updatedAt.slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <FoundationNotice>Collections will appear after the main shop finishes OAuth installation.</FoundationNotice>
        )}
      </section>

      <section className="collective-dashboard-callout">
        <div>
          <p className="collective-eyebrow">Role separation</p>
          <h2>Supplier access remains a separate app.</h2>
          <p>
            Supplier catalog and inventory permissions belong to the future
            supplier Partner app. They are not granted to this retailer app or
            to retailer shops.
          </p>
        </div>
        <div className="collective-mini-flow" aria-label="Role separation flow">
          <span>Admin</span>
          <i>→</i>
          <span>Retailer app</span>
          <i>→</i>
          <span>Supplier app</span>
        </div>
      </section>
    </main>
  );
}
