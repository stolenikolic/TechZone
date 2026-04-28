import { cache } from "react";
import axios from "utils/axiosInstance";
// CUSTOM DATA MODEL
import { IdParams } from "models/Common";
import Address from "models/Address.model";

const getAddressList = cache(async (page = 1) => {
  const PAGE_SIZE = 5;
  const PAGE_NO = page - 1;

  const { data: addressList } = await axios.get<Address[]>("/api/address/user");

  const totalPages = Math.ceil(addressList.length / PAGE_SIZE);
  const currentAddressList = addressList.slice(PAGE_NO * PAGE_SIZE, (PAGE_NO + 1) * PAGE_SIZE);

  const response = { addressList: currentAddressList, totalOrders: addressList.length, totalPages };
  return response;
});

const getIds = cache(async () => {
  const response = await axios.get<IdParams[]>("/api/address/address-ids");
  return response.data;
});

const getAddress = cache(async (id: string) => {
  const response = await axios.get<Address>("/api/address/user/1", { params: { id } });
  return response.data;
});

export default { getAddressList, getIds, getAddress };
