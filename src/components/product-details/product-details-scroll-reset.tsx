"use client";

import { useLayoutEffect } from "react";
import { forceScrollToTopWithRetries } from "lib/scroll-to-top";

type Props = { slug: string };

export default function ProductDetailsScrollReset({ slug }: Props) {
  useLayoutEffect(() => {
    forceScrollToTopWithRetries();
  }, [slug]);

  return null;
}
