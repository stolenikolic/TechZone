import { Fragment } from "react";
//GLOBAL CUSTOM COMPONENTS
import Setting from "components/settings";
import Newsletter from "components/newsletter";
//LOCAL CUSTOM COMPONENTS
import Section1 from "../section-1";
import Section2 from "../section-2";
import Section3 from "../section-3";
import Section4 from "../section-4";
import Section5 from "../section-5";
import Section6 from "../section-6";
import Section7 from "../section-7";
import Section8 from "../section-8";
import Section9 from "../section-9";
import Section10 from "../section-10";

export default function MarketTwoPageView() {
  return (
    <Fragment>
      {/* HERO SECTION */}
      <Section1 />

      {/* SERVICES SECTION */}
      <Section2 />

      {/* CATEGORIES SECTION */}
      <Section3 />

      {/* FLASH DEALS SECTION */}
      <Section4 />

      {/* PROMO OFFERS SECTION */}
      <Section5 />

      {/* TOP RATED PRODUCTS SECTION */}
      <Section6 />

      {/* GRID PRODUCTS SECTION */}
      <Section7 />

      {/* NEWSLETTER SECTION */}
      <Section9 />

      {/* READ OUR BLOG SECTION */}
      <Section10 />

      {/*  CLIENTS SECTION */}
      <Section8 />

      {/* POPUP NEWSLETTER FORM */}
      <Newsletter />

      {/* SETTINGS IS USED ONLY FOR DEMO, YOU CAN REMOVE THIS */}
      <Setting />
    </Fragment>
  );
}
