import Grid from "@mui/material/Grid";
// CUSTOM COMPONENTS
import CategoryCard from "./category-card";
import Container from "components/Container";
import { SectionHeader } from "components/section-header";
// API FUNCTIONS
import api from "utils/__api__/market-2";

export default async function Section3() {
  const categories = await api.getCategories();
  if (!categories || !categories.length) return null;

  return (
    <Container>
      <SectionHeader title="Categories" seeMoreLink="#" />

      <Grid container spacing={3}>
        {categories.map((item) => (
          <Grid size={{ lg: 2, sm: 4, xs: 6 }} key={item.id}>
            <CategoryCard
              image={item.image ?? "/assets/images/categories/default-category.jpg"}
              title={item.name}
              slug={item.slug}
            />
          </Grid>
        ))}
      </Grid>
    </Container>
  );
}
