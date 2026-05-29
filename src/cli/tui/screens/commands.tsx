import React from "react";
import { Box, Text, useInput } from "ink";
import { Chrome } from "../primitives.js";
import { useCursor } from "../hooks.js";
import { HINTS } from "../../../constants.js";
import type { ScreenProps } from "../types.js";

const commands = [
  {
    name: "brainer",
    desc: "Open this interactive config menu",
  },
  {
    name: "brainer chat -s <space>",
    desc: "Start a RAG chat session with a knowledge space. Loads the LLM and embed models, then opens an interactive prompt where your questions are answered using documents ingested into the space.",
  },
  {
    name: "brainer ingest <files...> -s <space>",
    desc: "Ingest documents into a space. Files are chunked, embedded, and stored in the space's vector database for later retrieval during chat.",
  },
  {
    name: "brainer space list",
    desc: "List all knowledge spaces.",
  },
  {
    name: "brainer space create <name>",
    desc: "Create a new knowledge space.",
  },
  {
    name: "brainer space delete <name>",
    desc: "Delete a space and all its documents. Requires confirmation.",
  },
  {
    name: "brainer space info <name>",
    desc: "Show a space's ingested documents.",
  },
  {
    name: "brainer model list",
    desc: "List registered models with download status and active flags.",
  },
  {
    name: "brainer model add <name> <uri> [--embed]",
    desc: "Register a model by name. URI is a HuggingFace GGUF path (e.g. hf:user/repo/file.gguf). Use --embed for embedding models, otherwise it's a chat model.",
  },
  {
    name: "brainer model remove <name>",
    desc: "Unregister a model and delete its downloaded file. Requires confirmation.",
  },
  {
    name: "brainer model use <name>",
    desc: "Set a model as the active chat or embed model (based on its type).",
  },
  {
    name: "brainer model pull [name]",
    desc: "Download a model from HuggingFace. Without a name, pulls all registered models.",
  },
];

export function CommandsScreen({ back }: ScreenProps) {
  const { i, up, down } = useCursor(commands.length);

  useInput((_input, key) => {
    if (key.escape) back();
    if (key.upArrow) up();
    else if (key.downArrow) down();
  });

  return (
    <Chrome title="Commands" path="brainer" hint={HINTS.SCROLL}>
      {commands.map((cmd, idx) => (
        <Box key={idx} flexDirection="column" marginBottom={idx === i ? 0 : 0}>
          <Text color={idx === i ? "cyan" : undefined}>
            {idx === i ? "› " : "  "}
            <Text bold>{cmd.name}</Text>
          </Text>
          {idx === i && (
            <Text dimColor>
              {"    "}
              {cmd.desc}
            </Text>
          )}
        </Box>
      ))}
    </Chrome>
  );
}
