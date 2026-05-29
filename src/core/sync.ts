import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { spaceDir } from "./spaces/lifecycle.js";
import { ingestFile, ingestChat } from "./rag/ingest.js";
import type { VectorStore } from "./rag/store.js";
import type { EmbedProvider } from "../providers/types.js";

export interface SyncResult {
  ingested: string[];
  updated: string[];
  removed: string[];
  errors: string[];
}

interface SyncItem {
  name: string;
  filePath: string;
  hash: string;
}

export async function syncSpace(
  spaceName: string,
  store: VectorStore,
  embedder: EmbedProvider,
  onProgress?: (action: "ingest" | "update" | "remove", name: string) => void,
): Promise<SyncResult> {
  const dir = spaceDir(spaceName);
  const docsDir = join(dir, "documents");
  const chatsDir = join(dir, "chats");

  const dbDocs = store.listDocuments();
  const dbByFilename = new Map(dbDocs.map((d) => [d.filename, d]));

  const ingested: string[] = [];
  const updated: string[] = [];
  const removed: string[] = [];
  const errors: string[] = [];

  const diskFiles = safeReadDir(docsDir);
  const chatFiles = safeReadDir(chatsDir).filter((f) => f.endsWith(".json"));

  const allDiskNames = new Set([
    ...diskFiles,
    ...chatFiles.map((f) => `chat:${f}`),
  ]);

  const docItems: SyncItem[] = diskFiles.map((f) => ({
    name: f,
    filePath: join(docsDir, f),
    hash: hashFile(join(docsDir, f)),
  }));

  const chatItems: SyncItem[] = chatFiles.map((f) => ({
    name: `chat:${f}`,
    filePath: join(chatsDir, f),
    hash: hashFile(join(chatsDir, f)),
  }));

  await syncItems(
    docItems,
    dbByFilename,
    store,
    onProgress,
    ingested,
    updated,
    errors,
    (item) => ingestFile(item.filePath, store, embedder),
  );

  await syncItems(
    chatItems,
    dbByFilename,
    store,
    onProgress,
    ingested,
    updated,
    errors,
    async (item) => {
      const messages = parseChatMessages(item.filePath);
      if (messages.length > 0)
        await ingestChat(messages, item.name, store, embedder, item.hash);
    },
  );

  for (const doc of dbDocs) {
    if (!allDiskNames.has(doc.filename)) {
      onProgress?.("remove", doc.filename);
      store.removeDocument(doc.id);
      removed.push(doc.filename);
    }
  }

  return { ingested, updated, removed, errors };
}

async function syncItems(
  items: SyncItem[],
  dbByFilename: Map<string, { id: string; fileHash: string | null }>,
  store: VectorStore,
  onProgress:
    | ((action: "ingest" | "update" | "remove", name: string) => void)
    | undefined,
  ingested: string[],
  updated: string[],
  errors: string[],
  ingestFn: (item: SyncItem) => Promise<any>,
): Promise<void> {
  for (const item of items) {
    const existing = dbByFilename.get(item.name);
    try {
      if (!existing) {
        onProgress?.("ingest", item.name);
        await ingestFn(item);
        ingested.push(item.name);
      } else if (existing.fileHash && existing.fileHash !== item.hash) {
        onProgress?.("update", item.name);
        store.removeDocument(existing.id);
        await ingestFn(item);
        updated.push(item.name);
      }
    } catch (e: any) {
      errors.push(`${item.name}: ${e.message}`);
    }
  }
}

function safeReadDir(dir: string): string[] {
  try {
    return readdirSync(dir).filter((f) => !f.startsWith("."));
  } catch {
    return [];
  }
}

function hashFile(path: string): string {
  try {
    const content = readFileSync(path);
    return createHash("sha256").update(content).digest("hex");
  } catch {
    return "";
  }
}

function parseChatMessages(path: string): { role: string; content: string }[] {
  try {
    const chat = JSON.parse(readFileSync(path, "utf-8"));
    return chat.messages?.filter((m: any) => m.role && m.content) ?? [];
  } catch {
    return [];
  }
}
