"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Slider from "@mui/material/Slider";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { FlexBetween } from "components/flex-box";
import {
  clampRangeTuple,
  formatRangeParam,
  parseRangeParamToTuple
} from "lib/shop/range-filter-utils";

function formatValueLabel(value: number, unit?: string) {
  return unit ? `${value} ${unit}` : `${value}`;
}

export type DualRangeSliderProps = {
  rangeMin: number;
  rangeMax: number;
  step?: number;
  unit?: string;
  /** Current URL query value, e.g. "3-8". */
  selectedParam: string | null;
  /** Called on commit (mouseup / blur / Enter) with clamped min-max. */
  onCommit: (tuple: [number, number]) => void;
};

export default function DualRangeSlider({
  rangeMin,
  rangeMax,
  step = 1,
  unit,
  selectedParam,
  onCommit
}: DualRangeSliderProps) {
  const bounds = { min: rangeMin, max: rangeMax };
  const isDraggingRef = useRef(false);

  const [localRange, setLocalRange] = useState<[number, number]>(() =>
    parseRangeParamToTuple(selectedParam, bounds, step)
  );
  const [minInput, setMinInput] = useState(String(localRange[0]));
  const [maxInput, setMaxInput] = useState(String(localRange[1]));

  const syncFromUrl = useCallback(() => {
    const next = parseRangeParamToTuple(selectedParam, bounds, step);
    setLocalRange(next);
    setMinInput(String(next[0]));
    setMaxInput(String(next[1]));
  }, [selectedParam, rangeMin, rangeMax, step]);

  useEffect(() => {
    if (isDraggingRef.current) return;
    syncFromUrl();
  }, [syncFromUrl]);

  const applyRange = useCallback(
    (nextValues?: [number, number]) => {
      const rawMin =
        nextValues?.[0] ?? (minInput.trim() === "" ? rangeMin : Number(minInput));
      const rawMax =
        nextValues?.[1] ?? (maxInput.trim() === "" ? rangeMax : Number(maxInput));
      const finalRange = clampRangeTuple([rawMin, rawMax], rangeMin, rangeMax, step);

      setLocalRange(finalRange);
      setMinInput(String(finalRange[0]));
      setMaxInput(String(finalRange[1]));

      onCommit(finalRange);
    },
    [maxInput, minInput, onCommit, rangeMax, rangeMin, step]
  );

  const handleSliderChange = useCallback(
    (_: unknown, value: number | number[]) => {
      const next = Array.isArray(value) ? value : [value, value];
      const tuple = clampRangeTuple([next[0], next[1]], rangeMin, rangeMax, step);
      setLocalRange(tuple);
      setMinInput(String(tuple[0]));
      setMaxInput(String(tuple[1]));
    },
    [rangeMax, rangeMin, step]
  );

  const handleSliderCommit = useCallback(
    (_: unknown, value: number | number[]) => {
      isDraggingRef.current = false;
      const next = Array.isArray(value) ? value : [value, value];
      applyRange([next[0], next[1]]);
    },
    [applyRange]
  );

  return (
    <>
      <Slider
        min={rangeMin}
        max={rangeMax}
        step={step}
        size="small"
        value={localRange}
        valueLabelDisplay="auto"
        valueLabelFormat={(value) => formatValueLabel(value, unit)}
        disabled={rangeMin === rangeMax}
        onChange={(_event, value: number | number[]) => {
          isDraggingRef.current = true;
          handleSliderChange(_event, value);
        }}
        onChangeCommitted={handleSliderCommit}
      />

      <FlexBetween>
        <TextField
          fullWidth
          size="small"
          type="text"
          inputMode="decimal"
          placeholder={String(rangeMin)}
          value={minInput}
          onChange={(event) => setMinInput(event.target.value)}
          onBlur={() => applyRange()}
          onKeyDown={(event) => event.key === "Enter" && applyRange()}
        />
        <Typography variant="h5" sx={{ px: 1, color: "grey.600" }}>
          -
        </Typography>
        <TextField
          fullWidth
          size="small"
          type="text"
          inputMode="decimal"
          placeholder={String(rangeMax)}
          value={maxInput}
          onChange={(event) => setMaxInput(event.target.value)}
          onBlur={() => applyRange()}
          onKeyDown={(event) => event.key === "Enter" && applyRange()}
        />
      </FlexBetween>
    </>
  );
}

export { formatRangeParam };
