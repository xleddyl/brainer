import type { Command } from "commander";
import pc from "picocolors";
import {
  createSpace,
  deleteSpace,
  listSpaces,
  getSpaceInfo,
} from "../../core/spaces/index.js";
import { doubleConfirm } from "../utils/confirm.js";

export function registerSpaceCommand(program: Command): void {
  const cmd = program.command("space").description("Manage knowledge spaces");

  cmd
    .command("list")
    .description("List spaces")
    .action(() => {
      const spaces = listSpaces();
      if (spaces.length === 0) {
        console.log(pc.dim("No spaces"));
        return;
      }
      spaces.forEach((s) => console.log(`  ${s}`));
    });

  cmd
    .command("create <name>")
    .description("Create a space")
    .action((name: string) => {
      createSpace(name);
      console.log(`${pc.green("✓")} ${name}`);
    });

  cmd
    .command("delete <name>")
    .description("Delete a space")
    .option("-y, --yes", "Skip confirmation")
    .action(async (name: string, opts: { yes?: boolean }) => {
      if (!opts.yes) {
        const ok = await doubleConfirm(
          `Delete space "${name}" and all its documents?`,
          name,
        );
        if (!ok) {
          console.log(pc.dim("Cancelled"));
          return;
        }
      }
      deleteSpace(name);
      console.log(`${pc.green("✓")} deleted ${name}`);
    });

  cmd
    .command("info <name>")
    .description("Show space info")
    .action((name: string) => {
      const info = getSpaceInfo(name);
      console.log(`  ${info.name} — ${info.documents.length} documents`);
      info.documents.forEach((d) =>
        console.log(`    ${d.filename} ${pc.dim(d.modifiedAt)}`),
      );
    });
}
