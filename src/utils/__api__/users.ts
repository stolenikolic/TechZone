import { cache } from "react";
import axios from "utils/axiosInstance";
// CUSTOM DATA MODEL
import User from "models/User.model";

const INFO_LIST = [
  { title: "16", subtitle: "Sve narudžbe" },
  { title: "02", subtitle: "Čeka uplatu" },
  { title: "00", subtitle: "Čeka slanje" },
  { title: "01", subtitle: "Čeka dostavu" }
];

export const getUser = cache(async (): Promise<User> => {
  const response = await axios.get("/api/user-list/1");
  return response.data;
});

export const getUserAnalytics = cache(async (id: string) => {
  return {
    balance: 5000,
    type: "Srebrni korisnik",
    orderSummary: INFO_LIST
  };
});

export default { getUser, getUserAnalytics };
