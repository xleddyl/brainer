import {
  loadModel,
  type NativeLlamaContext,
  type NativeLlamaEmbedder,
} from "../native/index.js";
import type { NativeLlamaModel } from "../native/types.js";
import { resolveModelFile } from "../native/hub.js";
import { MODELS_DIR } from "../paths.js";
import {
  DEFAULT_GPU_LAYERS,
  DEFAULT_CONTEXT_SIZE,
  DEFAULT_TEMPERATURE,
  DEFAULT_TOP_P,
  DEFAULT_TOP_K,
  DEFAULT_REPEAT_PENALTY,
  COMPLETE_CONTEXT_SIZE,
} from "../constants.js";
import type {
  LocalChatConfig,
  LocalEmbedConfig,
  ModelEntry,
} from "../core/config/index.js";
import type { LLMProvider, EmbedProvider, Message } from "./types.js";

export function resolveModelUri(name: string, models: ModelEntry[]): string {
  const entry = models.find((m) => m.name === name);
  return entry ? entry.uri : name;
}

abstract class BaseLocalProvider {
  protected model: NativeLlamaModel | null = null;

  constructor(protected models: ModelEntry[]) {}

  protected async loadModel(
    modelName: string,
    gpuLayers?: number,
  ): Promise<void> {
    if (this.model) return;
    const uri = resolveModelUri(modelName, this.models);
    const modelPath = await resolveModelFile(uri, {
      directory: MODELS_DIR,
      download: false,
    });
    this.model = await loadModel({
      modelPath,
      gpuLayers: gpuLayers ?? DEFAULT_GPU_LAYERS,
    });
  }

  protected disposeBase(): void {
    if (this.model) {
      this.model.dispose();
      this.model = null;
    }
  }
}

const COMMON_STOP_STRINGS = [
  "<end_of_turn>",
  "<|im_end|>",
  "<|eot_id|>",
  "</s>",
];

function detectStopStrings(ctx: NativeLlamaContext): string[] {
  const sentinel = "__BRAINER_SENTINEL__";
  const rendered = ctx.applyChatTemplate(
    [
      { role: "user", content: "hi" },
      { role: "assistant", content: sentinel },
    ],
    false,
  );
  const idx = rendered.lastIndexOf(sentinel);
  const detected: string[] = [];
  if (idx >= 0) {
    const suffix = rendered.slice(idx + sentinel.length).trim();
    if (suffix) detected.push(suffix);
  }
  for (const s of COMMON_STOP_STRINGS) {
    if (!detected.includes(s)) detected.push(s);
  }
  return detected;
}

export class LocalLLMProvider extends BaseLocalProvider implements LLMProvider {
  name = "local-llm";
  private context: NativeLlamaContext | null = null;
  private stopStrings: string[] = [];

  constructor(
    private config: LocalChatConfig,
    models: ModelEntry[] = [],
  ) {
    super(models);
  }

  async start(): Promise<void> {
    await this.loadModel(this.config.model, this.config.gpuLayers);
    this.context = this.model!.createContext({
      contextSize: this.config.inference?.contextSize ?? DEFAULT_CONTEXT_SIZE,
    });
    this.stopStrings = detectStopStrings(this.context);
  }

  async stop(): Promise<void> {
    if (this.context) {
      this.context.dispose();
      this.context = null;
    }
    this.disposeBase();
  }

  async healthy(): Promise<boolean> {
    return this.model !== null;
  }

  private get inferenceParams() {
    const inf = this.config.inference;
    return {
      temperature: inf?.temperature ?? DEFAULT_TEMPERATURE,
      topP: inf?.topP ?? DEFAULT_TOP_P,
      topK: inf?.topK ?? DEFAULT_TOP_K,
      repeatPenalty: inf?.repeatPenalty ?? DEFAULT_REPEAT_PENALTY,
      seed: inf?.seed,
    };
  }

  private buildPrompt(messages: Message[]): string {
    return this.context!.applyChatTemplate(
      messages.map((m) => ({ role: m.role, content: m.content })),
      true,
    );
  }

  async chat(messages: Message[]): Promise<string> {
    if (!this.context) throw new Error("Provider not started");
    const prompt = this.buildPrompt(messages);
    return this.context.generate({
      prompt,
      ...this.inferenceParams,
      stopStrings: this.stopStrings,
    });
  }

  async *chatStream(messages: Message[]): AsyncIterable<string> {
    if (!this.context) throw new Error("Provider not started");
    const prompt = this.buildPrompt(messages);

    const queue: string[] = [];
    let resolve: (() => void) | null = null;
    let done = false;

    const generatePromise = this.context
      .generate({
        prompt,
        ...this.inferenceParams,
        stopStrings: this.stopStrings,
        onToken: (text: string) => {
          queue.push(text);
          resolve?.();
        },
      })
      .then(() => {
        done = true;
        resolve?.();
      });

    while (!done || queue.length > 0) {
      if (queue.length > 0) {
        yield queue.shift()!;
      } else {
        await new Promise<void>((r) => {
          resolve = r;
        });
      }
    }
    await generatePromise;
  }

  async complete(prompt: string): Promise<string> {
    if (!this.model) throw new Error("Provider not started");
    const tempCtx = this.model.createContext({
      contextSize: COMPLETE_CONTEXT_SIZE,
    });
    const response = await tempCtx.generate({ prompt });
    tempCtx.dispose();
    return response;
  }
}

export class LocalEmbedProvider
  extends BaseLocalProvider
  implements EmbedProvider
{
  name = "local-embed";
  private embedder: NativeLlamaEmbedder | null = null;
  private _dimensions = 0;

  constructor(
    private config: LocalEmbedConfig,
    models: ModelEntry[] = [],
  ) {
    super(models);
  }

  dimensions(): number {
    return this._dimensions;
  }

  async start(): Promise<void> {
    await this.loadModel(this.config.model, this.config.gpuLayers);
    this.embedder = this.model!.createEmbedder();
    this._dimensions = this.model!.embeddingDimensions();
  }

  async stop(): Promise<void> {
    if (this.embedder) {
      this.embedder.dispose();
      this.embedder = null;
    }
    this.disposeBase();
  }

  async healthy(): Promise<boolean> {
    return this.embedder !== null;
  }

  async embed(text: string): Promise<number[]> {
    if (!this.embedder) throw new Error("Embed provider not started");
    const result = await this.embedder.embed(text);
    return Array.from(result);
  }
}
