import type { SourceCommerce } from "../../services/source-commerce.server";
import { FoundationNotice, SectionHeading } from "./foundation";

const policyPath: Record<string, string> = { SHIPPING_POLICY: "shipping-policy", REFUND_POLICY: "refund-policy", PRIVACY_POLICY: "privacy-policy", TERMS_OF_SERVICE: "terms-of-service", LEGAL_NOTICE: "legal-notice", CONTACT_INFORMATION: "contact-information" };
export function SourceCommercePanel({ commerce, admin = false }: { commerce: SourceCommerce | null; admin?: boolean }) {
  if (!commerce) return <FoundationNotice>Shipping countries, markets and policies have not been synchronized yet.</FoundationNotice>;
  return <section className="collective-section">
    <SectionHeading title="Shipping, markets and policies" description={`Synchronized from WOLFSHUNTER on ${new Date(commerce.syncedAt).toLocaleString()}.`} />
    <FoundationNotice>{commerce.processingLabel} Availability and charges depend on the product, shipping profile, destination and order conditions.</FoundationNotice>
    <div className="collective-service-summary">
      <span>{commerce.eligibleCountries.length} shipping countries / territories in active markets</span>
      <span>{commerce.markets.filter(m => m.status === "ACTIVE").length} active markets</span>
      <span>{commerce.profiles.length} shipping profiles</span>
    </div>
    <details><summary>Countries and markets</summary>
      {commerce.markets.map(m => <article key={m.id}><h3>{m.name} · {m.status}</h3><p>{m.countries.filter(c => commerce.shippingCountries.includes(c.code)).map(c => c.name).join(", ") || "No direct shipping countries"}</p></article>)}
    </details>
    <details><summary>Shipping zones and services</summary>
      {commerce.profiles.map(p => <article key={p.id}><h3>{p.name}{p.default ? " · Default profile" : ""}</h3>
        {p.zones.map(({ zone, methods }) => <div key={zone.id}><strong>{zone.name}</strong><p>{zone.countries.map(c => c.code.restOfWorld ? "Rest of world (subject to active markets)" : c.name).join(", ")}</p>
          <ul>{methods.filter(m => m.active).map(m => <li key={m.id}>{m.name}{m.rateProvider?.price ? ` · ${m.rateProvider.price.amount} ${m.rateProvider.price.currencyCode}` : " · Carrier / checkout rate"}{m.description ? ` · ${m.description}` : ""}{m.methodConditions?.length ? " · Order conditions apply" : ""}</li>)}</ul>
        </div>)}
      </article>)}
    </details>
    {admin ? <details><summary>Actual fulfillment locations</summary><ul>{commerce.locations.filter(l => l.isActive && l.fulfillsOnlineOrders).map(l => <li key={l.id}>{l.name} ({l.address.countryCode})</li>)}</ul></details> : null}
    <div className="collective-legal-copy">
      <h3>Published WOLFSHUNTER policies</h3>
      {commerce.policies.map(p => <details key={p.id}><summary>{p.title || p.type.replaceAll("_", " ")}</summary>
        <p style={{ whiteSpace: "pre-wrap" }}>{p.body.replace(/<\/(p|li|h[1-6])>/gi, "\n").replace(/<[^>]+>/g, "").replaceAll("&amp;", "&").replaceAll("&nbsp;", " ")}</p>
        <a href={policyPath[p.type] ? `https://www.wolfshunter.com/policies/${policyPath[p.type]}` : p.url} target="_blank" rel="noreferrer">View published policy</a>
      </details>)}
    </div>
  </section>;
}

