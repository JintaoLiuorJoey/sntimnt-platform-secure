export type DataSource = "mock" | "api";

const mode = import.meta.env.MODE;
const mockAllowed = mode === "development" || mode === "demo" || mode === "test";
const requestedDataSource = import.meta.env.VITE_DATA_SOURCE?.trim().toLowerCase();
const dataSource = (requestedDataSource || (mockAllowed ? "mock" : "api")) as DataSource;
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() ?? "";

if (dataSource !== "mock" && dataSource !== "api") {
  throw new Error("Invalid VITE_DATA_SOURCE. Expected `mock` or `api`.");
}

if (!mockAllowed && dataSource === "mock") {
  throw new Error("Mock data is disabled outside development and demo modes.");
}

if (dataSource === "api" && !apiBaseUrl) {
  throw new Error("VITE_API_BASE_URL is required when VITE_DATA_SOURCE=api.");
}

export const runtimeConfig = Object.freeze({
  mode,
  dataSource,
  apiBaseUrl: apiBaseUrl.replace(/\/$/, ""),
  isMock: dataSource === "mock",
  isApi: dataSource === "api",
});
