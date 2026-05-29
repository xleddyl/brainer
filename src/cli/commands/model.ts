import type { Command } from "commander";
import pc from "picocolors";
import { loadConfig, saveConfig } from "../../core/config/index.js";
import {
  listModels,
  addModel,
  removeModel,
  useModel,
  pullModel,
  pullAllModels,
} from "../../core/models.js";
import { confirm } from "../utils/confirm.js";

export function registerModelCommand(program: Command): void {
  const cmd = program.command("model").description("Manage models");

  cmd
    .command("list")
    .description("List models")
    .action(() => {
      const config = loadConfig();
      const models = listModels(config);
      if (models.length === 0) {
        console.log(pc.dim("No models"));
        return;
      }
      models.forEach((m) => {
        const dl = m.downloaded ? pc.green("✓") : pc.red("✗");
        const active = m.active ? pc.cyan(" active") : "";
        console.log(`  ${dl} ${m.name} ${pc.dim(m.type)}${active}`);
      });
    });

  cmd
    .command("add <name> <uri>")
    .description("Register a model")
    .option("--embed", "Embed model (default: chat)")
    .action((name: string, uri: string, opts: { embed?: boolean }) => {
      const config = loadConfig();
      addModel(config, { name, uri, type: opts.embed ? "embed" : "chat" });
      saveConfig(config);
      console.log(`${pc.green("✓")} ${name}`);
    });

  cmd
    .command("remove <name>")
    .description("Remove a model")
    .option("-y, --yes", "Skip confirmation")
    .action(async (name: string, opts: { yes?: boolean }) => {
      if (!opts.yes) {
        const ok = await confirm(`Remove model "${name}" and delete its file?`);
        if (!ok) {
          console.log(pc.dim("Cancelled"));
          return;
        }
      }
      const config = loadConfig();
      const result = await removeModel(config, name);
      if (!result.deleted) {
        console.error(pc.red(`Not found: ${name}`));
        process.exit(1);
      }
      saveConfig(config);
      console.log(
        `${pc.green("✓")} removed ${name}${result.filename ? pc.dim(` (${result.filename})`) : ""}`,
      );
    });

  cmd
    .command("use <name>")
    .description("Set model as active")
    .action((name: string) => {
      const config = loadConfig();
      const result = useModel(config, name);
      if (!result.ok) {
        console.error(pc.red(`Not found: ${name}`));
        process.exit(1);
      }
      saveConfig(config);
      console.log(`${pc.green("✓")} ${name} → ${result.role}`);
    });

  cmd
    .command("pull [name]")
    .description("Download model(s)")
    .action(async (name?: string) => {
      const config = loadConfig();
      if (name) {
        const result = await pullModel(config, name);
        if (result.ok) console.log(`${pc.green("✓")} ${result.path}`);
        else {
          console.error(pc.red(`Failed: ${result.error}`));
          process.exit(1);
        }
      } else {
        await pullAllModels(config, (n, status) => {
          if (status === "start")
            process.stdout.write(pc.dim(`  pulling ${n}...`));
          else if (status === "done")
            process.stdout.write(` ${pc.green("✓")}\n`);
          else process.stdout.write(` ${pc.red("✗")}\n`);
        });
      }
    });
}
