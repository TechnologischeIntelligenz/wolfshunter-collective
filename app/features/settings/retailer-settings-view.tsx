import { SourceCommercePanel } from "../../components/collective/source-commerce-panel";
import type { SourceCommerce } from "../../services/source-commerce.server";
import { useFetcher } from "react-router";

import {
  FoundationNotice,
  PageHeader,
  SectionHeading,
  StatusPill,
} from "../../components/collective/foundation";
import type { RetailerSettingsState } from "../../services/retailer-commerce.server";

export function RetailerSettingsView({
  commerce,
  shop,
  settings,
}: {
  commerce: SourceCommerce | null;
  shop: string;
  settings: RetailerSettingsState;
}) {
  const fetcher = useFetcher();
  const result = fetcher.data as
    | { ok?: boolean; error?: string }
    | undefined;

  return (
    <main className="collective-page">
      <PageHeader
        eyebrow="Retailer configuration"
        title="Settings"
        description="These settings belong only to the currently connected Shopify store. App administration is kept in a separate, protected surface."
        actions={<StatusPill tone="positive">Retailer view</StatusPill>}
      />
      <FoundationNotice>
        Store: {shop}. Product imports remain explicit DRAFT creations; nothing is published automatically.
      </FoundationNotice>

      <fetcher.Form method="post" className="collective-settings-form">
        <section className="collective-section">
          <SectionHeading
            title="Store context"
            description="Used to rank and validate the assortment for this retailer."
          />
          <div className="collective-settings-grid">
            <label>
              <span>Primary delivery country</span>
              <select name="marketCountry" defaultValue={settings.marketCountry}>
                {!commerce?.eligibleCountries.some(c => c.code === settings.marketCountry) ? <option value={settings.marketCountry}>{settings.marketCountry} � not in synchronized shipping destinations</option> : null}
                {commerce?.eligibleCountries.map(country => <option key={country.code} value={country.code}>{country.name} ({country.code})</option>)}
              </select>
            </label>
            <label>
              <span>Fulfillment</span>
              <select name="warehouse" defaultValue="Shopify fulfillment">
                <option value="Shopify fulfillment">Product-specific Shopify fulfillment</option>
              </select>
            </label>
            <label>
              <span>Minimum target margin (%)</span>
              <input
                name="marginPercent"
                type="number"
                min="0"
                max="100"
                step="1"
                defaultValue={settings.marginPercent}
              />
            </label>
          </div>
        </section>

        <section className="collective-section">
          <SectionHeading
            title="Approval policy"
            description="Merchant control stays explicit at every Shopify write boundary."
          />
          <div className="collective-settings-policy">
            <div className="collective-settings-check">
              <input
                id="require-approval"
                name="requireApproval"
                type="checkbox"
                defaultChecked={settings.requireApproval}
              />
              <label htmlFor="require-approval">
                <strong>Require approval before product creation</strong>
                <small>Recommended. The Import List button is the approval step.</small>
              </label>
            </div>
            <div className="collective-settings-locked">
              <StatusPill tone="attention">Locked</StatusPill>
              <span>Automatic publication is disabled. Publication scopes are not requested.</span>
            </div>
          </div>
        </section>

        <div className="collective-settings-actions">
          <button className="collective-button collective-button-primary" type="submit" disabled={fetcher.state !== "idle" || !commerce?.eligibleCountries.length}>
            {fetcher.state === "idle" ? "Save retailer settings" : "Saving…"}
          </button>
          {result?.ok ? <StatusPill tone="positive">Saved</StatusPill> : null}
          {result?.error ? <StatusPill tone="critical">{result.error}</StatusPill> : null}
        </div>
      </fetcher.Form>
      <SourceCommercePanel commerce={commerce} />
    </main>
  );
}
