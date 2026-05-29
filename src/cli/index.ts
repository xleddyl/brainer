#!/usr/bin/env node

import { Command } from "commander";
import pc from "picocolors";
import { loadConfig } from "../core/config/index.js";
import {
  findChat,
  listChats,
  loadChat,
  listSpaces,
  type ChatSession,
} from "../core/spaces/index.js";
import { resolveSpaceOrExit, launchChat } from "./utils/launch.js";
import { registerConfigCommand } from "./commands/config.js";
import { registerIngestCommand } from "./commands/ingest.js";
import { registerSpaceCommand } from "./commands/space.js";
import { registerModelCommand } from "./commands/model.js";

const program = new Command()
  .name("brainer")
  .description("Local RAG system with llama.cpp")
  .version("0.1.0")
  .option("-s, --space <name>", "Space to use (resumes last chat)")
  .option("-c, --chat <id>", "Resume a chat by ID (searches all spaces)")
  .action(async (opts: { space?: string; chat?: string }) => {
    const config = loadConfig();

    let space: string;
    let existing: ChatSession | undefined;

    if (opts.chat) {
      const found = findChat(opts.chat);
      if (!found) {
        const spaces = listSpaces();
        const hint =
          spaces.length > 0
            ? `Searched in: ${spaces.join(", ")}`
            : "No spaces exist. Create one first:\n  brainer space create <name>";
        console.error(pc.red(`Chat "${opts.chat}" not found. ${hint}`));
        process.exit(1);
      }
      space = found.spaceName;
      existing = found.session;
    } else {
      space = resolveSpaceOrExit(config, opts.space);

      if (opts.space) {
        const chats = listChats(space);
        if (chats.length > 0) {
          existing = loadChat(space, chats[0].id) ?? undefined;
        }
      }
    }

    await launchChat(config, space, existing);
  });

registerConfigCommand(program);
registerIngestCommand(program);
registerSpaceCommand(program);
registerModelCommand(program);

program.parse();
