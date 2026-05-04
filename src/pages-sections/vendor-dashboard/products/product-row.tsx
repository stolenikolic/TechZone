import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
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
// STYLED COMPONENTS
import { StyledTableRow, CategoryWrapper, StyledTableCell, StyledIconButton } from "../styles";

// ========================================================================
interface Product {
  id: string;
  slug: string;
  name: string;
  price: number;
  brand: string;
  image: string;
  category: string;
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

export default function ProductRow({ product }: Props) {
  const { category, name, price, image, brand, id, published, slug, masterStatus } = product;

  const [productPublish, setProductPublish] = useState(published);
  const brandImage = brand?.startsWith("/") || brand?.startsWith("http");

  return (
    <StyledTableRow tabIndex={-1} role="checkbox">
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

      <StyledTableCell align="left">{currency(price)}</StyledTableCell>

      <StyledTableCell align="left">
        <BazaarSwitch
          color="info"
          checked={productPublish}
          onChange={() => setProductPublish((state) => !state)}
        />
      </StyledTableCell>

      <StyledTableCell align="center">
        <Link href={`/admin/products/${slug}`}>
          <StyledIconButton>
            <Edit />
          </StyledIconButton>
        </Link>

        <StyledIconButton>
          <RemoveRedEye />
        </StyledIconButton>

        <StyledIconButton>
          <Delete />
        </StyledIconButton>
      </StyledTableCell>
    </StyledTableRow>
  );
}
