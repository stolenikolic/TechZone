"use client";

import { useParams } from "next/navigation";
import { Fragment, useEffect, useState } from "react";
import Collapse from "@mui/material/Collapse";
// GLOBAL CUSTOM COMPONENTS
import AccordionHeader from "components/accordion";
// LOCAL CUSTOM COMPONENT
import ListItem from "./list-item";
import { renderChild } from "./render-child";
// CUSTOM DATA MODEL
import { CategoryNavItem } from "models/CategoryNavList.model";

// ==============================================================
type Props = { item: CategoryNavItem };
// ==============================================================

export default function Accordion({ item }: Props) {
  const { category } = useParams();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState("");

  useEffect(() => {
    const matchedItem = item.child!.find((childItem) =>
      childItem.href.endsWith(category as string)
    );

    if (matchedItem) {
      setOpen(true);
      setActive(matchedItem.title);
    }
  }, [category, item.child]);

  return (
    <Fragment>
      {/* ACCORDION / COLLAPSE HEADER */}
      <AccordionHeader open={open} className="linkList" onClick={() => setOpen((state) => !state)}>
        <ListItem item={item} />
      </AccordionHeader>

      {/* RENDER NESTED NAV ITEMS */}
      {item.child ? <Collapse in={open}>{renderChild(item.child, active)}</Collapse> : null}
    </Fragment>
  );
}
