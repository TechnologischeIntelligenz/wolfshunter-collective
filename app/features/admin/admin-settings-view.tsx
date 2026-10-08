import { SourceCommercePanel } from "../../components/collective/source-commerce-panel";
import type { SourceCommerce } from "../../services/source-commerce.server";
import {
  FoundationNotice,
  PageHeader,
  SectionHeading,
  StatusPill,
} from "../../components/collective/foundation";

export function AdminSettingsView({
  commerce,
  configuration,
}: {
  commerce: SourceCommerce | null;
  configuration: {
    allowlistConfigured: boolean;
    allowlistMode: string;
    aiProviderConfigured: boolean;
    productWritesScoped: boolean;
    automaticPublicationEnabled: boolean;
  };
}) {
  return (
    <main className="collective-page">
      <PageHeader
        eyebrow="WOLFSHUNTER COLLECTIVE administration"
        title="App administration"
        description="Platform-wide controls for the app operator. Retailer settings, catalog selections, and merchant approvals stay outside this surface."
        actions={<StatusPill tone="attention">Protected admin view</StatusPill>}
      />
      <FoundationNotice>
        This route is available only through the server-side admin allowlist
        ({configuration.allowlistMode}). Retailer stores never receive these
        controls.
      </FoundationNotice>

      <section className="collective-section">
        <SectionHeading
          title="Operational boundaries"
          description="These controls are intentionally separate from a retailer's connected Shopify store."
        />
        <div className="collective-admin-grid">
          <article className="collective-admin-card">
            <StatusPill tone={configuration.allowlistConfigured ? "positive" : "critical"}>
              {configuration.allowlistConfigured ? "Allowlist configured" : "Allowlist missing"}
            </StatusPill>
            <h3>Admin identity</h3>
            <p>Access requires an explicit server-side email or shop allowlist. The Shopify store owner is not inferred from a public request.</p>
          </article>
          <article className="collective-admin-card">
            <StatusPill tone={configuration.productWritesScoped ? "positive" : "critical"}>
              {configuration.productWritesScoped ? "Scoped" : "Review required"}
            </StatusPill>
            <h3>Product writes</h3>
            <p>Only the retailer-approved Import List can create a product, and the created state is DRAFT.</p>
          </article>
          <article className="collective-admin-card">
            <StatusPill tone={configuration.automaticPublicationEnabled ? "critical" : "positive"}>
              {configuration.automaticPublicationEnabled ? "Enabled" : "Disabled"}
            </StatusPill>
            <h3>Automatic publication</h3>
            <p>Publication remains disabled because the app does not request publication write scope.</p>
          </article>
          <article className="collective-admin-card">
            <StatusPill tone={configuration.aiProviderConfigured ? "info" : "neutral"}>
              {configuration.aiProviderConfigured ? "Configured" : "Optional"}
            </StatusPill>
            <h3>AI provider</h3>
            <p>The current catalog ranking remains deterministic. An OpenAI key alone does not activate runtime AI calls.</p>
          </article>
        </div>
      </section>
      <SourceCommercePanel commerce={commerce} admin />
    </main>
  );
}
