import Link from "next/link";
import Image from "next/image";
import Typography from "@mui/material/Typography";
// GLOBAL CUSTOM COMPONENTS
import { NavLink3 } from "components/nav-link";
// STYLED COMPONENTS
import { RootStyle, ImageBox, DateBox } from "./styles";

// =====================================================
interface Props {
  date: string;
  image: string;
  title: string;
  description: string;
}
// =====================================================

export default function BlogCard1({ image, title, date, description }: Props) {
  return (
    <RootStyle>
      <ImageBox>
        <Image
          fill
          src={image}
          alt={title}
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          quality={85}
        />

        <DateBox>
          <p>{date}</p>
        </DateBox>
      </ImageBox>

      <div className="content">
        <Link href="/">
          <Typography noWrap variant="body1" fontWeight={600} fontSize={18}>
            {title}
          </Typography>
        </Link>

        <p className="description">{description}</p>
        <NavLink3 text="Read More" href="/" />
      </div>
    </RootStyle>
  );
}
