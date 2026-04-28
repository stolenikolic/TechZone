import { useState, useEffect, useCallback } from "react";
import type { EmblaCarouselType } from "embla-carousel";

export function useCarouselArrows(emblaApi?: EmblaCarouselType) {
  const [disablePrev, setDisabledPrevBtn] = useState(true);
  const [disableNext, setDisabledNextBtn] = useState(true);

  const onClickPrev = useCallback(() => {
    if (!emblaApi) return;
    emblaApi.scrollPrev();
  }, [emblaApi]);

  const onClickNext = useCallback(() => {
    if (!emblaApi) return;
    emblaApi.scrollNext();
  }, [emblaApi]);

  const onSelect = useCallback((_emblaApi: EmblaCarouselType) => {
    setDisabledPrevBtn(!_emblaApi.canScrollPrev());
    setDisabledNextBtn(!_emblaApi.canScrollNext());
  }, []);

  useEffect(() => {
    if (!emblaApi) return;

    onSelect(emblaApi);
    emblaApi.on("reInit", onSelect).on("select", onSelect);
  }, [emblaApi, onSelect]);

  return {
    disablePrev,
    disableNext,
    onClickPrev,
    onClickNext
  };
}
