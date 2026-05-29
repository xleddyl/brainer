import { readFile, copyFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import type { EmbedProvider } from "../../providers/types.js";
import type { VectorStore } from "./store.js";
import { chunkText } from "./chunker.js";

export interface IngestOptions {
  documentsDir?: string;
}

export async function ingestFile(
  filePath: string,
  store: VectorStore,
  embedder: EmbedProvider,
  options: IngestOptions = {},
): Promise<{ documentId: string; chunks: number }> {
  const content = await readFile(filePath, "utf-8");
  const filename = basename(filePath);

  if (options.documentsDir) {
    await copyFile(filePath, join(options.documentsDir, filename));
  }

  return ingestText(content, filename, store, embedder);
}

export async function ingestText(
  text: string,
  name: string,
  store: VectorStore,
  embedder: EmbedProvider,
): Promise<{ documentId: string; chunks: number }> {
  const documentId = randomUUID();
  const fileHash = createHash("sha256").update(text).digest("hex");

  store.addDocument(documentId, name, fileHash);

  const chunks = chunkText(text);

  for (let i = 0; i < chunks.length; i++) {
    const tagged = `[${name}]\n${chunks[i]}`;
    const embedding = await embedder.embed(tagged);
    store.addChunk(documentId, tagged, embedding, { filename: name });
  }

  return { documentId, chunks: chunks.length };
}

export async function ingestChat(
  messages: { role: string; content: string }[],
  name: string,
  store: VectorStore,
  embedder: EmbedProvider,
  fileHash?: string,
): Promise<{ documentId: string; chunks: number }> {
  const documentId = randomUUID();
  if (!fileHash) {
    const fullText = messages.map((m) => `${m.role}: ${m.content}`).join("\n");
    fileHash = createHash("sha256").update(fullText).digest("hex");
  }

  store.addDocument(documentId, name, fileHash);

  let count = 0;
  for (let i = 0; i < messages.length; i += 2) {
    const user = messages[i];
    const assistant = messages[i + 1];
    if (!user) continue;
    const chunk = assistant
      ? `user: ${user.content}\nassistant: ${assistant.content}`
      : `user: ${user.content}`;
    const embedding = await embedder.embed(chunk);
    store.addChunk(documentId, chunk, embedding, { filename: name });
    count++;
  }

  return { documentId, chunks: count };
}
