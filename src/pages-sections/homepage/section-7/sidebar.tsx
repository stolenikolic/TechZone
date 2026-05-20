"use client";

import { useMemo, useState } from "react";
import Card from "@mui/material/Card";
import Typography from "@mui/material/Typography";
// LOCAL CUSTOM COMPONENT
import ListItem from "./list-item";
// GLOBAL CUSTOM COMPONENTS
import FlexBox from "components/flex-box/flex-box";
// CUSTOM DATA MODELS
import Shop from "models/Shop.model";
import Brand from "models/Brand.model";

// ======================================================
interface Props {
  shops: Shop[];
  brands: Brand[];
}
// ======================================================

export default function Sidebar({ brands, shops }: Props) {
  const [selected, setSelected] = useState("");
  const [type, setType] = useState<"brands" | "shops">("brands");

  const handleCategoryClick = (slug: string) => () => {
    setSelected((prev) => (prev === slug ? "" : slug));
  };

  const list = useMemo(() => {
    return type === "brands" ? brands : shops;
  }, [type, brands, shops]);

  return (
    <Card
      sx={{
        top: 100,
        width: "100%",
        maxWidth: 250,
        height: "100%",
        padding: "1.25rem",
        position: "sticky",
        borderRadius: "10px",
        backgroundColor: "grey.50",
        display: { xs: "none", md: "block" }
      }}
    >
      <FlexBox gap={1} mb={2}>
        <Typography
          variant="h4"
          onClick={() => setType("brands")}
          sx={{ cursor: "pointer", color: type === "brands" ? "grey.900" : "grey.400" }}
        >
          Brands
        </Typography>

        <Typography variant="h4" sx={{ cursor: "pointer", color: "grey.200" }}>
          |
        </Typography>

        <Typography
          variant="h4"
          onClick={() => setType("shops")}
          sx={{ cursor: "pointer", color: type === "shops" ? "grey.900" : "grey.400" }}
        >
          Shops
        </Typography>
      </FlexBox>

      {list.map((item: any) => (
        <ListItem
          key={item.id}
          title={item.name}
          isSelected={!!selected.match(item.slug)}
          onClick={handleCategoryClick(item.slug)}
          imgUrl={type === "shops" ? `/assets/images/shops/${item.thumbnail}.png` : item.image}
          sx={{ mb: "0.75rem" }}
        />
      ))}

      <ListItem
        title={`View All ${type}`}
        sx={{ mt: 8, justifyContent: "center", backgroundColor: "white" }}
      />
    </Card>
  );
}
