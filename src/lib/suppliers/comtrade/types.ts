/** ComTrade API response shapes (ct4partners.ba). */

export type ComtradePriceItem = {
  productID: string;
  productNo: string;
  productName: string;
  manufacturer: string;
  productGroup: string;
  partnerPrice: number;
  vpSalesCurrency: string;
  specialOffer: number;
  specialOfferExpiration: string;
  specialOfferRemark: string;
  barCode: string;
  manufacturerID: string;
  productGroupID: string;
  quantity: string;
  warehouse: string;
};

export type ComtradeProductDetail = {
  productNo: string;
  productName: string;
  manufacturer: string;
  qty: number;
  price: number;
  mpPrice: number;
  pmpPrice: number;
  partnerDiscount: string;
  pmpCurrency: string;
  vpSalesCurrency: string;
  specialOffer: number;
  bonusPoints: number;
  isProtected: boolean;
  isReserved: boolean;
  manufacturerLogo: string | null;
  imageUrl: string | null;
  description: string;
  barCode: string;
  vat: number;
};

export type ComtradeSpecItem = {
  name: string;
  nameEng: string;
  value: string;
  valueEng: string;
  code: string;
};

export type ComtradeImageItem = {
  id: number;
  productId: string;
  commonItemNo: string;
  url: string;
  name: string;
  type: string | null;
  updatedDate: string;
};

export type ComtradeLoginResponse = {
  token?: string;
  accessToken?: string;
  access_token?: string;
};
