import type { PropsWithChildren } from "react";
import Card from "@mui/material/Card";
import FlexRowCenter from "components/flex-box/flex-row-center";

export default function Layout({ children }: PropsWithChildren) {
  return (
    <FlexRowCenter bgcolor="grey.50" flexDirection="column" minHeight="100vh" px={2}>
      <Card
        elevation={6}
        sx={{
          maxWidth: 500,
          width: "100%",
          padding: "2rem 3rem",
          border: "1px solid",
          borderColor: "grey.100"
        }}
      >
        {children}
      </Card>
    </FlexRowCenter>
  );
}
