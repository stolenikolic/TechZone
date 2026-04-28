import { cache } from "react";
import axios from "../axiosInstance";
// CUSTOM DATA MODEL
import LayoutModel from "models/Layout.model";

const getLayoutData = cache(async () => {
  const response = await axios.get<LayoutModel>("/api/layout");
  return response.data;
});

export default { getLayoutData };
