"use client";

import { useCallback, MouseEvent } from "react";
import IconButton from "@mui/material/IconButton";
import Trash from "icons/Trash";

export default function DeleteAddressBtn({ id }: { id: string }) {
  const handleAddressDelete = useCallback(
    (e: MouseEvent<HTMLButtonElement, globalThis.MouseEvent>) => {
      e.stopPropagation();
      alert(id);
    },
    [id]
  );

  return (
    <IconButton onClick={handleAddressDelete}>
      <Trash fontSize="small" color="error" />
    </IconButton>
  );
}
