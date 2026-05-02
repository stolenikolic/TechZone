"use client";

import { Fragment, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
// MUI
import Box from "@mui/material/Box";
import Rating from "@mui/material/Rating";
import Slider from "@mui/material/Slider";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Collapse from "@mui/material/Collapse";
import TextField from "@mui/material/TextField";
import FormGroup from "@mui/material/FormGroup";
import Typography from "@mui/material/Typography";
import KeyboardArrowUp from "@mui/icons-material/KeyboardArrowUp";
import KeyboardArrowDown from "@mui/icons-material/KeyboardArrowDown";
// GLOBAL CUSTOM COMPONENTS
import AccordionHeader from "components/accordion";
import { NavLink } from "components/nav-link";
import { FlexBetween, FlexBox } from "components/flex-box";
// LOCAL CUSTOM COMPONENTS
import CheckboxLabel from "./checkbox-label";
// CUSTOM LOCAL HOOK
import useProductFilterCard, { type ProductFilterCardFilters } from "./use-product-filter-card";
// TYPES
import type Filters from "models/Filters";
import type { CategorySidebarFilters } from "models/Filters";

function isCategorySidebarFilters(f: ProductFilterCardFilters): f is CategorySidebarFilters {
  return "filters" in f && Array.isArray((f as CategorySidebarFilters).filters);
}

/** Normalize brand value for URL comparison (display "WD" -> param "wd"). */
function normalizeBrandValue(value: string): string {
  return value.toLowerCase().replace(/\s+/g, "-");
}

function getCategoryChildTitle(child: string | { title: string; href: string }) {
  return typeof child === "string" ? child : child.title;
}

function getCategoryChildHref(child: string | { title: string; href: string }) {
  return typeof child === "string" ? undefined : child.href;
}

function formatFilterValue(slug: string, value: string) {
  if (slug === "heatsink" && (value === "true" || value === "false")) {
    return value === "true" ? "Yes" : "No";
  }

  return value === "-" ? "N/A (SATA)" : value;
}

const BRAND_VISIBLE_LIMIT = 5;

export default function ProductFilters({ filters }: { filters: ProductFilterCardFilters }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [openFilterSlugs, setOpenFilterSlugs] = useState<Record<string, boolean>>({ brand: true });
  const [expandedFilterSlugs, setExpandedFilterSlugs] = useState<Record<string, boolean>>({});

  const hook = useProductFilterCard(filters);
  const {
    sales,
    brands,
    rating,
    colors,
    prices,
    priceMinInputStr,
    priceMaxInputStr,
    handleChangePriceMinInput,
    handleChangePriceMaxInput,
    collapsed,
    setCollapsed,
    handleChangeColor,
    handleChangePrice,
    applyPrice,
    applyPriceWithValues,
    debouncedApplyPriceWithValues,
    handleChangeSales,
    handleChangeSearchParams,
    basePathForParams,
    hasSeoFilterInPath,
    getSelectedValues,
    handleFilterChange
  } = hook;

  const priceRange = hook.priceRange;

  const activeFilterKeys = Array.from(searchParams.keys()).filter((key) => key !== "page");
  const hasActiveFilters = activeFilterKeys.length > 0 || hasSeoFilterInPath;

  const handleClearFilters = () => {
    const targetPath = hasSeoFilterInPath ? basePathForParams : pathname;
    router.push(targetPath);
  };

  /** Dynamic sidebar: API-driven filters array + price + categories + rating */
  if (isCategorySidebarFilters(filters)) {
    const CATEGORIES = filters.categories;
    return (
      <div>
        <Typography variant="h6" sx={{ mb: 1.25 }}>
          Categories
        </Typography>
        {CATEGORIES.map((item) =>
          item.children ? (
            <Fragment key={item.title}>
              <AccordionHeader
                open={collapsed}
                onClick={() => setCollapsed((s) => !s)}
                sx={{ padding: ".5rem 0", cursor: "pointer", color: "grey.600" }}
              >
                <Typography component="span">{item.title}</Typography>
              </AccordionHeader>
              <Collapse in={collapsed}>
                {item.children.map((child) => {
                  const title = getCategoryChildTitle(child);
                  const href = getCategoryChildHref(child);

                  const content = (
                    <Typography
                      variant="body1"
                      sx={{ py: 0.75, pl: "22px", fontSize: 14, cursor: "pointer", color: "grey.600" }}
                    >
                      {title}
                    </Typography>
                  );

                  return href ? (
                    <NavLink href={href} key={title}>
                      {content}
                    </NavLink>
                  ) : (
                    <Fragment key={title}>{content}</Fragment>
                  );
                })}
              </Collapse>
            </Fragment>
          ) : (
            <Typography
              variant="body1"
              key={item.title}
              sx={{ py: 0.75, fontSize: 14, cursor: "pointer", color: "grey.600" }}
            >
              {item.title}
            </Typography>
          )
        )}
        <Box component={Divider} my={3} />
        {priceRange && (
          <>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Price Range
            </Typography>
            <Slider
              min={priceRange.min}
              max={priceRange.max}
              size="small"
              value={prices}
              valueLabelDisplay="auto"
              valueLabelFormat={(v) => `${v}`}
              onChange={(_, v) => handleChangePrice(v as number[])}
              onChangeCommitted={(_, v) => debouncedApplyPriceWithValues(v as number[])}
            />
            <FlexBetween>
              <TextField
                fullWidth
                size="small"
                type="text"
                inputMode="numeric"
                placeholder={String(priceRange.min)}
                value={priceMinInputStr}
                onChange={(e) => handleChangePriceMinInput(e.target.value)}
                onBlur={applyPrice}
                onKeyDown={(e) => e.key === "Enter" && applyPrice()}
              />
              <Typography variant="h5" sx={{ px: 1, color: "grey.600" }}>-</Typography>
              <TextField
                fullWidth
                size="small"
                type="text"
                inputMode="numeric"
                placeholder={String(priceRange.max)}
                value={priceMaxInputStr}
                onChange={(e) => handleChangePriceMaxInput(e.target.value)}
                onBlur={applyPrice}
                onKeyDown={(e) => e.key === "Enter" && applyPrice()}
              />
            </FlexBetween>
            <Box component={Divider} my={3} />
          </>
        )}
        {filters.filters.map((filter) => {
          const isBrand = filter.slug === "brand";
          const open = openFilterSlugs[filter.slug] ?? isBrand;
          const expanded = expandedFilterSlugs[filter.slug] ?? false;
          const visibleValues = isBrand ? filter.values.slice(0, BRAND_VISIBLE_LIMIT) : filter.values;
          const hiddenValues = isBrand ? filter.values.slice(BRAND_VISIBLE_LIMIT) : [];
          const hasHiddenBrandValues = isBrand && filter.values.length > BRAND_VISIBLE_LIMIT;

          return (
            <Fragment key={filter.slug}>
              <AccordionHeader
                open={open}
                onClick={() => setOpenFilterSlugs((state) => ({ ...state, [filter.slug]: !open }))}
                sx={{ padding: ".5rem 0", cursor: "pointer", color: "grey.600" }}
              >
                <Typography variant="h6">{filter.name}</Typography>
              </AccordionHeader>

              <Collapse in={open}>
                <FormGroup>
                  {visibleValues.map((value) => {
                    const selected = isBrand
                      ? getSelectedValues(filter.slug).includes(normalizeBrandValue(value))
                      : getSelectedValues(filter.slug).includes(value);

                    return (
                      <CheckboxLabel
                        key={value}
                        label={formatFilterValue(filter.slug, value)}
                        checked={selected}
                        onChange={() => handleFilterChange(filter.slug, value, !selected)}
                      />
                    );
                  })}
                </FormGroup>

                {hasHiddenBrandValues && (
                  <>
                    <Collapse in={expanded} timeout="auto" unmountOnExit>
                      <FormGroup>
                        {hiddenValues.map((value) => {
                          const selected = getSelectedValues(filter.slug).includes(normalizeBrandValue(value));

                          return (
                            <CheckboxLabel
                              key={value}
                              label={formatFilterValue(filter.slug, value)}
                              checked={selected}
                              onChange={() => handleFilterChange(filter.slug, value, !selected)}
                            />
                          );
                        })}
                      </FormGroup>
                    </Collapse>

                    <Button
                      size="small"
                      color="primary"
                      variant="text"
                      endIcon={expanded ? <KeyboardArrowUp fontSize="small" /> : <KeyboardArrowDown fontSize="small" />}
                      onClick={() =>
                        setExpandedFilterSlugs((state) => ({ ...state, [filter.slug]: !expanded }))
                      }
                      sx={{ mt: 1, px: 0, minWidth: 0, color: "primary.main" }}
                    >
                      {expanded ? "Prikaži manje" : "Prikaži više"}
                    </Button>
                  </>
                )}
              </Collapse>
              <Box component={Divider} my={3} />
            </Fragment>
          );
        })}
        <Typography variant="h6" sx={{ mb: 2 }}>
          Ratings
        </Typography>
        <FormGroup>
          {[5, 4, 3, 2, 1].map((item) => (
            <CheckboxLabel
              key={item}
              checked={rating === item}
              onChange={() => handleChangeSearchParams("rating", item.toString())}
              label={<Rating size="small" value={item} color="warn" readOnly />}
            />
          ))}
        </FormGroup>
        <Box component={Divider} my={3} />
        {hasActiveFilters && (
          <Button
            fullWidth
            disableElevation
            color="error"
            variant="contained"
            onClick={handleClearFilters}
            sx={{ mt: 4 }}
          >
            Clear all filters
          </Button>
        )}
      </div>
    );
  }

  /** Legacy sidebar: fixed filter keys (search/shops) */
  const {
    brands: BRANDS,
    categories: CATEGORIES,
    others: OTHERS,
    colors: COLORS,
    capacityRange,
    rpmRange,
    bufferRange,
    sizeOptions,
    connectionOptions,
    readSpeedRange,
    writeSpeedRange,
    pcieGenerationOptions,
    heatsinkOptions
  } = filters as Filters;

  const {
    localCapacity,
    localRpm,
    localBuffer,
    capacityMinInputStr,
    capacityMaxInputStr,
    rpmMinInputStr,
    rpmMaxInputStr,
    bufferMinInputStr,
    bufferMaxInputStr,
    handleChangeCapacityMinInput,
    handleChangeCapacityMaxInput,
    handleChangeRpmMinInput,
    handleChangeRpmMaxInput,
    handleChangeBufferMinInput,
    handleChangeBufferMaxInput,
    sizeSelections,
    connectionSelections,
    handleChangeBrand,
    debouncedApplyCapacity,
    debouncedApplyRpm,
    debouncedApplyBuffer,
    debouncedApplyReadSpeed,
    debouncedApplyWriteSpeed,
    handleChangeCapacity,
    handleChangeRpm,
    handleChangeBuffer,
    handleChangeReadSpeed,
    handleChangeWriteSpeed,
    applyCapacity,
    applyRpm,
    applyBuffer,
    applyReadSpeed,
    applyWriteSpeed,
    localReadSpeed,
    localWriteSpeed,
    readSpeedMinInputStr,
    readSpeedMaxInputStr,
    writeSpeedMinInputStr,
    writeSpeedMaxInputStr,
    handleChangeReadSpeedMinInput,
    handleChangeReadSpeedMaxInput,
    handleChangeWriteSpeedMinInput,
    handleChangeWriteSpeedMaxInput,
    handleChangeSize,
    handleChangeConnection,
    pcieGenerationSelections,
    heatsinkSelections,
    handleChangePcieGeneration,
    handleChangeHeatsink
  } = hook;

  return (
    <div>
      {/* LEGACY: fixed filter keys (search/shops) */}
      <Typography variant="h6" sx={{ mb: 1.25 }}>
        Categories
      </Typography>

      {CATEGORIES.map((item) =>
        item.children ? (
          <Fragment key={item.title}>
            <AccordionHeader
              open={collapsed}
              onClick={() => setCollapsed((state) => !state)}
              sx={{ padding: ".5rem 0", cursor: "pointer", color: "grey.600" }}
            >
              <Typography component="span">{item.title}</Typography>
            </AccordionHeader>

            <Collapse in={collapsed}>
              {item.children.map((child) => {
                const title = getCategoryChildTitle(child);
                const href = getCategoryChildHref(child);

                const content = (
                  <Typography
                    variant="body1"
                    sx={{
                      py: 0.75,
                      pl: "22px",
                      fontSize: 14,
                      cursor: "pointer",
                      color: "grey.600"
                    }}
                  >
                    {title}
                  </Typography>
                );

                return href ? (
                  <NavLink href={href} key={title}>
                    {content}
                  </NavLink>
                ) : (
                  <Fragment key={title}>{content}</Fragment>
                );
              })}
            </Collapse>
          </Fragment>
        ) : (
          <Typography
            variant="body1"
            key={item.title}
            sx={{
              py: 0.75,
              fontSize: 14,
              cursor: "pointer",
              color: "grey.600"
            }}
          >
            {item.title}
          </Typography>
        )
      )}

      <Box component={Divider} my={3} />

      {/* PRICE RANGE: only when category has price data */}
      {priceRange && (
        <>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Price Range
          </Typography>

          <Slider
            min={priceRange.min}
            max={priceRange.max}
            size="small"
            value={prices}
            valueLabelDisplay="auto"
            valueLabelFormat={(v) => `${v}`}
            onChange={(_, v) => handleChangePrice(v as number[])}
            onChangeCommitted={(_, v) => debouncedApplyPriceWithValues(v as number[])}
          />

          <FlexBetween>
            <TextField
              fullWidth
              size="small"
              type="text"
              inputMode="numeric"
              placeholder={String(priceRange.min)}
              value={priceMinInputStr}
              onChange={(e) => handleChangePriceMinInput(e.target.value)}
              onBlur={applyPrice}
              onKeyDown={(e) => e.key === "Enter" && applyPrice()}
            />
            <Typography variant="h5" sx={{ px: 1, color: "grey.600" }}>
              -
            </Typography>
            <TextField
              fullWidth
              size="small"
              type="text"
              inputMode="numeric"
              placeholder={String(priceRange.max)}
              value={priceMaxInputStr}
              onChange={(e) => handleChangePriceMaxInput(e.target.value)}
              onBlur={applyPrice}
              onKeyDown={(e) => e.key === "Enter" && applyPrice()}
            />
          </FlexBetween>
          <Box component={Divider} my={3} />
        </>
      )}

      {/* BRANDS: only when category has brands */}
      {BRANDS.length > 0 && (
        <>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Brands
          </Typography>
          <FormGroup>
            {BRANDS.map(({ label, value }) => (
              <CheckboxLabel
                key={value}
                label={label}
                checked={brands.includes(value)}
                onChange={() => handleChangeBrand(value)}
              />
            ))}
          </FormGroup>
          <Box component={Divider} my={3} />
        </>
      )}

      {/* CAPACITY: only when category has capacity attribute */}
      {capacityRange && (
        <>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Capacity
          </Typography>
          <Slider
            min={capacityRange.min}
            max={capacityRange.max}
            size="small"
            value={localCapacity}
            valueLabelDisplay="auto"
            valueLabelFormat={(v) => `${v}`}
            onChange={(_, v) => handleChangeCapacity(v as number[])}
            onChangeCommitted={(_, v) => debouncedApplyCapacity(v as number[])}
          />
          <FlexBetween>
            <TextField
              fullWidth
              size="small"
              type="text"
              inputMode="numeric"
              placeholder={String(capacityRange.min)}
              value={capacityMinInputStr}
              onChange={(e) => handleChangeCapacityMinInput(e.target.value)}
              onBlur={() => applyCapacity()}
              onKeyDown={(e) => e.key === "Enter" && applyCapacity()}
            />
            <Typography variant="h5" sx={{ px: 1, color: "grey.600" }}>
              -
            </Typography>
            <TextField
              fullWidth
              size="small"
              type="text"
              inputMode="numeric"
              placeholder={String(capacityRange.max)}
              value={capacityMaxInputStr}
              onChange={(e) => handleChangeCapacityMaxInput(e.target.value)}
              onBlur={() => applyCapacity()}
              onKeyDown={(e) => e.key === "Enter" && applyCapacity()}
            />
          </FlexBetween>
          <Box component={Divider} my={3} />
        </>
      )}

      {/* RPM: only when category has rpm attribute */}
      {rpmRange && (
        <>
          <Typography variant="h6" sx={{ mb: 2 }}>
            RPM
          </Typography>
          <Slider
            min={rpmRange.min}
            max={rpmRange.max}
            size="small"
            value={localRpm}
            valueLabelDisplay="auto"
            valueLabelFormat={(v) => `${v}`}
            onChange={(_, v) => handleChangeRpm(v as number[])}
            onChangeCommitted={(_, v) => debouncedApplyRpm(v as number[])}
          />
          <FlexBetween>
            <TextField
              fullWidth
              size="small"
              type="text"
              inputMode="numeric"
              placeholder={String(rpmRange.min)}
              value={rpmMinInputStr}
              onChange={(e) => handleChangeRpmMinInput(e.target.value)}
              onBlur={() => applyRpm()}
              onKeyDown={(e) => e.key === "Enter" && applyRpm()}
            />
            <Typography variant="h5" sx={{ px: 1, color: "grey.600" }}>
              -
            </Typography>
            <TextField
              fullWidth
              size="small"
              type="text"
              inputMode="numeric"
              placeholder={String(rpmRange.max)}
              value={rpmMaxInputStr}
              onChange={(e) => handleChangeRpmMaxInput(e.target.value)}
              onBlur={() => applyRpm()}
              onKeyDown={(e) => e.key === "Enter" && applyRpm()}
            />
          </FlexBetween>
          <Box component={Divider} my={3} />
        </>
      )}

      {/* BUFFER: only when category has buffer attribute */}
      {bufferRange && (
        <>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Buffer
          </Typography>
          <Slider
            min={bufferRange.min}
            max={bufferRange.max}
            size="small"
            value={localBuffer}
            valueLabelDisplay="auto"
            valueLabelFormat={(v) => `${v}`}
            onChange={(_, v) => handleChangeBuffer(v as number[])}
            onChangeCommitted={(_, v) => debouncedApplyBuffer(v as number[])}
          />
          <FlexBetween>
            <TextField
              fullWidth
              size="small"
              type="text"
              inputMode="numeric"
              placeholder={String(bufferRange.min)}
              value={bufferMinInputStr}
              onChange={(e) => handleChangeBufferMinInput(e.target.value)}
              onBlur={() => applyBuffer()}
              onKeyDown={(e) => e.key === "Enter" && applyBuffer()}
            />
            <Typography variant="h5" sx={{ px: 1, color: "grey.600" }}>
              -
            </Typography>
            <TextField
              fullWidth
              size="small"
              type="text"
              inputMode="numeric"
              placeholder={String(bufferRange.max)}
              value={bufferMaxInputStr}
              onChange={(e) => handleChangeBufferMaxInput(e.target.value)}
              onBlur={() => applyBuffer()}
              onKeyDown={(e) => e.key === "Enter" && applyBuffer()}
            />
          </FlexBetween>
          <Box component={Divider} my={3} />
        </>
      )}

      {/* SIZE: only when category has size_inch or size attribute */}
      {sizeOptions && sizeOptions.length > 0 && (
        <>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Size
          </Typography>
          <FormGroup>
            {sizeOptions.map((option) => (
              <CheckboxLabel
                key={option}
                label={option}
                checked={sizeSelections.includes(option)}
                onChange={() => handleChangeSize(option)}
              />
            ))}
          </FormGroup>
          <Box component={Divider} my={3} />
        </>
      )}

      {/* CONNECTION: only when category has connection attribute (e.g. SSD) */}
      {connectionOptions && connectionOptions.length > 0 && (
        <>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Connection
          </Typography>
          <FormGroup>
            {connectionOptions.map((option) => (
              <CheckboxLabel
                key={option}
                label={option}
                checked={(connectionSelections ?? []).includes(option)}
                onChange={() => handleChangeConnection(option)}
              />
            ))}
          </FormGroup>
          <Box component={Divider} my={3} />
        </>
      )}

      {/* READ SPEED: SSD */}
      {readSpeedRange && (
        <>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Read speed (MB/s)
          </Typography>
          <Slider
            min={readSpeedRange.min}
            max={readSpeedRange.max}
            size="small"
            value={localReadSpeed}
            valueLabelDisplay="auto"
            valueLabelFormat={(v) => `${v}`}
            onChange={(_, v) => handleChangeReadSpeed(v as number[])}
            onChangeCommitted={(_, v) => debouncedApplyReadSpeed(v as number[])}
          />
          <FlexBetween>
            <TextField
              fullWidth
              size="small"
              type="text"
              inputMode="numeric"
              placeholder={String(readSpeedRange.min)}
              value={readSpeedMinInputStr}
              onChange={(e) => handleChangeReadSpeedMinInput(e.target.value)}
              onBlur={() => applyReadSpeed()}
              onKeyDown={(e) => e.key === "Enter" && applyReadSpeed()}
            />
            <Typography variant="h5" sx={{ px: 1, color: "grey.600" }}>
              -
            </Typography>
            <TextField
              fullWidth
              size="small"
              type="text"
              inputMode="numeric"
              placeholder={String(readSpeedRange.max)}
              value={readSpeedMaxInputStr}
              onChange={(e) => handleChangeReadSpeedMaxInput(e.target.value)}
              onBlur={() => applyReadSpeed()}
              onKeyDown={(e) => e.key === "Enter" && applyReadSpeed()}
            />
          </FlexBetween>
          <Box component={Divider} my={3} />
        </>
      )}

      {/* WRITE SPEED: SSD */}
      {writeSpeedRange && (
        <>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Write speed (MB/s)
          </Typography>
          <Slider
            min={writeSpeedRange.min}
            max={writeSpeedRange.max}
            size="small"
            value={localWriteSpeed}
            valueLabelDisplay="auto"
            valueLabelFormat={(v) => `${v}`}
            onChange={(_, v) => handleChangeWriteSpeed(v as number[])}
            onChangeCommitted={(_, v) => debouncedApplyWriteSpeed(v as number[])}
          />
          <FlexBetween>
            <TextField
              fullWidth
              size="small"
              type="text"
              inputMode="numeric"
              placeholder={String(writeSpeedRange.min)}
              value={writeSpeedMinInputStr}
              onChange={(e) => handleChangeWriteSpeedMinInput(e.target.value)}
              onBlur={() => applyWriteSpeed()}
              onKeyDown={(e) => e.key === "Enter" && applyWriteSpeed()}
            />
            <Typography variant="h5" sx={{ px: 1, color: "grey.600" }}>
              -
            </Typography>
            <TextField
              fullWidth
              size="small"
              type="text"
              inputMode="numeric"
              placeholder={String(writeSpeedRange.max)}
              value={writeSpeedMaxInputStr}
              onChange={(e) => handleChangeWriteSpeedMaxInput(e.target.value)}
              onBlur={() => applyWriteSpeed()}
              onKeyDown={(e) => e.key === "Enter" && applyWriteSpeed()}
            />
          </FlexBetween>
          <Box component={Divider} my={3} />
        </>
      )}

      {/* PCIe GENERATION: SSD */}
      {pcieGenerationOptions && pcieGenerationOptions.length > 0 && (
        <>
          <Typography variant="h6" sx={{ mb: 2 }}>
            PCIe generation
          </Typography>
          <FormGroup>
            {pcieGenerationOptions.map((option) => (
              <CheckboxLabel
                key={option}
                label={option === "-" ? "N/A (SATA)" : option}
                checked={(pcieGenerationSelections ?? []).includes(option)}
                onChange={() => handleChangePcieGeneration(option)}
              />
            ))}
          </FormGroup>
          <Box component={Divider} my={3} />
        </>
      )}

      {/* HEATSINK: SSD */}
      {heatsinkOptions && heatsinkOptions.length > 0 && (
        <>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Heatsink
          </Typography>
          <FormGroup>
            {heatsinkOptions.map((option) => (
              <CheckboxLabel
                key={option}
                label={option === "true" ? "Yes" : option === "false" ? "No" : option}
                checked={(heatsinkSelections ?? []).includes(option)}
                onChange={() => handleChangeHeatsink(option)}
              />
            ))}
          </FormGroup>
          <Box component={Divider} my={3} />
        </>
      )}

      {/* SALES OPTIONS: only when others exist */}
      {OTHERS.length > 0 && (
      <FormGroup>
        {OTHERS.map(({ label, value }) => (
          <CheckboxLabel
            key={value}
            label={label}
            checked={sales.includes(value)}
            onChange={() => handleChangeSales(value)}
          />
        ))}
      </FormGroup>
      )}
      <Box component={Divider} my={3} />

      {/* RATINGS FILTER */}
      <Typography variant="h6" sx={{ mb: 2 }}>
        Ratings
      </Typography>

      <FormGroup>
        {[5, 4, 3, 2, 1].map((item) => (
          <CheckboxLabel
            key={item}
            checked={rating === item}
            onChange={() => handleChangeSearchParams("rating", item.toString())}
            label={<Rating size="small" value={item} color="warn" readOnly />}
          />
        ))}
      </FormGroup>

      <Box component={Divider} my={3} />

      {/* COLORS: only when colors exist */}
      {COLORS.length > 0 && (
        <>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Colors
      </Typography>
      <FlexBox mb={2} flexWrap="wrap" gap={1.5}>
        {COLORS.map((item) => (
          <Box
            key={item}
            bgcolor={item}
            onClick={() => handleChangeColor(item)}
            sx={{
              width: 25,
              height: 25,
              flexShrink: 0,
              outlineOffset: 1,
              cursor: "pointer",
              borderRadius: 3,
              outline: colors.includes(item) ? 1 : 0,
              outlineColor: item
            }}
          />
        ))}
      </FlexBox>
        </>
      )}

      {hasActiveFilters && (
        <Button
          fullWidth
          disableElevation
          color="error"
          variant="contained"
          onClick={handleClearFilters}
          sx={{ mt: 4 }}
        >
          Clear all filters
        </Button>
      )}
    </div>
  );
}
