import pc from "picocolors";
import type { BrainerConfig } from "../../core/config/index.js";
import type { ChatSession } from "../../core/spaces/index.js";
import { resolveSpace, openStore } from "../../core/spaces/index.js";
import {
  createLLMProvider,
  createEmbedProvider,
} from "../../providers/index.js";
import { resolveModelUri } from "../../providers/local.js";
import { isDownloaded, pullModel } from "../../core/models.js";
import { startChat } from "./chat-session.js";
import { withCleanup } from "./lifecycle.js";
import { renderProgressBar } from "./progress.js";

export function resolveSpaceOrExit(
  config: BrainerConfig,
  spaceName?: string,
): string {
  try {
    return resolveSpace(config, spaceName);
  } catch (e: any) {
    console.error(pc.red(e.message));
    process.exit(1);
  }
}

export function resolveDisplayModel(config: BrainerConfig): {
  modelName: string;
  modelProvider: "local" | "remote";
} {
  const modelName =
    config.chat.provider === "local"
      ? (config.chat.local?.model ?? "local")
      : config.chat.remote?.model || config.chat.remote?.service || "remote";
  return { modelName, modelProvider: config.chat.provider };
}

async function ensureModels(config: BrainerConfig): Promise<void> {
  const needed: { name: string }[] = [];

  if (config.chat.provider === "local" && config.chat.local) {
    const uri = resolveModelUri(config.chat.local.model, config.models);
    if (!isDownloaded(uri)) needed.push({ name: config.chat.local.model });
  }

  if (config.embed.provider === "local" && config.embed.local) {
    const uri = resolveModelUri(config.embed.local.model, config.models);
    if (!isDownloaded(uri)) needed.push({ name: config.embed.local.model });
  }

  for (const m of needed) {
    const startTime = Date.now();
    process.stdin.setRawMode?.(true);
    process.stdin.resume();
    process.stdout.write("\x1b[?25l");
    const onData = (data: Buffer) => {
      if (data[0] === 3) process.exit(0);
    };
    process.stdin.on("data", onData);
    const result = await pullModel(config, m.name, (downloaded, total) => {
      if (total <= 0) return;
      process.stdout.write(
        `\r\x1b[K${renderProgressBar({ name: m.name, downloaded, total, startTime })}`,
      );
    });
    process.stdin.removeListener("data", onData);
    process.stdin.pause();
    process.stdin.setRawMode?.(false);
    process.stdout.write("\x1b[?25h\r\x1b[K");
    if (!result.ok) {
      console.error(pc.red(`Failed to pull ${m.name}: ${result.error}`));
      process.exit(1);
    }
    console.log(pc.green(`✓ ${m.name}`));
  }
}

export async function launchChat(
  config: BrainerConfig,
  space: string,
  existing?: ChatSession,
): Promise<void> {
  await ensureModels(config);

  const llm = createLLMProvider(config);
  const embedder = createEmbedProvider(config);
  await Promise.all([llm.start(), embedder.start()]);
  const store = openStore(space, embedder.dimensions());

  const { modelName, modelProvider } = resolveDisplayModel(config);

  await withCleanup([llm, embedder, store], () =>
    startChat(
      space,
      modelName,
      modelProvider,
      store,
      llm,
      embedder,
      config.rag,
      existing,
    ),
  );
}
