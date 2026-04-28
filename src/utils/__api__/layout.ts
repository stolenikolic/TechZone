import { cache } from "react";
import { getLayoutData as getServerLayoutData } from "lib/layout-data";
// CUSTOM DATA MODEL
import type LayoutModel from "models/Layout.model";

const getLayoutData = cache(async (): Promise<LayoutModel> => {
  return getServerLayoutData();
});

export default { getLayoutData };
