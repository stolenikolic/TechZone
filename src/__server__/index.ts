import MockAdapter from "axios-mock-adapter";

import { HomepageMockEndpoints } from "./__db__/homepage-demo";
import { RelatedProductsEndpoints } from "./__db__/related-products";
import { UsersEndpoints } from "./__db__/users";
import { TicketsEndpoints } from "./__db__/ticket";
import { VendorEndpoints } from "./__db__/vendor";
import { UserOrders1Endpoints } from "./__db__/orders";
import { UserAddressEndpoints } from "./__db__/address";
import { ProductsEndpoints } from "./__db__/products";
import { AdminDashboardEndpoints } from "./__db__/dashboard";
import { LayoutEndpoints } from "./__db__/layout";
import { CartEndpoints } from "./__db__/cart";

export const MockEndPoints = (Mock: MockAdapter) => {
  HomepageMockEndpoints(Mock);
  UsersEndpoints(Mock);
  VendorEndpoints(Mock);
  TicketsEndpoints(Mock);
  ProductsEndpoints(Mock);
  UserAddressEndpoints(Mock);
  UserOrders1Endpoints(Mock);
  AdminDashboardEndpoints(Mock);
  RelatedProductsEndpoints(Mock);
  LayoutEndpoints(Mock);
  CartEndpoints(Mock);

  Mock.onAny().passThrough();
};
