import Link from "next/link";
import Typography from "@mui/material/Typography";
import ArrowRightAlt from "@mui/icons-material/ArrowRightAlt";

//   ==========================================
interface Props {
  href: string;
  text: string;
  color?: string;
  hoverColor?: string;
}
//   ==========================================

export function NavLink3({
  href,
  text,
  color = "text.primary",
  hoverColor = "primary.main",
  ...props
}: Props) {
  return (
    <Link href={href}>
      <Typography
        variant="body1"
        sx={{
          color,
          gap: 1,
          lineHeight: 1,
          fontWeight: 500,
          alignItems: "center",
          position: "relative",
          paddingBottom: "4px",
          display: "inline-flex",
          ":after": {
            left: 0,
            bottom: 0,
            width: "0%",
            content: "''",
            height: "2px",
            transition: "0.3s",
            position: "absolute",
            backgroundColor: color
          },
          ":hover": {
            color: hoverColor,
            "::after": {
              width: "100%",
              backgroundColor: hoverColor
            }
          }
        }}
        {...props}
      >
        {text}{" "}
        <ArrowRightAlt
          sx={{
            fontSize: 16,
            flexShrink: 0,
            ":dir(rtl)": { transform: "rotate(180deg)" }
          }}
        />
      </Typography>
    </Link>
  );
}
