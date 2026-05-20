"use client";

import WishlistHeartButton from "components/wishlist/wishlist-heart-button";

type Props = {
  productId: string;
};

export default function FavoriteButton({ productId }: Props) {
  return <WishlistHeartButton productId={productId} />;
}
