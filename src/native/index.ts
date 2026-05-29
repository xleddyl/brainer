import { createRequire } from "node:module";
import { join } from "node:path";
import type {
  NativeAddon,
  NativeLlamaModel,
  NativeLlamaContext,
  NativeLlamaEmbedder,
  GenerateOptions,
  ChatMessage,
} from "./types.js";

const require = createRequire(import.meta.url);
const addon: NativeAddon = require(
  join(import.meta.dirname, "../../native/build/Release/brainer-llama.node"),
);

export type {
  NativeLlamaContext,
  NativeLlamaEmbedder,
  GenerateOptions,
  ChatMessage,
};

export async function loadModel(opts: {
  modelPath: string;
  gpuLayers?: number;
}): Promise<NativeLlamaModel> {
  const model = new addon.LlamaModel();
  await model.load(opts);
  return model;
}
