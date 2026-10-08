import { useState } from "react";
import { Link, useFetcher } from "react-router";

import {
  EmptyState,
  FoundationNotice,
  PageHeader,
  SectionHeading,
  StatusPill,
} from "../../components/collective/foundation";
import { ImportProductThumbnail } from "../../components/collective/import-product-thumbnail";
import type { CatalogProduct } from "../../services/merchandising/types";
import type { ImportedProductPushState } from "../../services/retailer-commerce.server";
import type { ShopifyCollectionOption } from "../../services/shopify-collection-options.server";

const workflow = [
  ["01", "Discover", "Find eligible supplier products"],
  ["02", "Favorite", "Save a considered shortlist"],
  ["03", "Import list", "Group products by launch or collection"],
  ["04", "Edit", "Normalize titles, copy, media, and SEO"],
  ["05", "Select variants", "Choose only commercially relevant options"],
  ["06", "Pricing", "Review margin policy and recommended retail"],
  ["07", "Preview", "Validate the exact DRAFT product payload"],
  ["08", "Create draft", "Explicit Shopify DRAFT creation"],
] as const;

export function ImportListsView({
  stagedProducts = [],
  pushes = [],
  collections = [],
}: {
  stagedProducts?: CatalogProduct[];
  pushes?: ImportedProductPushState[];
  collections?: ShopifyCollectionOption[];
}) {
  const fetcher = useFetcher();
  const [collectionId, setCollectionId] = useState("");
  const result = fetcher.data as
    | { ok?: boolean; error?: string; warning?: string }
    | undefined;
  const stagedCount = stagedProducts.length;
  const pushingProductId = fetcher.formData?.get("productId");
  const pushBySourceId = new Map(pushes.map((push) => [push.sourceProductId, push]));

  return (
    <main className="collective-page">
      <PageHeader
        eyebrow="Controlled product staging"
        title="Import Lists"
        description="Shape assortments in a reviewable workspace before any Shopify product exists."
        actions={
          <Link className="collective-button collective-button-secondary" to="/app/discover">
            Browse catalog
          </Link>
        }
      />
      <FoundationNotice>
        Each button below is a deliberate merchant approval. Shopify creates an unpublished DRAFT; no live publication is performed.
      </FoundationNotice>

      <section className="collective-section collective-workflow-section">
        <SectionHeading
          title="A deliberate import workflow"
          description="Every stage is reviewable; the final button creates one unpublished Shopify DRAFT."
          accessory={
            <StatusPill tone="info">
              {stagedCount ? `${stagedCount} staged` : "DRAFT workflow ready"}
            </StatusPill>
          }
        />
        <ol className="collective-workflow-grid">
          {workflow.map(([number, title, description], index) => (
            <li key={title} className={index === workflow.length - 1 ? "is-locked" : ""}>
              <span>{number}</span>
              <div>
                <h3>{title}</h3>
                <p>{description}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {stagedCount ? (
        <section className="collective-section">
          <SectionHeading
            title={`${stagedCount} product${stagedCount === 1 ? "" : "s"} staged`}
            description="The selection is saved to this Shopify store workspace. Review each product before creating its Shopify draft."
          />
          <label className="collective-sort-control" htmlFor="import-collection">
            <span>Shopify collection (optional)</span>
            <select
              id="import-collection"
              value={collectionId}
              onChange={(event) => setCollectionId(event.target.value)}
            >
              <option value="">No collection</option>
              {collections.map((collection) => (
                <option key={collection.id} value={collection.id}>
                  {collection.title}
                </option>
              ))}
            </select>
          </label>
          <p className="collective-page-description">
            Title, category, primary image, and target price are transferred to
            an unpublished Shopify DRAFT. Review variants, additional media,
            copy, and legal details in Shopify Admin. The optional collection is
            linked directly.
          </p>
          <div className="collective-import-list">
            {stagedProducts.map((product) => {
              const push = pushBySourceId.get(product.id);
              const isCreating = fetcher.state !== "idle" && pushingProductId === product.id;
              const isCreated = push?.status === "DRAFT_CREATED" && push.shopifyProductId;

              return (
                <article className="collective-import-row" key={product.id}>
                  <ImportProductThumbnail
                    src={product.imageUrl}
                    alt={product.title}
                    imageCount={product.imageCount}
                    variantImageUrls={product.variantImageUrls}
                  />
                  <div>
                    <p className="collective-eyebrow">{product.category}</p>
                    <h3>{product.title}</h3>
                    <p>
                      {product.currency} {product.recommendedRetailPrice.toFixed(2)} - {product.variantCount} variants - {product.warehouse}
                    </p>
                  </div>
                  <div className="collective-import-row-actions">
                    {isCreated ? (
                      <StatusPill tone={push?.errorMessage ? "attention" : "positive"}>
                        {push?.errorMessage ? "DRAFT created - review" : "Shopify DRAFT created"}
                      </StatusPill>
                    ) : null}
                    {push?.status === "FAILED" ? (
                      <StatusPill tone="critical">Retry available</StatusPill>
                    ) : null}
                    {!isCreated ? (
                      <fetcher.Form method="post">
                        <input type="hidden" name="intent" value="push-product" />
                        <input type="hidden" name="productId" value={product.id} />
                        <input type="hidden" name="collectionId" value={collectionId} />
                        <button className="collective-button collective-button-primary" type="submit" disabled={fetcher.state !== "idle"}>
                          {isCreating ? "Creating draft..." : "Create Shopify draft"}
                        </button>
                      </fetcher.Form>
                    ) : null}
                  </div>
                  {isCreated && push?.errorMessage ? (
                    <p className="collective-import-warning" role="status">
                      {push.errorMessage}
                    </p>
                  ) : null}
                </article>
              );
            })}
          </div>
          {result?.error ? (
            <div className="collective-import-error" role="alert">
              {result.error}
            </div>
          ) : null}
          <Link className="collective-button collective-button-secondary" to="/app/discover">
            Continue browsing
          </Link>
        </section>
      ) : (
        <EmptyState
          eyebrow="No import lists yet"
          title="Start with a product, not a spreadsheet."
          description="Add a product from Discover when you are ready. The selection is saved per retailer workspace; the Shopify write happens only through an explicit DRAFT button."
          actionLabel="Open Discover"
          actionHref="/app/discover"
        />
      )}
    </main>
  );
}
