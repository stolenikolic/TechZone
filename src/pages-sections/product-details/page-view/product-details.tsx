import Link from "next/link";
import Container from "@mui/material/Container";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import Typography from "@mui/material/Typography";
// LOCAL CUSTOM COMPONENTS
import ProductTabs from "../product-tabs";
import ProductIntro from "../product-intro";
import ProductSpecifications from "../product-specifications/product-specifications";
import ProductReviews from "../product-reviews";
import AvailableShops from "../available-shops";
import RelatedProducts from "../related-products";
import FrequentlyBought from "../frequently-bought";
import ProductDescription from "../product-description";
// CUSTOM DATA MODEL
import Product from "models/Product.model";

// ==============================================================
interface Props {
  product: Product;
  relatedProducts: Product[];
  frequentlyBought: Product[];
}
// ==============================================================

function leafCategoryHref(product: Product): string | null {
  if (!product.category) return null;
  if (product.parentCategory) {
    return `/categories/${product.parentCategory.slug}/${product.category.slug}`;
  }
  return `/categories/${product.category.slug}`;
}

export default function ProductDetailsPageView(props: Props) {
  const { product } = props;
  const leafHref = leafCategoryHref(product);

  return (
    <Container className="mt-2 mb-2">
      {/* BREADCRUMBS: Početna / Parent / Child category / Product name */}
      <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 2 }}>
        <Link href="/" style={{ color: "inherit", textDecoration: "none" }}>
          <Typography variant="body2" color="text.primary" component="span">
            Početna
          </Typography>
        </Link>
        {product.parentCategory && (
          <Link href={`/categories/${product.parentCategory.slug}`} style={{ color: "inherit", textDecoration: "none" }}>
            <Typography variant="body2" color="text.primary" component="span">
              {product.parentCategory.name}
            </Typography>
          </Link>
        )}
        {product.category && leafHref && (
          <Link href={leafHref} style={{ color: "inherit", textDecoration: "none" }}>
            <Typography variant="body2" color="text.primary" component="span">
              {product.category.name}
            </Typography>
          </Link>
        )}
        <Typography variant="body2" color="text.secondary">
          {product.title}
        </Typography>
      </Breadcrumbs>

      {/* PRODUCT DETAILS INFO AREA */}
      <ProductIntro product={product} />

      {/* PRODUCT DESCRIPTION | SPECIFICATIONS (if attributes exist) | REVIEWS */}
      <ProductTabs
        description={<ProductDescription description={props.product.description} />}
        specifications={
          product.specifications && product.specifications.length > 0 ? (
            <ProductSpecifications specifications={product.specifications} />
          ) : undefined
        }
        reviews={<ProductReviews />}
      />

      {/* FREQUENTLY BOUGHT PRODUCTS AREA */}
      <FrequentlyBought products={props.frequentlyBought} />

      {/* AVAILABLE SHOPS AREA */}
      <AvailableShops />

      {/* RELATED PRODUCTS AREA */}
      <RelatedProducts products={props.relatedProducts} />
    </Container>
  );
}
