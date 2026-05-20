"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Favorite from "@mui/icons-material/Favorite";
import Pagination from "../pagination";
import DashboardHeader from "../dashboard-header";
import ProductCard17 from "components/product-cards/product-card-17";
import useWishlist from "hooks/useWishlist";
import { useAuth } from "contexts/AuthContext";
import type { WishlistProduct } from "lib/wishlist/types";

const PAGE_SIZE = 12;

type Props = {
  page: number;
};

function orderProducts(ids: string[], products: WishlistProduct[]): WishlistProduct[] {
  const byId = new Map(products.map((product) => [product.id, product]));
  return ids.map((id) => byId.get(id)).filter((product): product is WishlistProduct => product != null);
}

export default function WishListPageClient({ page }: Props) {
  const { productIds, isHydrated } = useWishlist();
  const { user } = useAuth();
  const [products, setProducts] = useState<WishlistProduct[]>([]);
  const [initialLoading, setInitialLoading] = useState(false);
  const productsRef = useRef(products);
  productsRef.current = products;

  useEffect(() => {
    if (!isHydrated) return;

    if (productIds.length === 0) {
      setProducts([]);
      setInitialLoading(false);
      return;
    }

    const current = productsRef.current;
    const idSet = new Set(productIds);
    const filtered = current.filter((product) => idSet.has(product.id));
    const loadedIds = new Set(filtered.map((product) => product.id));
    const missingIds = productIds.filter((id) => !loadedIds.has(id));

    if (missingIds.length === 0) {
      setProducts(orderProducts(productIds, filtered));
      return;
    }

    const controller = new AbortController();
    const showInitialLoader = current.length === 0;
    if (showInitialLoader) setInitialLoading(true);

    const load = async () => {
      try {
        const response = await fetch("/api/wishlist/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: productIds }),
          signal: controller.signal
        });
        if (!response.ok) throw new Error("Failed to load wishlist products");
        const data = (await response.json()) as { products?: WishlistProduct[] };
        if (controller.signal.aborted) return;
        setProducts(Array.isArray(data.products) ? data.products : []);
      } catch (err) {
        if ((err as Error).name !== "AbortError" && productsRef.current.length === 0) {
          setProducts([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setInitialLoading(false);
        }
      }
    };

    void load();
    return () => controller.abort();
  }, [isHydrated, productIds]);

  const totalPages = Math.max(1, Math.ceil(products.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageProducts = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return products.slice(start, start + PAGE_SIZE);
  }, [products, currentPage]);

  const showInitialLoader = !isHydrated || (initialLoading && products.length === 0);

  if (showInitialLoader) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
        Učitavanje liste želja...
      </Typography>
    );
  }

  if (products.length === 0) {
    return (
      <Fragment>
        <DashboardHeader title="Moja lista želja" Icon={Favorite} />
        {!user ? (
          <Alert severity="info" sx={{ mb: 3 }}>
            Prijavite se da sačuvate listu želja na nalogu.{" "}
            <Link href="/login?next=/wish-list">Prijavite se</Link>
          </Alert>
        ) : null}
        <Typography variant="body1" color="text.secondary" sx={{ py: 6, textAlign: "center" }}>
          Lista želja je prazna.
        </Typography>
      </Fragment>
    );
  }

  return (
    <Fragment>
      <DashboardHeader title="Moja lista želja" Icon={Favorite} />

      {!user ? (
        <Alert severity="info" sx={{ mb: 3 }}>
          Prijavite se da sačuvate listu želja na nalogu.{" "}
          <Link href="/login?next=/wish-list">Prijavite se</Link>
        </Alert>
      ) : null}

      <Box
        sx={{
          display: "grid",
          rowGap: 3,
          columnGap: { xs: 1, md: 2 },
          width: "100%",
          gridTemplateColumns: {
            xs: "repeat(1, minmax(0, 1fr))",
            sm: "repeat(2, minmax(0, 1fr))",
            md: "repeat(2, minmax(0, 1fr))",
            lg: "repeat(3, minmax(0, 1fr))",
            xl: "repeat(4, minmax(0, 1fr))"
          }
        }}
      >
        {pageProducts.map((product) => (
          <Box key={product.id} sx={{ display: "flex", minWidth: 0 }}>
            <ProductCard17 bgWhite product={product} showRemoveFromWishlist />
          </Box>
        ))}
      </Box>

      <Pagination count={totalPages} />
    </Fragment>
  );
}
