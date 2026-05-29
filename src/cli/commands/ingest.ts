import type { Command } from "commander";
import pc from "picocolors";
import { existsSync } from "node:fs";
import { loadConfig } from "../../core/config/index.js";
import { openStore, documentsDir } from "../../core/spaces/index.js";
import { createEmbedProvider } from "../../providers/index.js";
import { ingestFile } from "../../core/rag/ingest.js";
import { withCleanup } from "../utils/lifecycle.js";
import { resolveSpaceOrExit } from "../utils/launch.js";

export function registerIngestCommand(program: Command): void {
  program
    .command("ingest <files...>")
    .description("Ingest documents into a space")
    .option("-s, --space <name>", "Target space")
    .action(async (files: string[], opts: { space?: string }) => {
      const config = loadConfig();
      const space = resolveSpaceOrExit(config, opts.space);

      const embedder = createEmbedProvider(config);
      await embedder.start();
      const store = openStore(space, embedder.dimensions());

      await withCleanup([embedder, store], async () => {
        for (const file of files) {
          if (!existsSync(file)) {
            console.error(pc.red(`Not found: ${file}`));
            continue;
          }
          const result = await ingestFile(file, store, embedder, {
            documentsDir: documentsDir(space),
          });
          console.log(
            `${pc.green("✓")} ${file} ${pc.dim(`(${result.chunks} chunks)`)}`,
          );
        }
      });
    });
}
