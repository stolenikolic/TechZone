import type { ReactNode } from "react";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Container from "components/Container";
import { SectionHeader } from "components/section-header";
import type Category from "models/Category.model";
import SubcategoryRow from "./subcategory-row";

export type CategoryTreeNode = Omit<Category, "parent"> & {
  parent?: CategoryTreeNode[];
};

interface Props {
  categories: CategoryTreeNode[];
  title: string;
  description?: string;
  pathPrefix?: string[];
  /** Breadcrumbs iznad naslova (istog rasporeda kao na PDP-u). */
  breadcrumbs?: ReactNode;
}

export default function CategoryBrowser({
  categories,
  title,
  description,
  pathPrefix = [],
  breadcrumbs
}: Props) {
  if (!categories.length) return null;

  return (
    <Container>
      {breadcrumbs}
      <SectionHeader title={title} />

      {description ? (
        <Typography color="grey.600" mb={3} maxWidth={720}>
          {description}
        </Typography>
      ) : null}

      <Grid container spacing={3} sx={{ width: "100%", m: 0 }}>
        {categories.map((item) => {
          const categoryPath = [...pathPrefix, item.slug].join("/");

          return (
            <Grid size={{ md: 4, sm: 6, xs: 12 }} key={item.id}>
              <SubcategoryRow
                image={item.image ?? "/assets/images/categories/default-category.jpg"}
                title={item.name}
                slug={categoryPath}
                href={item.href}
              />
            </Grid>
          );
        })}
      </Grid>
    </Container>
  );
}
