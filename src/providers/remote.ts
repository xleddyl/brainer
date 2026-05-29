import type { RemoteProviderConfig } from "../core/config/index.js";
import type { LLMProvider, EmbedProvider, Message } from "./types.js";
import { buildAuthHeaders, buildRequestHeaders } from "./headers.js";
import type { ApiFormat } from "./registry.js";

async function apiError(label: string, res: Response): Promise<Error> {
  let detail = "";
  try {
    const body = await res.json();
    detail =
      body?.error?.message ?? body?.message ?? JSON.stringify(body?.error);
  } catch {}
  return new Error(`${label}: ${res.status}${detail ? ` — ${detail}` : ""}`);
}

async function* parseSSE(res: Response): AsyncIterable<any> {
  if (!res.body) throw new Error("No response body");
  const decoder = new TextDecoder();
  const reader = res.body.getReader();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const text = decoder.decode(value, { stream: true });
    for (const line of text.split("\n")) {
      if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
      try {
        yield JSON.parse(line.slice(6));
      } catch {}
    }
  }
}

abstract class BaseRemoteProvider {
  protected headers: Record<string, string>;
  protected authHeaders: Record<string, string>;

  constructor(
    protected config: RemoteProviderConfig,
    format: ApiFormat,
  ) {
    this.headers = buildRequestHeaders(config, format);
    this.authHeaders = buildAuthHeaders(config, format);
  }

  async start(): Promise<void> {
    if (!(await this.healthy())) {
      throw new Error(`${this.constructor.name} is not reachable`);
    }
  }

  async stop(): Promise<void> {}

  async healthy(): Promise<boolean> {
    try {
      const res = await fetch(`${this.config.url}/models`, {
        headers: this.authHeaders,
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}

// ── OpenAI-compatible ──

export class RemoteLLMProvider
  extends BaseRemoteProvider
  implements LLMProvider
{
  name = "remote-llm";

  constructor(config: RemoteProviderConfig) {
    super(config, "openai");
  }

  async chat(messages: Message[]): Promise<string> {
    const res = await fetch(`${this.config.url}/chat/completions`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({ messages, model: this.config.model }),
    });
    if (!res.ok) throw await apiError("Remote LLM", res);
    const data = (await res.json()) as any;
    return data.choices[0].message.content;
  }

  async *chatStream(messages: Message[]): AsyncIterable<string> {
    const res = await fetch(`${this.config.url}/chat/completions`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({
        messages,
        model: this.config.model,
        stream: true,
      }),
    });
    if (!res.ok) throw await apiError("Remote LLM stream", res);

    for await (const json of parseSSE(res)) {
      const delta = json.choices?.[0]?.delta?.content;
      if (delta) yield delta;
    }
  }

  async complete(prompt: string): Promise<string> {
    return this.chat([{ role: "user", content: prompt }]);
  }
}

// ── Anthropic Messages API ──

export class AnthropicLLMProvider
  extends BaseRemoteProvider
  implements LLMProvider
{
  name = "anthropic-llm";

  constructor(config: RemoteProviderConfig) {
    super(config, "anthropic");
  }

  private buildBody(messages: Message[], stream = false) {
    const system = messages.find((m) => m.role === "system")?.content;
    const nonSystem = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role, content: m.content }));

    return {
      model: this.config.model,
      max_tokens: 4096,
      stream,
      ...(system ? { system } : {}),
      messages: nonSystem,
    };
  }

  async chat(messages: Message[]): Promise<string> {
    const res = await fetch(`${this.config.url}/messages`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(this.buildBody(messages)),
    });
    if (!res.ok) throw await apiError("Anthropic", res);
    const data = (await res.json()) as any;
    const text = data.content
      ?.filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("");
    return text ?? "";
  }

  async *chatStream(messages: Message[]): AsyncIterable<string> {
    const res = await fetch(`${this.config.url}/messages`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(this.buildBody(messages, true)),
    });
    if (!res.ok) throw await apiError("Anthropic stream", res);

    for await (const json of parseSSE(res)) {
      if (
        json.type === "content_block_delta" &&
        json.delta?.type === "text_delta"
      ) {
        yield json.delta.text;
      }
    }
  }

  async complete(prompt: string): Promise<string> {
    return this.chat([{ role: "user", content: prompt }]);
  }
}

// ── Embed (OpenAI-compatible only) ──

export class RemoteEmbedProvider
  extends BaseRemoteProvider
  implements EmbedProvider
{
  name = "remote-embed";
  private dims = 0;

  constructor(config: RemoteProviderConfig) {
    super(config, "openai");
  }

  dimensions(): number {
    return this.dims;
  }

  async start(): Promise<void> {
    await super.start();
    const probe = await this.embed("test");
    this.dims = probe.length;
  }

  async embed(text: string): Promise<number[]> {
    const res = await fetch(`${this.config.url}/embeddings`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({ input: text, model: this.config.model }),
    });
    if (!res.ok) throw await apiError("Remote embed", res);
    const data = (await res.json()) as any;
    return data.data[0].embedding;
  }
}
