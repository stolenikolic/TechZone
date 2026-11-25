export type ReviewStar = 1 | 2 | 3 | 4 | 5;

export type PublishedReview = {
  id: string;
  rating: number;
  comment: string | null;
  authorName: string;
  authorAvatar: string | null;
  createdAt: string;
  verifiedPurchase: boolean;
};

export type ProductReviewSummary = {
  average: number;
  count: number;
  distribution: Record<ReviewStar, number>;
  reviews: PublishedReview[];
};

export type ViewerReview = {
  rating: number;
  comment: string | null;
  status: "published" | "hidden";
};

export type ViewerReviewState = {
  review: ViewerReview | null;
};
