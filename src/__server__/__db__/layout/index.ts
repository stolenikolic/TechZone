// FOLLOWING CODES ARE MOCK SERVER IMPLEMENTATION
// YOU NEED TO BUILD YOUR OWN SERVER
// IF YOU NEED HELP ABOUT SERVER SIDE IMPLEMENTATION
// CONTACT US AT support@ui-lib.com
import MockAdapter from "axios-mock-adapter";
import * as db from "./data";
import navbarNavigation from "data/navbarNavigation";
import { categoryMenus } from "data/navigations";

export const LayoutEndpoints = (Mock: MockAdapter) => {
  Mock.onGet("/api/layout").reply(() => {
    try {
      return [
        200,
        {
          footer: {
            appStoreUrl: "#",
            playStoreUrl: "#",
            logo: "/assets/images/logo.svg",
            contact: db.footerContact,
            about: db.footerAboutLinks,
            socials: db.footerSocialLinks,
            description: db.footerDescription,
            customers: db.footerCustomerCareLinks
          },
          mobileNavigation: {
            version1: db.mobileNavigation,
            version2: db.mobileNavigationTwo,
            logo: "/assets/images/bazaar-black-sm.svg"
          },
          topbar: {
            label: "HOT",
            title: "Free Express Shipping",
            socials: db.topbarSocialLinks,
            languageOptions: db.languageOptions
          },
          header: {
            categories: db.categories,
            categoryMenus: categoryMenus,
            navigation: navbarNavigation,
            logo: "/assets/images/logo2.svg"
          }
        }
      ];
    } catch (err) {
      console.error(err);
      return [500, { message: "Internal server error" }];
    }
  });
};
