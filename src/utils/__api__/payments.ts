import { cache } from "react";
import Payment from "models/Payment.model";

const PAYMENT_METHODS = [
  {
    id: "1050017AB",
    exp: "10 / 2025",
    cvc: "123",
    user: "Ralf Edward",
    payment_method: "Mastercard",
    card_no: "1234 **** **** ****"
  },
  {
    id: "1050017AA",
    cvc: "123",
    exp: "08 / 2022",
    user: "Ralf Edward",
    payment_method: "Amex",
    card_no: "1234 **** **** ****"
  },
  {
    id: "1050017AC",
    cvc: "123",
    exp: "N/A",
    user: "Ralf Edward",
    payment_method: "PayPal",
    card_no: "ui-lib@email.com"
  },
  {
    id: "1050017AD",
    cvc: "123",
    exp: "08 / 2022",
    user: "Ralf Edward",
    payment_method: "Visa",
    card_no: "1234 **** **** ****"
  },
  {
    id: "1050017AE",
    cvc: "123",
    exp: "08 / 2022",
    user: "Ralf Edward",
    payment_method: "Amex",
    card_no: "1234 **** **** ****"
  },
  {
    id: "1050017AG",
    cvc: "123",
    exp: "N/A",
    user: "Ralf Edward",
    payment_method: "PayPal",
    card_no: "ui-lib@email.com"
  },
  {
    id: "1050017AF",
    cvc: "123",
    exp: "08 / 2022",
    user: "Ralf Edward",
    payment_method: "Visa",
    card_no: "1234 **** **** ****"
  }
];

const getPayments = cache(
  async (page = 0): Promise<{ payments: Payment[]; totalPages: number }> => {
    const PAGE_SIZE = 5;
    const PAGE_NO = page - 1;

    const totalPages = Math.ceil(PAYMENT_METHODS.length / PAGE_SIZE);
    const currentPayments = PAYMENT_METHODS.slice(PAGE_NO * PAGE_SIZE, (PAGE_NO + 1) * PAGE_SIZE);

    const response = { payments: currentPayments, totalPages };
    return response;
  }
);

const getPayment = cache(async (id: string) => {
  return PAYMENT_METHODS.find((payment) => payment.id === id);
});

export default { getPayment, getPayments };
