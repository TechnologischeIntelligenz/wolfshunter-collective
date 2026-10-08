import {
  FoundationNotice,
  PageHeader,
  SectionHeading,
  StatusPill,
} from "../../components/collective/foundation";

export function SupplierDashboardView({
  shop,
  sessionType,
}: {
  shop: string;
  sessionType: string;
}) {
  return (
    <main className="collective-page">
      <PageHeader
        eyebrow="Supplier operations"
        title="Your supplier control center."
        description="Connect your Shopify catalog, control retailer availability, and keep inventory evidence in one supplier-only workspace."
        actions={<StatusPill tone="info">Supplier view</StatusPill>}
      />

      <FoundationNotice>
        This surface is isolated from the retailer app. The connected supplier
        store is {shop}; session: {sessionType}. A supplier can inspect only the
        SKUs owned by this authenticated supplier shop, never another supplier’s
        or Wolfshunter’s internal identifiers.
      </FoundationNotice>

      <section className="collective-section">
        <SectionHeading
          title="Supplier onboarding"
          description="The second app will turn these cards into verified Shopify catalog and inventory connections."
        />
        <div className="collective-admin-grid">
          <article className="collective-admin-card">
            <StatusPill tone="attention">Next build step</StatusPill>
            <h3>Connect product catalog</h3>
            <p>Read eligible products, variants, media, and supplier metadata from this Shopify store.</p>
          </article>
          <article className="collective-admin-card">
            <StatusPill tone="attention">Next build step</StatusPill>
            <h3>Publish price lists</h3>
            <p>Choose which products retailers may discover and define wholesale pricing and delivery rules.</p>
          </article>
          <article className="collective-admin-card">
            <StatusPill tone="attention">Next build step</StatusPill>
            <h3>Sync inventory</h3>
            <p>Send verified location inventory to the platform with tenant-scoped event history.</p>
          </article>
          <article className="collective-admin-card">
            <StatusPill tone="attention">Later approval</StatusPill>
            <h3>Fulfillment events</h3>
            <p>Order and fulfillment access stays disabled until the protected-data workflow is implemented and approved.</p>
          </article>
        </div>
      </section>
    </main>
  );
}
