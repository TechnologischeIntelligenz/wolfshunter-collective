import { useFetcher, useLoaderData } from "react-router";
import {
  FoundationNotice,
  PageHeader,
  SectionHeading,
  StatusPill,
} from "../components/collective/foundation";
import { authenticatedRetailerLoader } from "../services/authenticated-app-loader.server";
import { requireRetailerSession } from "../services/app-role.server";
import { authenticate, MONTHLY_PLAN } from "../shopify.server";

function billingIsTestMode() {
  return process.env.NODE_ENV !== "production" || process.env.BILLING_TEST_MODE === "true";
}

export async function loader(args: Parameters<typeof authenticatedRetailerLoader>[0]) {
  const data = await authenticatedRetailerLoader(args);
  const { billing } = await authenticate.admin(args.request);

  try {
    const result = await billing.check({
      plans: [MONTHLY_PLAN],
      isTest: billingIsTestMode(),
    });

    return {
      shop: data.shop,
      testMode: billingIsTestMode(),
      hasActivePayment: result.hasActivePayment,
      subscription: result.appSubscriptions[0]
        ? {
            name: result.appSubscriptions[0].name,
            status: result.appSubscriptions[0].status,
          }
        : null,
    };
  } catch (error) {
    console.error("[billing] status check failed", {
      name: error instanceof Error ? error.name : "unknown",
    });
    return {
      shop: data.shop,
      testMode: billingIsTestMode(),
      hasActivePayment: false,
      subscription: null,
    };
  }
}

export async function action({ request }: { request: Request }) {
  const { billing, session } = await authenticate.admin(request);
  requireRetailerSession(session);
  return billing.request({
    plan: MONTHLY_PLAN,
    isTest: billingIsTestMode(),
    trialDays: 14,
    returnUrl: new URL("/app/subscription", request.url).toString(),
  });
}

export default function SubscriptionRoute() {
  const data = useLoaderData<typeof loader>();
  const fetcher = useFetcher();

  return (
    <main className="collective-page">
      <PageHeader
        eyebrow="Account plan"
        title="WOLFSHUNTER COLLECTIVE Pro"
        description="One transparent plan for the retailer workspace, live catalog, DRAFT workflow, diagnostics, and guided support."
        actions={<StatusPill tone={data.hasActivePayment ? "positive" : "attention"}>{data.hasActivePayment ? "Active" : "Not active"}</StatusPill>}
      />
      <FoundationNotice>
        Billing is handled by Shopify, not by a separate Stripe or PayPal
        connection. {data.testMode ? "This development store is in no-charge test mode." : "This is the production billing flow."}
      </FoundationNotice>
      <section className="collective-section">
        <SectionHeading
          title="Simple merchant pricing"
          description="The trial and charge must be approved by the merchant on Shopify's hosted confirmation screen."
        />
        <article className="collective-admin-card">
          <StatusPill tone="info">14-day trial</StatusPill>
          <h2>99 USD / 30 days</h2>
          <p>
            After the trial, Shopify applies the recurring charge to the
            merchant&apos;s Shopify billing account. The app does not receive or
            store card, Stripe, or PayPal credentials.
          </p>
          {!data.hasActivePayment ? (
            <fetcher.Form method="post">
              <button className="collective-button collective-button-primary" type="submit" disabled={fetcher.state !== "idle"}>
                {fetcher.state === "idle" ? "Continue to Shopify billing" : "Opening Shopify billing…"}
              </button>
            </fetcher.Form>
          ) : null}
        </article>
      </section>
      <section className="collective-section">
        <SectionHeading
          title="Supplier payouts are separate"
          description="If Collective later pays suppliers, that will use a separate, consent-based payout onboarding flow such as Stripe Connect or PayPal. It is not part of the retailer's app subscription and is not enabled by this plan."
        />
      </section>
    </main>
  );
}
