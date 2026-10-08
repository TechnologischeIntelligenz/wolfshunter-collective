import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { Form, redirect, useLoaderData } from "react-router";

import { login } from "../../shopify.server";
import styles from "./styles.module.css";

export const meta: MetaFunction = () => [
  { title: "WOLFSHUNTER COLLECTIVE — Premium Retailer Workspace" },
  {
    name: "description",
    content:
      "WOLFSHUNTER COLLECTIVE — A premium retailer catalog and merchandising workspace for Shopify merchants. Curate products and protect margins in a calm, commerce-native workflow.",
  },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  const isDevelopment = process.env.NODE_ENV !== "production";
  const defaultDevShop =
    process.env.SHOPIFY_DEV_STORE || "wolfshunter-ai-dev.myshopify.com";

  return {
    authHref: isDevelopment
      ? `/auth/login?shop=${encodeURIComponent(defaultDevShop)}`
      : "/auth/login",
    defaultDevShop: isDevelopment ? defaultDevShop : "",
    isDevelopment,
    showForm: Boolean(login) && isDevelopment,
  };
};

export default function LandingRoute() {
  const { authHref, defaultDevShop, isDevelopment, showForm } = useLoaderData<typeof loader>();

  return (
    <main className={styles.page}>
      <section className={styles.brandPanel}>
        <div className={styles.wordmark}>
          <img
            className={styles.wordmarkLogo}
            src="/wolfshunter-collective-logo.png"
            alt=""
            width="64"
            height="64"
          />
          <div>
            <strong>WOLFSHUNTER</strong>
            <small>COLLECTIVE</small>
          </div>
        </div>
        <div className={styles.statement}>
          <p className={styles.tagline}>Premium Retailer Workspace</p>
          <h1>Build an assortment with commercial discipline.</h1>
          <span>
            Curate supplier products and protect margins in a calm,
            commerce-native workspace for Shopify merchants.
          </span>
        </div>
        <div className={styles.principles}>
          <span>Tenant-first</span>
          <span>Policy-gated</span>
          <span>Merchant-controlled</span>
        </div>
      </section>

      <section className={styles.accessPanel}>
        <div className={styles.accessCard}>
          <p className={styles.eyebrow}>Retailer access</p>
          <h2>Open your Collective workspace.</h2>
          <p className={styles.copy}>
            {isDevelopment
              ? "Enter your Shopify store domain to continue through Shopify's secure installation and authentication flow."
              : "Install WOLFSHUNTER COLLECTIVE from Shopify, then open the app from your Shopify admin. Authentication stays inside Shopify's secure flow."}
          </p>
          {isDevelopment ? (
            <div className={styles.devShortcut}>
              <div>
                <span className={styles.devLabel}>Local dev auth</span>
                <strong>{defaultDevShop}</strong>
              </div>
              <a className={styles.linkButton} href={authHref}>
                Open auth link
              </a>
            </div>
          ) : (
            <div className={styles.devShortcut}>
              <div>
                <span className={styles.devLabel}>Shopify installation</span>
                <strong>Open from Shopify Admin</strong>
              </div>
            </div>
          )}
          {showForm ? (
            <Form className={styles.form} method="post" action="/auth/login">
              <label className={styles.label}>
                <span>Shop domain</span>
                <input
                  className={styles.input}
                  type="text"
                  name="shop"
                  placeholder="your-store.myshopify.com"
                  autoComplete="url"
                  required
                />
              </label>
              <button className={styles.button} type="submit">
                Continue with Shopify
              </button>
            </Form>
          ) : null}
          <div className={styles.safetyNote}>
            <span aria-hidden="true" />
            <p>DRAFT-first retailer workflow — nothing is published automatically.</p>
          </div>
          <nav className={styles.legalLinks} aria-label="Legal and support">
            <a href="/privacy">Privacy</a>
            <a href="/terms">App terms</a>
            <a href="/support">Support</a>
          </nav>
        </div>
      </section>
    </main>
  );
}
