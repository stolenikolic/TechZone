import Card from "@mui/material/Card";
import { styled } from "@mui/material/styles";

// STYLED COMPONENT
export const StyledRoot = styled(Card)(({ theme }) => ({
  marginLeft: "1rem",
  paddingBlock: "0.5rem",
  "& .title-link, & .child-link": {
    color: "inherit",
    display: "block",
    padding: "0.5rem 0px"
  },
  "& .child-link": { fontWeight: 400 },
  "& .title-link": { fontWeight: 500 },
  "& .mega-menu-content": {
    borderRadius: 4,
    marginLeft: "1rem",
    padding: "0.5rem 0px",
    boxShadow: theme.shadows[5],
    transition: "all 250ms ease-in-out",
    backgroundColor: theme.palette.background.paper
  }
}));

export const ColumnContent = styled("div")(({ theme }) => ({
  display: "flex",
  paddingInline: theme.spacing(2.5),
  "& .column-left": { flex: "1 1 0" },
  "& .column-right": { marginTop: theme.spacing(1.5) }
}));
