"use client";

import Image from "next/image";
import { Fragment, useState } from "react";
// STYLED COMPONENTS
import { PreviewImage, ProductImageWrapper } from "./styles";

/** productName: product name for descriptive alt text (SEO & accessibility). */
type Props = { images: string[]; productName: string };

export default function ProductGallery({ images, productName }: Props) {
  const [currentImage, setCurrentImage] = useState(0);

  return (
    <Fragment>
      <ProductImageWrapper>
        {/* Main image: descriptive alt = product name */}
        <Image fill alt={productName} src={images[currentImage]} sizes="(400px 400px)" />
      </ProductImageWrapper>

      <div className="preview-images">
        {images.map((url, ind) => (
          <PreviewImage
            key={ind}
            onClick={() => setCurrentImage(ind)}
            selected={currentImage === ind}
          >
            {/* Gallery images: product name + image index */}
            <Image fill alt={`${productName} image ${ind + 1}`} src={url} sizes="(48px 48px)" />
          </PreviewImage>
        ))}
      </div>
    </Fragment>
  );
}
