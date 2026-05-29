import { existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import type { Command } from "commander";
import { loadConfig, saveConfig } from "../../core/config/index.js";
import { openStore, loadChat, spaceDir } from "../../core/spaces/index.js";
import { syncSpace } from "../../core/sync.js";
import { createEmbedProvider } from "../../providers/index.js";
import { launchChat } from "../utils/launch.js";
import { configMenu } from "../config-menu.js";

export function registerConfigCommand(program: Command): void {
  program
    .command("config")
    .description("Open interactive config menu")
    .action(async () => {
      const config = loadConfig();

      const rebuildStore = async (space: string) => {
        const dbPath = join(spaceDir(space), "store.db");
        if (existsSync(dbPath)) unlinkSync(dbPath);
        const embedder = createEmbedProvider(config);
        await embedder.start();
        const store = openStore(space, embedder.dimensions());
        try {
          await syncSpace(space, store, embedder);
        } finally {
          store.close();
          await embedder.stop();
        }
      };

      const action = await configMenu(config, saveConfig, rebuildStore);

      if (!action) return;

      process.stdin.ref();
      process.stdin.resume();

      const space = action.space;
      const existing =
        action.type === "open-chat"
          ? (loadChat(space, action.chatId) ?? undefined)
          : undefined;

      await launchChat(config, space, existing);
    });
}
