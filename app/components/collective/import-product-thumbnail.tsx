import { ProductImageStage } from "./product-image-stage";

export function ImportProductThumbnail({
  src,
  alt,
  imageCount,
  variantImageUrls = [],
}: {
  src: string | null;
  alt: string;
  imageCount: number;
  variantImageUrls?: string[];
}) {
  return (
    <div className="collective-import-thumbnail">
      <ProductImageStage
        src={src}
        alt={alt}
        imageCount={imageCount}
        variantImageUrls={variantImageUrls}
      />
    </div>
  );
}
