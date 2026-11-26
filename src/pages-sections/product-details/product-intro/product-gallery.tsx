"use client";

import Image from "next/image";
import { Fragment, useRef, useState } from "react";
// STYLED COMPONENTS
import ProductGalleryActions from "./gallery-actions";
import { GalleryDot, GalleryDots, PreviewImage, PreviewImages, ProductImageWrapper } from "./styles";

const SWIPE_THRESHOLD_PX = 40;

/** productName: product name for descriptive alt text (SEO & accessibility). */
type Props = { images: string[]; productName: string; productId: string };

export default function ProductGallery({ images, productName, productId }: Props) {
  const [currentImage, setCurrentImage] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const safeIndex = images.length ? Math.min(currentImage, images.length - 1) : 0;

  function showImage(index: number) {
    if (images.length < 2) return;
    const next = (index + images.length) % images.length;
    setCurrentImage(next);
  }

  return (
    <Fragment>
      <ProductImageWrapper
        onTouchStart={(event) => {
          touchStartX.current = event.changedTouches[0]?.clientX ?? null;
        }}
        onTouchEnd={(event) => {
          const startX = touchStartX.current;
          touchStartX.current = null;
          if (startX == null || images.length < 2) return;

          const endX = event.changedTouches[0]?.clientX;
          if (endX == null) return;

          const deltaX = endX - startX;
          if (deltaX > SWIPE_THRESHOLD_PX) showImage(safeIndex - 1);
          else if (deltaX < -SWIPE_THRESHOLD_PX) showImage(safeIndex + 1);
        }}
      >
        {/* Main image: descriptive alt = product name */}
        <Image fill alt={productName} src={images[safeIndex]} sizes="(400px 400px)" />
        <ProductGalleryActions productId={productId} productName={productName} />
      </ProductImageWrapper>

      {images.length > 1 && (
        <GalleryDots role="tablist" aria-label="Slike proizvoda">
          {images.map((_, ind) => (
            <GalleryDot
              key={ind}
              type="button"
              role="tab"
              selected={safeIndex === ind}
              aria-label={`${productName}, slika ${ind + 1}`}
              aria-selected={safeIndex === ind}
              onClick={() => setCurrentImage(ind)}
            />
          ))}
        </GalleryDots>
      )}

      <PreviewImages>
        {images.map((url, ind) => (
          <PreviewImage
            key={ind}
            onClick={() => setCurrentImage(ind)}
            selected={safeIndex === ind}
          >
            {/* Gallery images: product name + image index */}
            <Image fill alt={`${productName}, slika ${ind + 1}`} src={url} sizes="(48px 48px)" />
          </PreviewImage>
        ))}
      </PreviewImages>
    </Fragment>
  );
}
