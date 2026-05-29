import type { BrainerConfig } from "../core/config/index.js";
import type { LLMProvider, EmbedProvider } from "./types.js";
import { LocalLLMProvider, LocalEmbedProvider } from "./local.js";
import {
  RemoteLLMProvider,
  AnthropicLLMProvider,
  RemoteEmbedProvider,
} from "./remote.js";
import { getProviderDef } from "./registry.js";

export function createLLMProvider(config: BrainerConfig): LLMProvider {
  if (config.chat.provider === "local") {
    if (!config.chat.local) throw new Error("Missing local chat config");
    return new LocalLLMProvider(config.chat.local, config.models);
  }
  if (!config.chat.remote) throw new Error("Missing remote chat config");
  if (config.chat.remote.format === "anthropic") {
    return new AnthropicLLMProvider(config.chat.remote);
  }
  return new RemoteLLMProvider(config.chat.remote);
}

export function createEmbedProvider(config: BrainerConfig): EmbedProvider {
  if (config.embed.provider === "local") {
    if (!config.embed.local) throw new Error("Missing local embed config");
    return new LocalEmbedProvider(config.embed.local, config.models);
  }
  if (!config.embed.remote) throw new Error("Missing remote embed config");
  const def = getProviderDef(config.embed.remote.service);
  if (def && !def.supportsEmbed) {
    throw new Error(`${def.name} does not support embeddings`);
  }
  return new RemoteEmbedProvider(config.embed.remote);
}

export type { LLMProvider, EmbedProvider, Message } from "./types.js";
