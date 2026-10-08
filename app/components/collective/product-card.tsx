import type { RankedProduct } from "../../services/merchandising/types";
import { ProductImageStage } from "./product-image-stage";
import { StatusPill } from "./foundation";

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

const formatMoney = (value: number, currency: string) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);

export function ProductCard({
  rankedProduct,
  favorite,
  staged,
  onToggleFavorite,
  onViewDetails,
  onToggleImportList,
}: {
  rankedProduct: RankedProduct;
  favorite: boolean;
  staged: boolean;
  onToggleFavorite: () => void;
  onViewDetails?: () => void;
  onToggleImportList: () => void;
}) {
  const { product, score } = rankedProduct;
  const selectionLabel =
    product.selection === "exclusive"
      ? "Exclusive"
      : product.selection === "premium"
        ? "Premium"
        : null;

  return (
    <article className="collective-product-card">
      <div className="collective-product-visual">
        <ProductImageStage
          src={product.imageUrl}
          alt={product.title}
          imageCount={product.imageCount}
          variantImageUrls={product.variantImageUrls}
        />
        <button
          type="button"
          className={`collective-favorite-button ${favorite ? "is-favorite" : ""}`}
          onClick={onToggleFavorite}
          aria-pressed={favorite}
          aria-label={favorite ? `Remove ${product.title} from favorites` : `Favorite ${product.title}`}
        >
          {favorite ? "♥" : "♡"}
        </button>
        {selectionLabel ? (
          <div className="collective-selection-badge">{selectionLabel}</div>
        ) : null}
      </div>

      <div className="collective-product-body">
        <div className="collective-product-heading">
          <div>
            <p>{product.category}</p>
            <h3>{product.title}</h3>
          </div>
          <span className="collective-fit-score" title="Deterministic merchandising score">
            {score.score}
            <small>fit</small>
          </span>
        </div>

        <dl className="collective-price-grid">
          <div>
            <dt>Source catalog</dt>
            <dd>{formatMoney(product.wholesalePrice, product.currency)}</dd>
          </div>
          <div>
            <dt>Target retail</dt>
            <dd>{formatMoney(product.recommendedRetailPrice, product.currency)}</dd>
          </div>
          <div className="collective-margin-cell">
            <dt>Potential margin</dt>
            <dd>
              {formatMoney(score.grossMarginAmount, product.currency)} ·{" "}
              {score.grossMarginPercent}%
            </dd>
          </div>
        </dl>

        <div className="collective-product-facts">
          <span>{product.warehouse}</span>
          {product.shipFromCountry ? <span>Ships from {regionNames.of(product.shipFromCountry) ?? product.shipFromCountry}</span> : null}
          <span>{product.deliveryEstimateLabel ?? (product.estimatedDeliveryDays === null ? "Delivery estimate at checkout" : `${product.estimatedDeliveryDays}-day estimate`)}</span>
          <span>{product.availableToSell} in stock</span>
          <span>{product.variantCount} variants</span>
        </div>

        <div className="collective-card-reason">
          <StatusPill tone="info">Rule-based</StatusPill>
          <span>{score.reasons[0] ?? "Catalog evaluation available"}</span>
        </div>

        <div className="collective-card-actions">
          {onViewDetails ? (
            <button
              type="button"
              className="collective-button collective-button-secondary"
              onClick={onViewDetails}
            >
              View details
            </button>
          ) : (
            <button
              type="button"
              className="collective-button collective-button-secondary"
              disabled
              title="Comparison is planned for a later phase"
            >
              Compare later
            </button>
          )}
          <button
            type="button"
            className="collective-button collective-button-primary"
            onClick={onToggleImportList}
            aria-pressed={staged}
          >
            {staged ? "Added to list" : "Add to Import List"}
          </button>
        </div>
      </div>
    </article>
  );
}
