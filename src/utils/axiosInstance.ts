import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import { AdminDashboardEndpoints } from "__server__/__db__/dashboard";
import { getServerBaseUrl } from "utils/site-url";

// Server-side: relative URLs need an origin. Browser resolves them automatically.
const baseURL = typeof window === "undefined" ? getServerBaseUrl() : "";

const axiosInstance = axios.create({
  baseURL,
});

// Mock only admin dashboard endpoints; all other requests pass through.
export const Mock = new MockAdapter(axiosInstance);
AdminDashboardEndpoints(Mock);
Mock.onAny().passThrough();

export default axiosInstance;
