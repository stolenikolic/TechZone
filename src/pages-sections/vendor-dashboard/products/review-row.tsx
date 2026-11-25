"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Avatar from "@mui/material/Avatar";
import Typography from "@mui/material/Typography";
import Delete from "@mui/icons-material/Delete";
import BazaarSwitch from "components/BazaarSwitch";
import FlexBox from "components/flex-box/flex-box";
import { deleteProductReview, setProductReviewPublished } from "lib/reviews/admin-actions";
import { StyledIconButton, StyledTableCell, StyledTableRow } from "../styles";

interface Review {
  id: string;
  customer: string;
  product: string;
  comment: string;
  published: boolean;
  productImage: string;
}

type Props = { review: Review };

export default function ReviewRow({ review }: Props) {
  const router = useRouter();
  const { id, customer, product, comment, published, productImage } = review;
  const [isPublished, setIsPublished] = useState(published);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onPublished = async (next: boolean) => {
    const previous = isPublished;
    setIsPublished(next);
    setPending(true);
    setError(null);
    const result = await setProductReviewPublished(id, next);
    setPending(false);
    if (!result.ok) {
      setIsPublished(previous);
      setError(result.message);
      return;
    }
    router.refresh();
  };

  const onDelete = async () => {
    if (!confirm("Obrisati ovu recenziju?")) return;
    setPending(true);
    setError(null);
    const result = await deleteProductReview(id);
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.refresh();
  };

  return (
    <StyledTableRow tabIndex={-1}>
      <StyledTableCell align="left">
        <FlexBox alignItems="center" gap={1.5}>
          <Avatar variant="rounded">
            <Image fill alt={product} src={productImage} sizes="(100%, 100%)" />
          </Avatar>
          <Typography variant="h6">{product}</Typography>
        </FlexBox>
      </StyledTableCell>

      <StyledTableCell align="left">{customer}</StyledTableCell>
      <StyledTableCell align="left">{comment}</StyledTableCell>

      <StyledTableCell align="left">
        <BazaarSwitch
          color="info"
          checked={isPublished}
          disabled={pending}
          onChange={(_, checked) => void onPublished(checked)}
        />
        {error ? (
          <Typography variant="caption" color="error" display="block">
            {error}
          </Typography>
        ) : null}
      </StyledTableCell>

      <StyledTableCell align="center">
        <StyledIconButton aria-label="Obriši recenziju" disabled={pending} onClick={() => void onDelete()}>
          <Delete />
        </StyledIconButton>
      </StyledTableCell>
    </StyledTableRow>
  );
}
