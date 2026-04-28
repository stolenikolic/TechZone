import { styled } from "@mui/material/styles";
import SearchOutlined from "@mui/icons-material/SearchOutlined";

export const SearchOutlinedIcon = styled(SearchOutlined)(({ theme }) => ({
  color: theme.palette.grey[400],
  marginInlineEnd: 6
}));
