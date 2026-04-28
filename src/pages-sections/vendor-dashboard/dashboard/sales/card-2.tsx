import { PropsWithChildren } from "react";
import Card from "@mui/material/Card";
import Typography from "@mui/material/Typography";
import ArrowDropUp from "@mui/icons-material/ArrowDropUp";
// GLOBAL CUSTOM COMPONENTS
import FlexBox from "components/flex-box/flex-box";

// =========================================================
interface Props extends PropsWithChildren {
  title: string;
  percentage: string;
  amount: string | number;
}
// =========================================================

export default function Card2({ children, title, amount, percentage }: Props) {
  return (
    <Card
      sx={{
        gap: 2,
        padding: 0,
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        "& .content": { flex: 1, alignSelf: "center" }
      }}
    >
      <FlexBox py={3} pl={2.5} flexShrink={0} flexDirection="column">
        <Typography variant="h6" sx={{ color: "grey.600", mb: 2 }}>
          {title}
        </Typography>

        <div>
          <Typography variant="h3">{amount}</Typography>

          <FlexBox mt={0.3} alignItems="center" color="info.main">
            <ArrowDropUp />
            <Typography variant="body1" sx={{ fontSize: 12 }}>
              {percentage}
            </Typography>
          </FlexBox>
        </div>
      </FlexBox>

      <div className="content">{children}</div>
    </Card>
  );
}
