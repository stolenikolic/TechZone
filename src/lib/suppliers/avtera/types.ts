/** Parsed Avtera XML product (`<izdelek>`). */

export type AvteraLastnost = {
  naziv: string;
  value: string;
};

export type AvteraProduct = {
  izdelekID: string;
  vendorItemNo: string | null;
  izdelekIme: string | null;
  opis: string | null;
  url: string | null;
  slikaVelika: string | null;
  dodatneSlike: string[];
  ppc: number | null;
  cenaAkcijska: string | null;
  nabavnaCena: string | null;
  dc: string | null;
  davcnaStopnja: string | null;
  kategorijaId: string | null;
  kategorijaName: string | null;
  brandId: string | null;
  brandName: string | null;
  skupinaIzdelkaId: string | null;
  skupinaIzdelkaName: string | null;
  dobavaId: string | null;
  dobavaText: string | null;
  zaloga: number;
  ean: string | null;
  brutoTeza: string | null;
  brutoDolzina: string | null;
  brutoSirina: string | null;
  brutoVisina: string | null;
  dodatneLastnosti: AvteraLastnost[];
};

export type AvteraPriceFeedEntry = {
  price: number;
  zaloga: number;
  isActive: boolean;
  deliveryDays: number | null;
};
