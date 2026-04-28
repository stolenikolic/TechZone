import Rating from "@mui/material/Rating";
import Avatar from "@mui/material/Avatar";
import Typography from "@mui/material/Typography";
// STYLED COMPONENTS
import { StyledRoot, UserInfo, ContentWrapper } from "./styles";

// ==============================================================
interface Props {
  name: string;
  image: string;
  title: string;
  rating: number;
  comment: string;
  designation: string;
}
// ==============================================================

export default function TestimonialCard1({
  name,
  image,
  title,
  rating,
  comment,
  designation
}: Props) {
  return (
    <StyledRoot>
      <UserInfo elevation={0}>
        <Avatar src={image} sx={{ width: 100, height: 100, mb: 2 }} />
        <Typography variant="body1" fontSize={18} fontWeight={600}>
          {name}
        </Typography>

        <Typography variant="body2" color="text.secondary">
          {designation}
        </Typography>
      </UserInfo>

      <ContentWrapper>
        <div className="content">
          <Rating value={rating} readOnly color="warning" sx={{ fontSize: 20 }} />

          <Typography variant="body1" fontWeight={700} fontSize={{ sm: 22, xs: 18 }} sx={{ my: 1 }}>
            {title}
          </Typography>

          <Typography variant="body1" fontSize={{ sm: 16, xs: 14 }}>
            {comment}
          </Typography>
        </div>
      </ContentWrapper>
    </StyledRoot>
  );
}
