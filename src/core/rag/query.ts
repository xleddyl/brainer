import type {
  LLMProvider,
  EmbedProvider,
  Message,
} from "../../providers/types.js";
import type { VectorStore, SearchResult } from "./store.js";
import type { RAGConfig } from "../config/index.js";
import { RAG_MAX_SOURCES, RAG_RELEVANCE_THRESHOLD } from "../../constants.js";
import { SYSTEM_PROMPT, CONTEXT_TEMPLATE } from "../prompts.js";

export interface QueryOptions {
  rag?: RAGConfig;
  memory?: string;
  history?: Message[];
  forcedContext?: string[];
}

export interface RAGResponse {
  answer: string;
  sources: SearchResult[];
}

export async function query(
  question: string,
  store: VectorStore,
  llm: LLMProvider,
  embedder: EmbedProvider,
  opts: QueryOptions = {},
): Promise<RAGResponse> {
  const maxSources = opts.rag?.maxSources ?? RAG_MAX_SOURCES;
  const threshold = opts.rag?.relevanceThreshold ?? RAG_RELEVANCE_THRESHOLD;

  const queryEmbedding = await embedder.embed(question);
  const sources = store.search(queryEmbedding, maxSources);
  const messages = buildMessages(
    question,
    sources,
    threshold,
    opts.memory,
    opts.history,
    opts.forcedContext,
  );
  const answer = await llm.chat(messages);
  return { answer, sources };
}

export async function* queryStream(
  question: string,
  store: VectorStore,
  llm: LLMProvider,
  embedder: EmbedProvider,
  opts: QueryOptions = {},
): AsyncIterable<
  { type: "sources"; data: SearchResult[] } | { type: "token"; data: string }
> {
  const maxSources = opts.rag?.maxSources ?? RAG_MAX_SOURCES;
  const threshold = opts.rag?.relevanceThreshold ?? RAG_RELEVANCE_THRESHOLD;

  const queryEmbedding = await embedder.embed(question);
  const sources = store.search(queryEmbedding, maxSources);

  yield { type: "sources", data: sources };

  const messages = buildMessages(
    question,
    sources,
    threshold,
    opts.memory,
    opts.history,
    opts.forcedContext,
  );

  for await (const token of llm.chatStream(messages)) {
    yield { type: "token", data: token };
  }
}

function buildMessages(
  question: string,
  sources: SearchResult[],
  threshold: number,
  memory = "",
  history: Message[] = [],
  forcedContext: string[] = [],
): Message[] {
  const relevant = sources.filter((s) => s.distance < threshold);

  const contextParts: string[] = [];
  let idx = 1;
  for (const chunk of forcedContext) {
    contextParts.push(`[${idx++}] ${chunk}`);
  }
  for (const s of relevant) {
    contextParts.push(`[${idx++}] ${s.content}`);
  }

  let userContent: string;
  if (contextParts.length > 0) {
    const context = contextParts.join("\n---\n");
    userContent = CONTEXT_TEMPLATE(question, context);
  } else {
    userContent = question;
  }

  return [
    { role: "system", content: SYSTEM_PROMPT(memory) },
    ...history,
    { role: "user", content: userContent },
  ];
}
