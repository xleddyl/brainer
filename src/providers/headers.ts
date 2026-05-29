import type { RemoteProviderConfig } from "../core/config/index.js";
import type { ApiFormat } from "./registry.js";

export function buildAuthHeaders(
  config: RemoteProviderConfig,
  format: ApiFormat,
): Record<string, string> {
  if (format === "anthropic") {
    return {
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
    };
  }
  return { Authorization: `Bearer ${config.apiKey}` };
}

export function buildRequestHeaders(
  config: RemoteProviderConfig,
  format: ApiFormat,
): Record<string, string> {
  return {
    "Content-Type": "application/json",
    ...buildAuthHeaders(config, format),
  };
}
