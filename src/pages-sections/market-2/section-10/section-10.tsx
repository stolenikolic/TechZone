import Grid from "@mui/material/Grid";
// GLOBAL CUSTOM COMPONENTS
import Container from "components/Container";
import BlogCard1 from "components/blog-cards/blog-card-1";
import { SectionHeader } from "components/section-header";
// API FUNCTIONS
import api from "utils/__api__/market-2";

export default async function Section10() {
  const blogs = await api.getBlogs();
  if (!blogs || blogs.length === 0) return null;

  return (
    <Container>
      <SectionHeader title="Read our blogs" seeMoreLink="#" />

      <Grid container spacing={3}>
        {blogs.map((item) => (
          <Grid size={{ md: 4, xs: 12 }} key={item.id}>
            <BlogCard1
              title={item.title}
              date={item.createdAt}
              image={item.thumbnail}
              description={item.description!}
            />
          </Grid>
        ))}
      </Grid>
    </Container>
  );
}
