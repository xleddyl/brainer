import type { RemoteProviderConfig } from "../core/config/index.js";
import { buildAuthHeaders } from "./headers.js";

export type ApiFormat = "openai" | "anthropic";

export interface ProviderDef {
  id: string;
  name: string;
  url: string;
  format: ApiFormat;
  supportsEmbed: boolean;
}

export const REMOTE_PROVIDERS: ProviderDef[] = [
  {
    id: "openai",
    name: "OpenAI",
    url: "https://api.openai.com/v1",
    format: "openai",
    supportsEmbed: true,
  },
  {
    id: "gemini",
    name: "Google Gemini",
    url: "https://generativelanguage.googleapis.com/v1beta/openai",
    format: "openai",
    supportsEmbed: true,
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    url: "https://api.deepseek.com/v1",
    format: "openai",
    supportsEmbed: true,
  },
  {
    id: "kimi",
    name: "Kimi",
    url: "https://api.moonshot.ai/v1",
    format: "openai",
    supportsEmbed: true,
  },
  {
    id: "groq",
    name: "Groq",
    url: "https://api.groq.com/openai/v1",
    format: "openai",
    supportsEmbed: false,
  },
  {
    id: "together",
    name: "Together",
    url: "https://api.together.xyz/v1",
    format: "openai",
    supportsEmbed: true,
  },
  {
    id: "mistral",
    name: "Mistral",
    url: "https://api.mistral.ai/v1",
    format: "openai",
    supportsEmbed: true,
  },
  {
    id: "cohere",
    name: "Cohere",
    url: "https://api.cohere.ai/compatibility/v1",
    format: "openai",
    supportsEmbed: true,
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    url: "https://openrouter.ai/api/v1",
    format: "openai",
    supportsEmbed: true,
  },
  {
    id: "anthropic",
    name: "Anthropic",
    url: "https://api.anthropic.com/v1",
    format: "anthropic",
    supportsEmbed: false,
  },
  {
    id: "custom",
    name: "Custom",
    url: "",
    format: "openai",
    supportsEmbed: true,
  },
];

export function getProviderDef(id: string): ProviderDef | undefined {
  return REMOTE_PROVIDERS.find((p) => p.id === id);
}

export function getProviderFormat(config: RemoteProviderConfig): ApiFormat {
  if (config.service === "custom") return config.format;
  return getProviderDef(config.service)?.format ?? config.format;
}

export function getServicesForFormat(
  format: ApiFormat,
  embedOnly = false,
): ProviderDef[] {
  return REMOTE_PROVIDERS.filter(
    (p) =>
      (p.format === format || p.id === "custom") &&
      (!embedOnly || p.supportsEmbed),
  );
}

export async function listRemoteModels(
  config: RemoteProviderConfig,
): Promise<string[]> {
  const format = getProviderFormat(config);
  const res = await fetch(`${config.url}/models`, {
    headers: buildAuthHeaders(config, format),
  });
  if (!res.ok) throw new Error(`${res.status}`);
  const data = (await res.json()) as any;

  return (data.data ?? []).map((m: any) => m.id as string).sort();
}
