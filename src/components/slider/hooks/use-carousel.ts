import useEmblaCarousel from "embla-carousel-react";
import type { EmblaPluginType } from "embla-carousel";
import { useCarouselDots } from "./use-carousel-dots";
import { useCarouselArrows } from "./use-carousel-arrows";
import type { CarouselOptions } from "../types";

export function useCarousel(options?: CarouselOptions, plugins?: EmblaPluginType[]) {
  const [ref, api] = useEmblaCarousel(options, plugins);
  const arrows = useCarouselArrows(api);
  const dots = useCarouselDots(api);

  return {
    api,
    ref,
    dots,
    arrows,
    plugins: plugins?.map((plugin) => plugin.name),
    options: {
      ...options,
      ...api?.internalEngine().options
    }
  };
}
