import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Rating from "@mui/material/Rating";
import Typography from "@mui/material/Typography";
import { getPublishedProductReviews } from "lib/reviews/queries";
import type { ProductReviewSummary, ReviewStar } from "lib/reviews/types";
import ReviewForm from "./review-form";
import { ReviewRoot } from "./styles";

const STARS: ReviewStar[] = [5, 4, 3, 2, 1];
const FALLBACK_AVATAR = "/assets/images/avatars/001-man.svg";

function reviewCountLabel(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} recenzija`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} recenzije`;
  return `${count} recenzija`;
}

function formatReviewDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("bs-BA", { day: "numeric", month: "long", year: "numeric" });
}

function ReviewSummary({ summary }: { summary: ProductReviewSummary }) {
  if (summary.count <= 0) return null;
  const max = Math.max(...STARS.map((star) => summary.distribution[star]), 1);

  return (
    <Box sx={{ display: "flex", gap: 4, flexWrap: "wrap", mb: 4, maxWidth: 720 }}>
      <Box sx={{ minWidth: 140 }}>
        <Typography variant="h2" sx={{ lineHeight: 1 }}>
          {summary.average.toFixed(1)}
        </Typography>
        <Rating
          readOnly
          precision={0.1}
          value={summary.average}
          color="warn"
          size="small"
          sx={{ mt: 1 }}
        />
        <Typography variant="body2" sx={{ mt: 0.5, color: "grey.700" }}>
          {reviewCountLabel(summary.count)}
        </Typography>
      </Box>

      <Box sx={{ flex: 1, minWidth: 220 }}>
        {STARS.map((star) => {
          const count = summary.distribution[star];
          const width = `${Math.round((count / max) * 100)}%`;
          return (
            <Box key={star} sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.75 }}>
              <Typography variant="body2" sx={{ width: 12 }}>
                {star}
              </Typography>
              <Box sx={{ flex: 1, height: 8, bgcolor: "grey.200", borderRadius: 99, overflow: "hidden" }}>
                <Box sx={{ width, height: "100%", bgcolor: "primary.main" }} />
              </Box>
              <Typography variant="body2" sx={{ width: 28, textAlign: "right", color: "grey.700" }}>
                {count}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

export default async function ProductReviews({
  productId,
  productSlug
}: {
  productId: string;
  productSlug: string;
}) {
  const summary = await getPublishedProductReviews(productId);

  return (
    <div>
      <ReviewSummary summary={summary} />

      {summary.reviews.length === 0 ? (
        <Typography variant="body1" sx={{ color: "grey.700" }}>
          Još nema recenzija za ovaj proizvod.
        </Typography>
      ) : (
        summary.reviews.map((review) => (
          <ReviewRoot key={review.id}>
            <div className="user-info">
              <Avatar
                className="user-avatar"
                alt={review.authorName}
                src={review.authorAvatar || FALLBACK_AVATAR}
                sx={{ bgcolor: "primary.main", color: "common.white" }}
              >
                {review.authorName.slice(0, 1).toUpperCase()}
              </Avatar>
              <div>
                <Typography variant="h5" sx={{ mb: 1 }}>
                  {review.authorName}
                </Typography>
                <div className="user-rating">
                  <Rating size="small" value={review.rating} color="warn" readOnly />
                  <Typography variant="h6">{review.rating}</Typography>
                  <Typography component="span">{formatReviewDate(review.createdAt)}</Typography>
                </div>
                {review.verifiedPurchase ? (
                  <Chip label="Potvrđena kupovina" size="small" color="success" variant="outlined" sx={{ mt: 1 }} />
                ) : null}
              </div>
            </div>

            {review.comment ? (
              <Typography variant="body1" sx={{ color: "grey.700" }}>
                {review.comment}
              </Typography>
            ) : null}
          </ReviewRoot>
        ))
      )}

      {summary.count > summary.reviews.length ? (
        <Typography variant="body2" sx={{ color: "grey.700", mb: 2 }}>
          Prikazane su posljednje {summary.reviews.length} od {summary.count}.
        </Typography>
      ) : null}

      <ReviewForm productId={productId} productSlug={productSlug} />
    </div>
  );
}
