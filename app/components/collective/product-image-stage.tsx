import { useEffect, useRef, useState } from "react";

export function ProductImageStage({
  src,
  alt,
  imageCount,
  variantImageUrls = [],
  eager = false,
}: {
  src: string | null;
  alt: string;
  imageCount: number;
  variantImageUrls?: string[];
  eager?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(!src);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const image = imageRef.current;

    if (!src) {
      setFailed(true);
      return;
    }

    if (image?.complete) {
      if (image.naturalWidth > 0) {
        setLoaded(true);
      } else {
        setFailed(true);
      }
    }
  }, [src]);

  return (
    <div className="collective-product-image-stage">
      {!loaded && !failed ? (
        <span className="collective-image-skeleton" aria-hidden="true" />
      ) : null}
      {failed ? (
        <div className="collective-image-fallback" role="img" aria-label={alt}>
          <span>W / C</span>
          <small>Image pending</small>
        </div>
      ) : (
        <img
          ref={imageRef}
          src={src ?? undefined}
          alt={alt}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={loaded ? "collective-image-loaded" : ""}
        />
      )}
      {imageCount > 1 ? (
        <span className="collective-image-count" aria-label={`${imageCount} images`}>
          {imageCount} images
        </span>
      ) : null}
      {variantImageUrls.length ? (
        <div className="collective-variant-previews" aria-label="Variant image previews">
          {variantImageUrls.slice(0, 3).map((variantImageUrl, index) => (
            <img
              key={variantImageUrl}
              src={variantImageUrl}
              alt={`${alt} variant ${index + 1}`}
              loading="lazy"
              onError={(event) => {
                event.currentTarget.hidden = true;
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
