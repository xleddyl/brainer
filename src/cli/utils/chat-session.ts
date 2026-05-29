import pc from "picocolors";
import { render } from "ink";
import React from "react";
import type { LLMProvider, EmbedProvider } from "../../providers/types.js";
import type { RAGConfig } from "../../core/config/index.js";
import type { VectorStore } from "../../core/rag/store.js";
import { syncSpace } from "../../core/sync.js";
import { loadMemory, type ChatSession } from "../../core/spaces/index.js";
import { startSpinner } from "./spinner.js";
import { ChatApp } from "../tui/chat/ChatApp.js";

async function syncAndReport(
  spaceName: string,
  store: VectorStore,
  embedder: EmbedProvider,
): Promise<void> {
  const stopSync = startSpinner("syncing space...");
  let syncResult: Awaited<ReturnType<typeof syncSpace>>;
  try {
    syncResult = await syncSpace(spaceName, store, embedder, (action, name) => {
      stopSync();
      if (action === "ingest")
        process.stdout.write(`${pc.green("+")} ${name}\n`);
      else if (action === "update")
        process.stdout.write(`${pc.yellow("~")} ${name}\n`);
      else process.stdout.write(`${pc.red("-")} ${name}\n`);
    });
  } catch (e: any) {
    stopSync();
    process.stdout.write(pc.red(`Sync failed: ${e.message}\n`));
    syncResult = { ingested: [], updated: [], removed: [], errors: [] };
  }
  stopSync();
  const { ingested: si, updated: su, removed: sr, errors: se } = syncResult;
  if (si.length > 0 || su.length > 0 || sr.length > 0) {
    process.stdout.write(
      pc.dim(`  synced: +${si.length} ~${su.length} -${sr.length}\n`),
    );
  }
  for (const err of se) {
    process.stdout.write(pc.red(`  ✗ ${err}\n`));
  }
}

export async function startChat(
  spaceName: string,
  modelName: string,
  modelProvider: "local" | "remote",
  store: VectorStore,
  llm: LLMProvider,
  embedder: EmbedProvider,
  rag?: RAGConfig,
  existingSession?: ChatSession,
): Promise<void> {
  process.stdout.write("\x1b[H\x1b[J");
  process.stdout.write(pc.dim(`[${spaceName}]`) + "\n");

  await syncAndReport(spaceName, store, embedder);

  const memory = loadMemory(spaceName);
  const memoryFacts = memory.split("\n").filter(Boolean).length;
  if (memoryFacts > 0) {
    process.stdout.write(pc.dim(`  memory: ${memoryFacts} facts\n`));
  }
  process.stdout.write("\n");

  const { waitUntilExit } = render(
    React.createElement(ChatApp, {
      spaceName,
      modelName,
      modelProvider,
      store,
      llm,
      embedder,
      rag,
      existingSession,
    }),
  );

  await waitUntilExit();
}
