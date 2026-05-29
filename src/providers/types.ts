export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface Provider {
  name: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  healthy(): Promise<boolean>;
}

export interface LLMProvider extends Provider {
  chat(messages: Message[]): Promise<string>;
  chatStream(messages: Message[]): AsyncIterable<string>;
  complete(prompt: string): Promise<string>;
}

export interface EmbedProvider extends Provider {
  embed(text: string): Promise<number[]>;
  dimensions(): number;
}
