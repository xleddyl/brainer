export interface GenerateOptions {
  prompt: string;
  temperature?: number;
  topP?: number;
  topK?: number;
  repeatPenalty?: number;
  seed?: number;
  maxTokens?: number;
  stopStrings?: string[];
  onToken?: (text: string) => void;
}

export interface ChatMessage {
  role: string;
  content: string;
}

export interface NativeLlamaModel {
  load(opts: { modelPath: string; gpuLayers?: number }): Promise<void>;
  createContext(opts: { contextSize: number }): NativeLlamaContext;
  createEmbedder(): NativeLlamaEmbedder;
  embeddingDimensions(): number;
  dispose(): void;
}

export interface NativeLlamaContext {
  generate(opts: GenerateOptions): Promise<string>;
  applyChatTemplate(
    messages: ChatMessage[],
    addGenerationPrompt: boolean,
  ): string;
  dispose(): void;
}

export interface NativeLlamaEmbedder {
  embed(text: string): Promise<Float32Array>;
  dispose(): void;
}

export interface NativeAddon {
  LlamaModel: { new (): NativeLlamaModel };
  LlamaContext: { new (): NativeLlamaContext };
  LlamaEmbedder: { new (): NativeLlamaEmbedder };
}
