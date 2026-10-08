import type { MetaFunction } from "react-router";

export const meta: MetaFunction = () => [
  { title: "App terms — WOLFSHUNTER COLLECTIVE" },
  { name: "description", content: "Terms for the WOLFSHUNTER COLLECTIVE Shopify app." },
];

export default function TermsRoute() {
  return (
    <main className="collective-page collective-legal-page">
      <p className="collective-eyebrow">WOLFSHUNTER COLLECTIVE</p>
      <h1>App terms</h1>
      <p className="collective-page-description">Last updated: 21 August 2026.</p>
      <section className="collective-section collective-legal-copy">
        <h2>Service</h2>
        <p>
          Collective helps Shopify merchants review supplier products, prepare
          import lists, and create unpublished Shopify DRAFT products. Shopify
          remains the system of record for a merchant&apos;s store, checkout,
          products, and orders. Order and fulfillment features are not enabled
          in the current App Store version.
        </p>
        <h2>Merchant control</h2>
        <p>
          The merchant is responsible for reviewing product content, prices,
          margins, collections, legal claims, and publication in Shopify. The
          app does not publish products automatically. AI suggestions are
          advisory and are not a final fraud, refund, liability, or dispute
          decision.
        </p>
        <h2>Fairness and emergencies</h2>
        <p>
          A documented supplier failure may create a reversible protection or
          review case under a published policy. It does not authorize silent
          withholding of money, automatic bans, or a final damages decision.
          Affected parties must receive a reason and a review path.
        </p>
        <h2>Contact</h2>
        <p>
          Questions about the app can be sent to
          <a href="mailto:info@wolfshunter.com"> info@wolfshunter.com</a>.
          The general store terms are available in the
          <a href="https://www.wolfshunter.com/policies/terms-of-service" rel="noreferrer">
            {" "}WOLFSHUNTER terms of service
          </a>
          .
        </p>
        <p className="collective-legal-note">
          These app terms require legal review and confirmation of the final
          commercial and billing model before App Store publication.
        </p>
      </section>
    </main>
  );
}
