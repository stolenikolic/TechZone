export default interface Payment {
  id: string;
  exp: string;
  cvc: string;
  user: string;
  card_no: string;
  payment_method: string;
}
