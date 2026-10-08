import {
  EmptyState,
  FoundationNotice,
  PageHeader,
  SectionHeading,
  StatusPill,
} from "../../components/collective/foundation";
import type { ImportedProductPushState } from "../../services/retailer-commerce.server";

const adminProductUrl = (shop: string, productId: string) => {
  const numericId = productId.split("/").pop();
  return numericId ? `https://${shop}/admin/products/${numericId}` : null;
};

export function MyProductsView({
  shop,
  pushes = [],
}: {
  shop: string;
  pushes?: ImportedProductPushState[];
}) {
  return (
    <main className="collective-page">
      <PageHeader
        eyebrow="Retailer catalog"
        title="My Products"
        description="Products created for this Shopify store by an explicit, approval-gated import action."
        actions={<StatusPill tone="positive">Retailer view</StatusPill>}
      />
      <FoundationNotice>
        This list is scoped to {shop}. Products remain unpublished until the retailer publishes them in Shopify.
      </FoundationNotice>

      {pushes.length ? (
        <section className="collective-section">
          <SectionHeading
            title={`${pushes.length} product${pushes.length === 1 ? "" : "s"} in this store`}
            description="The app records the Shopify product ID so a retry cannot create a duplicate for the same imported source product."
          />
          <div className="collective-import-list">
            {pushes.map((push) => {
              const productUrl = push.shopifyProductId
                ? adminProductUrl(shop, push.shopifyProductId)
                : null;
              return (
                <article className="collective-import-row" key={push.id}>
                  <div>
                    <p className="collective-eyebrow">{push.sourceCategory}</p>
                    <h3>{push.sourceTitle}</h3>
                    <p>
                      {push.currency} {push.retailPrice.toFixed(2)} · {push.status.replaceAll("_", " ")}
                    </p>
                    {push.errorMessage ? <p className="collective-import-error">{push.errorMessage}</p> : null}
                  </div>
                  <div className="collective-import-row-actions">
                    <StatusPill tone={push.status === "DRAFT_CREATED" ? "positive" : "attention"}>
                      {push.status === "DRAFT_CREATED" ? "DRAFT" : push.status}
                    </StatusPill>
                    {productUrl ? (
                      <a className="collective-button collective-button-secondary" href={productUrl} target="_blank" rel="noreferrer">
                        Open in Shopify
                      </a>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : (
        <EmptyState
          eyebrow="No Shopify products yet"
          title="Your first draft will appear here."
          description="Choose a product in Discover, add it to the Import List, and approve its Shopify DRAFT creation there."
          actionLabel="Open Import Lists"
          actionHref="/app/import-lists"
        />
      )}
    </main>
  );
}
