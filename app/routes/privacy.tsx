import type { MetaFunction } from "react-router";

export const meta: MetaFunction = () => [
  { title: "Privacy Notice — WOLFSHUNTER COLLECTIVE" },
  {
    name: "description",
    content: "Privacy notice for the WOLFSHUNTER COLLECTIVE Shopify app.",
  },
];

export default function PrivacyRoute() {
  return (
    <main className="collective-page collective-legal-page">
      <p className="collective-eyebrow">WOLFSHUNTER COLLECTIVE</p>
      <h1>Privacy notice</h1>
      <p className="collective-page-description">
        Last updated: 18 September 2026. This notice describes the Shopify app,
        not the consumer checkout of wolfshunter.com.
      </p>

      <section className="collective-section collective-legal-copy">
        <h2>Controller and contact</h2>
        <p>
          WOLFSHUNTER COLLECTIVE is operated by WORLDSHOP Trg. d.o.o. Contact:
          <a href="mailto:info@wolfshunter.com"> info@wolfshunter.com</a>.
          The business addresses are Jezerski bb, 77241 Bosanska Krupa, Bosnia
          and Herzegovina, and Virgilgasse 10, 5020 Salzburg, Austria.
        </p>

        <h2>Data processed by the app</h2>
        <p>
          To authenticate and operate the app, we process the connected Shopify
          shop domain, server-side Shopify session and token metadata, product,
          variant, media, collection and pricing data, retailer settings,
          import approvals, DRAFT status, support messages, and technical diagnostics.
          Order features request read access to Shopify orders and store order
          identifiers, dates, payment and fulfillment statuses, currency,
          totals, and item counts.
        </p>
        <p>
          It does not store customer names, email addresses, phone numbers,
          shipping or billing addresses, customer notes, or payment credentials
          in its order records. Support messages may contain information
          voluntarily entered by merchants; automated redaction removes
          recognized secrets, email addresses, and phone numbers.
        </p>

        <h2>Why and how data is used</h2>
        <p>
          Data is used to authenticate the merchant, show the merchant&apos;s own
          catalog workspace, create an explicitly approved unpublished Shopify
          DRAFT, provide support, keep imports idempotent,
          diagnose failures, and comply with Shopify and legal obligations. One
          merchant&apos;s shop data is not intentionally shown to another merchant.
          Publication and irreversible actions remain merchant- or
          operator-approved.
        </p>

        <h2>AI and service providers</h2>
        <p>
          If enabled, support or analysis messages may be sent server-side to
          the configured OpenAI and/or Google Gemini provider together with
          limited shop-scoped context. API keys, Shopify access tokens,
          Cloudflare credentials, and unrelated merchant data are not sent to
          the chat. Cloudflare may process network traffic as the app&apos;s edge
          provider. Shopify processes Shopify data under its own terms and
          privacy documentation.
        </p>

        <h2>Retention and deletion</h2>
        <p>
          We retain app records only for operation, support, security, dispute
          review, and legal obligations. When a shop uninstalls the app, the
          app&apos;s tenant records and session records are deleted through the
          uninstall/compliance path, subject to a documented legal retention
          duty. Data-subject requests can be sent to the contact above.
        </p>

        <h2>Your rights and related policies</h2>
        <p>
          Depending on applicable law, merchants and individuals may have
          rights to access, correct, delete, restrict, or object to processing.
          For the consumer store&apos;s general policies, see the canonical
          <a href="https://www.wolfshunter.com/policies/privacy-policy" rel="noreferrer">
            {" "}WOLFSHUNTER privacy policy
          </a>{" "}
          and
          <a href="https://www.wolfshunter.com/policies/contact-information" rel="noreferrer">
            {" "}contact/legal notice
          </a>
          .
        </p>
        <p className="collective-legal-note">
          This notice is an operational disclosure and is not legal advice.
          Please obtain legal review before public App Store submission.
        </p>
      </section>
    </main>
  );
}
