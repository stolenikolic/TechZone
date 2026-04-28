import { cache } from "react";
import { DeliveryTime, DeliveryAddress, PaymentCard } from "models/Common";

const DUMMY_ADDRESS_LIST = [
  {
    id: 1,
    name: "Home",
    phone: "+17804084466",
    street2: "435 Bristol, MA 2351",
    street1: "375 Subidbazaar, MA 2351",
    city: "Sylhet",
    state: "Sylhet",
    country: "Bangladesh",
    zip: "4336"
  },
  {
    id: 2,
    name: "Office",
    phone: "+18334271710",
    street2: "968 Brockton, MA 2351",
    street1: "645 Bondorbazaar, MA 2351",
    city: "Sylhet",
    state: "Sylhet",
    country: "Bangladesh",
    zip: "4336"
  },
  {
    id: 3,
    name: "Office 2",
    phone: "+17754739407",
    street2: "777 Kazi, MA 2351",
    street1: "324 Ambarkhana, MA 2351",
    city: "Sylhet",
    state: "Sylhet",
    country: "Bangladesh",
    zip: "4336"
  }
];

const TIMES = [
  { label: "9AM - 11AM", value: "9AM - 11AM" },
  { label: "11AM - 1PM", value: "11AM - 1PM" },
  { label: "3PM - 5PM", value: "3PM - 5PM" },
  { label: "5PM - 7PM", value: "5PM - 7PM" }
];

const CARD_LIST = [
  { cardType: "Amex", last4Digits: "4765", name: "Jaslynn Land" },
  { cardType: "Mastercard", last4Digits: "5432", name: "Jaslynn Land" },
  { cardType: "Visa", last4Digits: "4543", name: "Jaslynn Land" }
];

export const getAddresses = cache(async (): Promise<DeliveryAddress[]> => {
  return DUMMY_ADDRESS_LIST;
});

export const deleteAddress = cache(async (id: number) => {
  return DUMMY_ADDRESS_LIST.filter((item) => item.id !== id);
});

export const getDeliveryTimes = cache(async (): Promise<DeliveryTime[]> => {
  return TIMES;
});

export const getCards = cache(async (): Promise<PaymentCard[]> => {
  return CARD_LIST;
});
