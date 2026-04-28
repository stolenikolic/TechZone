import { cache } from "react";
import axios from "utils/axiosInstance";
// CUSTOM DATA MODEL
import User from "models/User.model";

const INFO_LIST = [
  { title: "16", subtitle: "All Orders" },
  { title: "02", subtitle: "Awaiting Payments" },
  { title: "00", subtitle: "Awaiting Shipment" },
  { title: "01", subtitle: "Awaiting Delivery" }
];

export const getUser = cache(async (): Promise<User> => {
  const response = await axios.get("/api/user-list/1");
  return response.data;
});

export const getUserAnalytics = cache(async (id: string) => {
  return {
    balance: 5000,
    type: "SILVER USER",
    orderSummary: INFO_LIST
  };
});

export default { getUser, getUserAnalytics };
