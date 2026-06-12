import Container from "@mui/material/Container";
import ProductDetailsScrollReset from "components/product-details/product-details-scroll-reset";
// LOCAL CUSTOM COMPONENTS
import ProductTabs from "../product-tabs";
import ProductIntro from "../product-intro";
import ProductSpecifications from "../product-specifications/product-specifications";
import ProductReviews from "../product-reviews";
import AvailableShops from "../available-shops";
import RelatedProducts from "../related-products";
import FrequentlyBought from "../frequently-bought";
import ProductDescription from "../product-description";
import ProductFaq from "../product-faq";
import SiteBreadcrumbs from "components/site-breadcrumbs/site-breadcrumbs";
import type { SiteBreadcrumbItem } from "components/site-breadcrumbs";
// CUSTOM DATA MODEL
import Product from "models/Product.model";
import { getLeafCategoryHref } from "lib/shop/category-filter-url";

// ==============================================================
interface Props {
  product: Product;
  relatedProducts: Product[];
  frequentlyBought: Product[];
}
// ==============================================================

export default function ProductDetailsPageView(props: Props) {
  const { product } = props;
  const leafHref = getLeafCategoryHref(product);
  const hasSpecifications = Boolean(product.specifications?.length);
  const hasFaq = Boolean(product.faq?.length);

  const breadcrumbItems: SiteBreadcrumbItem[] = [
    ...(product.parentCategory
      ? [{ label: product.parentCategory.name, href: `/categories/${product.parentCategory.slug}` }]
      : []),
    ...(product.category && leafHref ? [{ label: product.category.name, href: leafHref }] : []),
    { label: product.title }
  ];

  return (
    <Container className="mt-2 mb-2">
      <ProductDetailsScrollReset slug={product.slug} />
      <SiteBreadcrumbs items={breadcrumbItems} />

      {/* PRODUCT DETAILS INFO AREA */}
      <ProductIntro product={product} />

      {/* PRODUCT DESCRIPTION | SPECIFICATIONS | FAQ | REVIEWS */}
      <ProductTabs
        description={<ProductDescription description={product.description} />}
        specifications={
          hasSpecifications ? (
            <ProductSpecifications
              specifications={product.specifications!}
              categoryHref={leafHref}
              showTitle={false}
            />
          ) : undefined
        }
        faq={hasFaq ? <ProductFaq items={product.faq} showTitle={false} /> : undefined}
        reviews={<ProductReviews />}
        hasSpecifications={hasSpecifications}
        hasFaq={hasFaq}
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
