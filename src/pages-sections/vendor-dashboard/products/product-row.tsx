import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Avatar from "@mui/material/Avatar";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
// MUI ICON COMPONENTS
import Edit from "@mui/icons-material/Edit";
import Delete from "@mui/icons-material/Delete";
import RemoveRedEye from "@mui/icons-material/RemoveRedEye";
// GLOBAL CUSTOM COMPONENTS
import FlexBox from "components/flex-box/flex-box";
import BazaarSwitch from "components/BazaarSwitch";
// CUSTOM UTILS LIBRARY FUNCTION
import { currency } from "lib";
import { formatEffectivePriceSourceLabel } from "lib/effective-price-source";
// STYLED COMPONENTS
import { StyledTableRow, CategoryWrapper, StyledTableCell, StyledIconButton } from "../styles";

// ========================================================================
interface Product {
  id: string;
  slug: string;
  name: string;
  price: number;
  effectivePrice: number;
  effectivePriceSource: string | null;
  basePrice: number | null;
  customPrice: number | null;
  brand: string;
  image: string;
  category: string;
  /** Visible on shop: is_active && !publish_locked */
  published: boolean;
  masterStatus?: {
    value: "unlinked" | "linked" | "needs_attributes" | "ready";
    label: string;
    tooltip: string;
    missing: string[];
    supplierOffers: number;
  };
}

type Props = { product: Product };
type RowActions = { onToggleExpand?: (product: Product) => void };
// ========================================================================

function masterStatusColor(status?: Product["masterStatus"]): "success" | "warning" | "error" | "info" | "default" {
  if (!status) return "default";
  if (status.value === "ready") return "success";
  if (status.value === "unlinked") return "error";
  if (status.value === "needs_attributes") return "warning";
  return "info";
}

function MasterStatusChip({ status }: { status?: Product["masterStatus"] }) {
  if (!status) return <Chip label="unknown" size="small" variant="outlined" />;

  return (
    <Tooltip title={status.tooltip} arrow>
      <Chip label={status.label} color={masterStatusColor(status)} size="small" variant="outlined" />
    </Tooltip>
  );
}

export default function ProductRow({ product, onToggleExpand }: Props & RowActions) {
  const {
    category,
    name,
    effectivePrice,
    effectivePriceSource,
    basePrice,
    customPrice,
    image,
    brand,
    id,
    published,
    slug,
    masterStatus
  } = product;

  const [visibleOnShop, setVisibleOnShop] = useState(published);
  const [togglingPublish, setTogglingPublish] = useState(false);
  const brandImage = brand?.startsWith("/") || brand?.startsWith("http");

  useEffect(() => {
    setVisibleOnShop(published);
  }, [published]);

  async function handlePublishToggle(nextVisible: boolean) {
    const previous = visibleOnShop;
    setVisibleOnShop(nextVisible);
    setTogglingPublish(true);
    try {
      const response = await fetch(`/api/admin/products/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publishLocked: !nextVisible })
      });
      const data = (await response.json()) as { error?: string; published?: boolean };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to update publish state.");
      }
      if (typeof data.published === "boolean") {
        setVisibleOnShop(data.published);
      }
    } catch {
      setVisibleOnShop(previous);
    } finally {
      setTogglingPublish(false);
    }
  }

  return (
    <StyledTableRow
      tabIndex={-1}
      role="checkbox"
      hover
      onClick={() => onToggleExpand?.(product)}
      sx={{ cursor: "pointer" }}
    >
      <StyledTableCell align="left">
        <FlexBox alignItems="center" gap={1.5}>
          <Avatar variant="rounded">
            <Image fill src={image} alt={name} sizes="(100%, 100%)" />
          </Avatar>

          <div>
            <Typography variant="h6">{name}</Typography>

            <Typography variant="body1" sx={{ fontSize: 13, color: "grey.600" }}>
              #{id.split("-")[0]}
            </Typography>
          </div>
        </FlexBox>
      </StyledTableCell>

      <StyledTableCell align="left">
        <CategoryWrapper>{category}</CategoryWrapper>
      </StyledTableCell>

      <StyledTableCell align="left">
        {brandImage ? (
          <Box sx={{ width: 55, height: 25, position: "relative", img: { objectFit: "contain" } }}>
            <Image fill src={brand} alt={name} sizes="(55px, 25px)" />
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary">
            {brand || "-"}
          </Typography>
        )}
      </StyledTableCell>

      <StyledTableCell align="left">
        <MasterStatusChip status={masterStatus} />
      </StyledTableCell>

      <StyledTableCell align="left">
        <Typography variant="body2" color="text.secondary">
          {formatEffectivePriceSourceLabel(effectivePriceSource)}
        </Typography>
      </StyledTableCell>
      <StyledTableCell align="left">{currency(effectivePrice)}</StyledTableCell>
      <StyledTableCell align="left">{basePrice != null ? currency(basePrice) : "-"}</StyledTableCell>
      <StyledTableCell align="left">{customPrice != null ? currency(customPrice) : "-"}</StyledTableCell>

      <StyledTableCell align="left" onClick={(e) => e.stopPropagation()}>
        <Tooltip
          title={
            visibleOnShop
              ? "Visible on shop (active supplier offer, not manually hidden)"
              : "Hidden on shop (manually unpublished or no active offer)"
          }
          arrow
        >
          <Box component="span" display="inline-flex">
            <BazaarSwitch
              color="info"
              checked={visibleOnShop}
              disabled={togglingPublish}
              onChange={(_e, checked) => void handlePublishToggle(checked)}
            />
          </Box>
        </Tooltip>
      </StyledTableCell>

      <StyledTableCell align="center">
        <Link href={`/admin/products/${slug}`} onClick={(e) => e.stopPropagation()}>
          <StyledIconButton>
            <Edit />
          </StyledIconButton>
        </Link>

        <Link
          href={`/products/${slug}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          <StyledIconButton title="View product page">
            <RemoveRedEye />
          </StyledIconButton>
        </Link>

        <StyledIconButton onClick={(e) => e.stopPropagation()}>
          <Delete />
        </StyledIconButton>
      </StyledTableCell>
    </StyledTableRow>
  );
}
