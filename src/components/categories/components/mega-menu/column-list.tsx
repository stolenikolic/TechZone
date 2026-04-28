import type { PropsWithChildren } from "react";
import Link from "next/link";
import Grid from "@mui/material/Grid";
// GLOBAL CUSTOM COMPONENTS
import LazyImage from "components/LazyImage";
import { NavLink } from "components/nav-link";
// STYLED COMPONENTS
import { ColumnContent, StyledRoot } from "./styles";
// CUSTOM DATA MODEL
import { CategoryMenuItem, CategoryOffer } from "models/Category.model";

// ==============================================================
interface Props extends PropsWithChildren {
  minWidth?: number;
  banner?: CategoryOffer;
  list: CategoryMenuItem[];
}
// ==============================================================

export default function ColumnList({ list, children, banner, minWidth = 760 }: Props) {
  return (
    <StyledRoot elevation={5} sx={{ minWidth }}>
      <ColumnContent>
        <div className="column-left">
          <Grid container spacing={4}>
            {list.map((item, ind) => (
              <Grid size={{ md: 3 }} key={ind}>
                <div className="title-link">{item.title}</div>

                {item.children?.map((sub, ind) => (
                  <NavLink className="child-link" href={sub.href} key={ind}>
                    {sub.title}
                  </NavLink>
                ))}
              </Grid>
            ))}
          </Grid>
        </div>

        {banner?.position === "right" ? (
          <div className="column-right">
            <Link href={banner.href}>
              <LazyImage src={banner.url} width={137} height={318} alt="banner" />
            </Link>
          </div>
        ) : null}
      </ColumnContent>

      {children}
    </StyledRoot>
  );
}
