import type { MetaFunction } from "react-router";

export const meta: MetaFunction = () => [
  { title: "Support — WOLFSHUNTER COLLECTIVE" },
  { name: "description", content: "Support for WOLFSHUNTER COLLECTIVE Shopify merchants." },
];

export default function SupportRoute() {
  return (
    <main className="collective-page collective-legal-page">
      <p className="collective-eyebrow">WOLFSHUNTER COLLECTIVE</p>
      <h1>Merchant support</h1>
      <p className="collective-page-description">
        For installation, authentication, product imports, DRAFTs, orders, or
        supplier issues, contact the team with the shop domain and the exact
        status code. Never send an API key or access token.
      </p>
      <section className="collective-section collective-legal-copy">
        <h2>Contact</h2>
        <p><a href="mailto:info@wolfshunter.com">info@wolfshunter.com</a></p>
        <h2>Safe support checklist</h2>
        <ul>
          <li>Shop domain and the page or action that failed.</li>
          <li>HTTP status code and approximate time.</li>
          <li>What was clicked immediately before the error.</li>
          <li>Do not include passwords, Shopify tokens, API keys, or Cloudflare tokens.</li>
        </ul>
        <p><a href="/privacy">Privacy notice</a> · <a href="/terms">App terms</a></p>
      </section>
    </main>
  );
}
