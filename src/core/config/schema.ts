import { type } from "arktype";
import {
  DEFAULT_CONTEXT_SIZE,
  DEFAULT_GPU_LAYERS,
  DEFAULT_TEMPERATURE,
  DEFAULT_TOP_P,
  DEFAULT_TOP_K,
  DEFAULT_REPEAT_PENALTY,
} from "../../constants.js";

const ModelEntry = type({
  name: "string",
  uri: "string",
  type: "'chat' | 'embed'",
});

const InferenceConfig = type({
  "contextSize?": "number",
  "temperature?": "number",
  "topP?": "number",
  "topK?": "number",
  "repeatPenalty?": "number",
  "seed?": "number",
});

const LocalChatConfig = type({
  model: "string",
  "gpuLayers?": "number",
  "inference?": InferenceConfig,
});

const LocalEmbedConfig = type({
  model: "string",
  "gpuLayers?": "number",
});

const RemoteProviderConfig = type({
  format: "'openai' | 'anthropic'",
  service: "string",
  url: "string",
  apiKey: "string",
  model: "string",
});

const ChatConfig = type({
  provider: "'local' | 'remote'",
  "local?": LocalChatConfig,
  "remote?": RemoteProviderConfig,
});

const EmbedConfig = type({
  provider: "'local' | 'remote'",
  "local?": LocalEmbedConfig,
  "remote?": RemoteProviderConfig,
});

const RAGConfig = type({
  "maxSources?": "number",
  "relevanceThreshold?": "number",
});

export const BrainerConfigSchema = type({
  chat: ChatConfig,
  embed: EmbedConfig,
  models: ModelEntry.array(),
  "rag?": RAGConfig,
  "lastSpace?": "string",
});

export type ModelEntry = typeof ModelEntry.infer;
export type InferenceConfig = typeof InferenceConfig.infer;
export type LocalChatConfig = typeof LocalChatConfig.infer;
export type LocalEmbedConfig = typeof LocalEmbedConfig.infer;
export type RemoteProviderConfig = typeof RemoteProviderConfig.infer;
export type ChatConfig = typeof ChatConfig.infer;
export type EmbedConfig = typeof EmbedConfig.infer;
export type RAGConfig = typeof RAGConfig.infer;
export type BrainerConfig = typeof BrainerConfigSchema.infer;

export const BUILTIN_MODELS: ModelEntry[] = [
  {
    name: "gemma4-e4b",
    uri: "hf:unsloth/gemma-4-E4B-it-GGUF/gemma-4-E4B-it-Q4_K_M.gguf",
    type: "chat",
  },
  {
    name: "bge-m3",
    uri: "hf:gpustack/bge-m3-GGUF/bge-m3-Q8_0.gguf",
    type: "embed",
  },
];

export const DEFAULT_CONFIG: BrainerConfig = {
  chat: {
    provider: "local",
    local: {
      model: "gemma4-e4b",
      gpuLayers: DEFAULT_GPU_LAYERS,
      inference: {
        contextSize: DEFAULT_CONTEXT_SIZE,
        temperature: DEFAULT_TEMPERATURE,
        topP: DEFAULT_TOP_P,
        topK: DEFAULT_TOP_K,
        repeatPenalty: DEFAULT_REPEAT_PENALTY,
      },
    },
  },
  embed: {
    provider: "local",
    local: {
      model: "bge-m3",
      gpuLayers: DEFAULT_GPU_LAYERS,
    },
  },
  models: [...BUILTIN_MODELS],
};
