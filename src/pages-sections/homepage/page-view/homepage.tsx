import { Fragment, Suspense } from "react";
// Demo prekidač rasporeda (RTL/LTR) je isključen.
// import Setting from "components/settings";
// Newsletter i blog su isključeni dok ne zatrebaju.
// import Newsletter from "components/newsletter";
//LOCAL CUSTOM COMPONENTS
import Section1 from "../section-1";
import Section2 from "../section-2";
import Section3 from "../section-3";
import Section4 from "../section-4";
import Section5 from "../section-5";
import Section6 from "../section-6";
import Section7 from "../section-7";
import Section8 from "../section-8";
// import Section9 from "../section-9";
// import Section10 from "../section-10";

export default function HomepageView() {
  return (
    <Fragment>
      {/* HERO SECTION */}
      <Suspense fallback={null}>
        <Section1 />
      </Suspense>

      {/* SERVICES SECTION */}
      <Suspense fallback={null}>
        <Section2 />
      </Suspense>

      {/* CATEGORIES SECTION */}
      <Suspense fallback={null}>
        <Section3 />
      </Suspense>

      {/* FLASH DEALS SECTION */}
      <Suspense fallback={null}>
        <Section4 />
      </Suspense>

      {/* PROMO OFFERS SECTION */}
      <Suspense fallback={null}>
        <Section5 />
      </Suspense>

      {/* TOP RATED PRODUCTS SECTION */}
      <Suspense fallback={null}>
        <Section6 />
      </Suspense>

      {/* GRID PRODUCTS SECTION */}
      <Suspense fallback={null}>
        <Section7 />
      </Suspense>

      {/*  CLIENTS SECTION */}
      <Suspense fallback={null}>
        <Section8 />
      </Suspense>

      {/* NEWSLETTER SECTION — isključeno
      <Suspense fallback={null}>
        <Section9 />
      </Suspense>
      */}

      {/* READ OUR BLOG SECTION — isključeno
      <Suspense fallback={null}>
        <Section10 />
      </Suspense>
      */}

      {/* POPUP NEWSLETTER FORM — isključeno
      <Newsletter />
      */}

      {/* DEMO POSTAVKE RASPOREDA — isključeno
      <Setting />
      */}
    </Fragment>
  );
}
