import MockAdapter from "axios-mock-adapter";
import * as db from "./data";

const flashProducts = db.products.filter((product) => product.for.type === "flash-deals");
const topRatedProducts = db.products.filter((product) => product.for.type === "top-rated");

const allProducts = [...flashProducts.slice(0, 4), ...topRatedProducts.slice(3, 6)];

/** Minimal demo shops for mock adapter (shop module removed). */
const shopList = [
  {
    id: "shop-1",
    slug: "tech-store",
    thumbnail: "herman miller",
    user: {
      id: "user-1",
      email: "contact@techstore.com",
      phone: "",
      avatar: "/assets/images/avatars/001-man.svg",
      password: "",
      dateOfBirth: "",
      verified: true,
      name: { firstName: "Tech", lastName: "Store" }
    },
    email: "contact@techstore.com",
    name: "Tech Store",
    phone: "",
    address: "",
    verified: true,
    coverPicture: "/assets/images/banners/banner-6.png",
    profilePicture: "/assets/images/faces/propic.png",
    socialLinks: { facebook: null, youtube: null, twitter: null, instagram: null }
  },
  {
    id: "shop-2",
    slug: "gadget-hub",
    thumbnail: "otobi",
    user: {
      id: "user-2",
      email: "info@gadgethub.com",
      phone: "",
      avatar: "/assets/images/avatars/002-girl.svg",
      password: "",
      dateOfBirth: "",
      verified: true,
      name: { firstName: "Gadget", lastName: "Hub" }
    },
    email: "info@gadgethub.com",
    name: "Gadget Hub",
    phone: "",
    address: "",
    verified: true,
    coverPicture: "/assets/images/banners/banner.png",
    profilePicture: "/assets/images/faces/propic(1).png",
    socialLinks: { facebook: null, youtube: null, twitter: null, instagram: null }
  }
];

export const HomepageMockEndpoints = (Mock: MockAdapter) => {
  // get all service
  Mock.onGet("/api/homepage/service").reply(() => {
    try {
      return [200, db.serviceList];
    } catch (err) {
      console.error(err);
      return [500, { message: "Internal server error" }];
    }
  });

  // get all carousel data
  Mock.onGet("/api/homepage/main-carousel").reply(async () => {
    try {
      return [200, db.mainCarouselData];
    } catch (err) {
      console.error(err);
      return [500, { message: "Internal server error" }];
    }
  });

  // flash deals products
  Mock.onGet("/api/homepage/flash-deals").reply(async () => {
    try {
      return [200, flashProducts];
    } catch (err) {
      console.error(err);
      return [500, { message: "Internal server error" }];
    }
  });

  // top rated products
  Mock.onGet("/api/homepage/top-rated").reply(async () => {
    try {
      return [200, topRatedProducts];
    } catch (err) {
      console.error(err);
      return [500, { message: "Internal server error" }];
    }
  });

  // all products
  Mock.onGet("/api/homepage/products").reply(async () => {
    try {
      return [200, allProducts];
    } catch (err) {
      console.error(err);
      return [500, { message: "Internal server error" }];
    }
  });

  // get all shops
  Mock.onGet("/api/homepage/shops").reply(async () => {
    try {
      return [200, shopList];
    } catch (err) {
      console.error(err);
      return [500, { message: "Internal server error" }];
    }
  });

  // get all brands
  Mock.onGet("/api/homepage/brand").reply(async () => {
    try {
      return [200, db.brands];
    } catch (err) {
      console.error(err);
      return [500, { message: "Internal server error" }];
    }
  });

  // get all articles
  Mock.onGet("/api/homepage/articles").reply(async () => {
    try {
      return [200, db.articles];
    } catch (err) {
      console.error(err);
      return [500, { message: "Internal server error" }];
    }
  });

  // get all clients
  Mock.onGet("/api/homepage/clients").reply(async () => {
    try {
      return [200, db.clients];
    } catch (err) {
      console.error(err);
      return [500, { message: "Internal server error" }];
    }
  });
};
