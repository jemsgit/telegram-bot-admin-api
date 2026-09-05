import { createContext, useContext } from "react";
import type { ApiClient } from "./client";

const ApiClientContext = createContext<ApiClient | null>(null);

export const ApiClientProvider = ApiClientContext.Provider;

export function useApiClient(): ApiClient {
  const client = useContext(ApiClientContext);
  if (!client) {
    throw new Error("useApiClient: нет ApiClientProvider выше по дереву");
  }
  return client;
}
