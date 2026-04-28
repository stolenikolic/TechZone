import Link from "next/link";
import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
// GLOBAL CUSTOM COMPONENTS
import LazyImage from "components/LazyImage";
// STYLED COMPONENT
import { StyledRoot } from "./styles";

// ==================================================
interface Props {
  title: string;
  imgUrl: string;
  buttonLink: string;
  buttonText: string;
  description: string;
  buttonColor?: "dark" | "primary";
}
// ==================================================

export default function CarouselCard1({
  title,
  imgUrl,
  buttonText,
  description,
  buttonColor = "primary"
}: Props) {
  return (
    <StyledRoot>
      <Grid container spacing={3} alignItems="center">
        <Grid className="grid-item" size={{ md: 6, xs: 12 }}>
          <h1 className="title">{title}</h1>
          <p className="description">{description}</p>

          <Link href="/products/search">
            <Button
              size="large"
              disableElevation
              variant="contained"
              color={buttonColor}
              className="button-link"
            >
              {buttonText}
            </Button>
          </Link>
        </Grid>

        <Grid size={{ md: 6, xs: 12 }}>
          <div className="img-wrapper">
            <LazyImage fill src={imgUrl} alt={title} sizes="(max-width: 768px) 100vw, 100vw" />
          </div>
        </Grid>
      </Grid>
    </StyledRoot>
  );
}
