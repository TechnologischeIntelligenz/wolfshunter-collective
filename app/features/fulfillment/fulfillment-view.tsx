import { FoundationNotice, PageHeader, SectionHeading, StatusPill } from "../../components/collective/foundation";

const fulfillmentStages = [
  ["Order received", "Retailer order verified and mapped lines isolated"],
  ["Stock reserved", "Supplier inventory reservation confirmed"],
  ["Payment required / paid", "Network Order payment state resolved"],
  ["Supplier accepted", "Supplier accepts only eligible mapped items"],
  ["Picking", "Warehouse preparation in progress"],
  ["Packed", "Parcel and shipment details prepared"],
  ["Shipped", "Carrier handoff confirmed"],
  ["Tracking synced", "Tracking verified before Shopify synchronization"],
  ["Delivered", "Carrier delivery evidence received"],
] as const;

const exceptionStates = [
  ["On hold", "attention"],
  ["Canceled", "neutral"],
  ["Failed", "critical"],
  ["Return requested", "info"],
] as const;

export function FulfillmentView() {
  return (
    <main className="collective-page">
      <PageHeader
        eyebrow="Fulfillment control center"
        title="A precise lifecycle for every mapped line."
        description="Operational states are designed around Shopify Fulfillment Orders without routing or changing a live order."
      />
      <FoundationNotice>
        Lifecycle preview only. No customer data, Shopify orders, or fulfillment mutations are used.
      </FoundationNotice>

      <section className="collective-section collective-fulfillment-preview">
        <SectionHeading
          title="Fulfillment lifecycle"
          description="The future system advances only from verified supplier and carrier events."
          accessory={<StatusPill tone="neutral">UI fixture</StatusPill>}
        />
        <ol className="collective-fulfillment-timeline">
          {fulfillmentStages.map(([title, description], index) => (
            <li key={title} className={index === 0 ? "is-current" : ""}>
              <span className="collective-timeline-node">{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h3>{title}</h3>
                <p>{description}</p>
              </div>
              <small>{index === 0 ? "Preview start" : "Awaiting verified event"}</small>
            </li>
          ))}
        </ol>
      </section>

      <section className="collective-section">
        <SectionHeading
          title="Exception handling"
          description="Exceptions interrupt the normal flow and always require an explicit reason."
        />
        <div className="collective-exception-grid">
          {exceptionStates.map(([label, tone]) => (
            <article key={label}>
              <StatusPill tone={tone}>{label}</StatusPill>
              <p>No fixture records in this state.</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
