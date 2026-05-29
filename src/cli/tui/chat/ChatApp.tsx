import React, { useState, useCallback, useRef } from "react";
import { Box, Text, Static, useInput, useApp } from "ink";
import type { LLMProvider, EmbedProvider } from "../../../providers/types.js";
import type { RAGConfig } from "../../../core/config/index.js";
import type { VectorStore } from "../../../core/rag/store.js";
import { query } from "../../../core/rag/query.js";
import { ingestFile } from "../../../core/rag/ingest.js";
import {
  saveChat,
  documentsDir,
  loadMemory,
  processMemoryTags,
  type ChatSession,
  type ChatMessage,
} from "../../../core/spaces/index.js";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { marked } from "marked";
import { markedTerminal } from "marked-terminal";
import pc from "picocolors";
import { addBorder } from "../../utils/text.js";
import {
  listFiles,
  getCompletedPath,
  type FileEntry,
} from "../../utils/file-picker.js";
import { InputArea } from "./InputArea.js";
import { StatusBar } from "./StatusBar.js";
import { Spinner } from "../primitives.js";

marked.use(
  markedTerminal({
    firstHeading: pc.bold,
    heading: pc.bold,
    strong: pc.bold,
    em: pc.italic,
    codespan: pc.dim,
    code: pc.dim,
    blockquote: pc.dim,
    link: pc.underline,
    href: pc.underline,
    html: pc.reset,
    hr: pc.reset,
    paragraph: pc.reset,
    del: pc.dim,
    table: pc.reset,
    showSectionPrefix: false,
  }) as any,
);

function renderMarkdown(text: string): string {
  return (marked.parse(text) as string).trimEnd();
}

function parseFileRefs(input: string): { files: string[]; question: string } {
  const files: string[] = [];
  const cleaned = input.replace(
    /@"([^"]+)"|@(\S+)/g,
    (_match, quoted, bare) => {
      files.push(resolve(quoted ?? bare));
      return "";
    },
  );
  return { files, question: cleaned.trim() };
}

interface DisplayMessage {
  id: string;
  role: "user" | "assistant" | "status";
  content: string;
}

export function ChatApp({
  spaceName,
  modelName,
  modelProvider,
  store,
  llm,
  embedder,
  rag,
  existingSession,
}: {
  spaceName: string;
  modelName: string;
  modelProvider: "local" | "remote";
  store: VectorStore;
  llm: LLMProvider;
  embedder: EmbedProvider;
  rag?: RAGConfig;
  existingSession?: ChatSession;
}) {
  const { exit } = useApp();

  const msgCounter = useRef(0);

  const [displayMessages, setDisplayMessages] = useState<DisplayMessage[]>(
    () => {
      if (!existingSession?.messages.length) return [];
      return existingSession.messages.map((msg) => ({
        id: `msg-${msgCounter.current++}`,
        role: msg.role === "user" ? ("user" as const) : ("assistant" as const),
        content: msg.content,
      }));
    },
  );
  const chatRef = useRef<ChatMessage[]>(
    existingSession ? [...existingSession.messages] : [],
  );
  const sessionRef = useRef<ChatSession>(
    existingSession
      ? { ...existingSession, messages: chatRef.current }
      : {
          id: randomUUID(),
          createdAt: new Date().toISOString(),
          messages: chatRef.current,
        },
  );
  const memoryRef = useRef(loadMemory(spaceName));
  const ingestedRef = useRef(new Set<string>());
  const [memoryCount, setMemoryCount] = useState(() => {
    return memoryRef.current.split("\n").filter(Boolean).length;
  });

  const [buf, setBuf] = useState("");
  const [cursor, setCursor] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerItems, setPickerItems] = useState<FileEntry[]>([]);
  const [pickerIdx, setPickerIdx] = useState(0);

  function persist() {
    try {
      saveChat(spaceName, sessionRef.current);
    } catch {}
  }

  function addDisplay(role: DisplayMessage["role"], content: string) {
    setDisplayMessages((prev) => [
      ...prev,
      { id: `msg-${msgCounter.current++}`, role, content },
    ]);
  }

  function getAtCtx(
    b: string,
    c: number,
  ): { partial: string; start: number } | null {
    let i = c - 1;
    while (i >= 0 && b[i] !== " " && b[i] !== "\n" && b[i] !== "@") i--;
    if (i < 0 || b[i] !== "@") return null;
    return { partial: b.slice(i + 1, c), start: i };
  }

  function refreshPicker(b: string, c: number) {
    const ctx = getAtCtx(b, c);
    if (ctx) {
      setPickerOpen(true);
      const items = listFiles(ctx.partial || ".");
      setPickerItems(items);
      setPickerIdx((prev) => Math.min(prev, Math.max(0, items.length - 1)));
    } else {
      setPickerOpen(false);
      setPickerItems([]);
      setPickerIdx(0);
    }
  }

  const submit = useCallback(async () => {
    const raw = buf;
    if (!raw.trim()) return;

    setBuf("");
    setCursor(0);
    setPickerOpen(false);
    setPickerItems([]);

    const { files, question } = parseFileRefs(raw);

    addDisplay("user", raw.trim());

    const ingestedNames: string[] = [];
    const forcedContext: string[] = [];
    if (files.length > 0) {
      for (const file of files) {
        const filename = file.split("/").pop()!;
        if (ingestedRef.current.has(file)) {
          ingestedNames.push(filename);
          forcedContext.push(...store.getChunksByFilename(filename));
          continue;
        }
        if (!existsSync(file)) {
          addDisplay("status", pc.red(`  not found: ${file}`));
          continue;
        }
        try {
          const result = await ingestFile(file, store, embedder, {
            documentsDir: documentsDir(spaceName),
          });
          ingestedRef.current.add(file);
          ingestedNames.push(filename);
          forcedContext.push(...store.getChunksByFilename(filename));
          addDisplay(
            "status",
            `${pc.green("+")} ${file} ${pc.dim(`(${result.chunks} chunks)`)}`,
          );
        } catch (e: any) {
          addDisplay("status", pc.red(`  ingest failed: ${e.message}`));
        }
      }
    }

    if (!question && ingestedNames.length === 0) return;

    const contextualQuestion = question
      ? ingestedNames.length > 0
        ? `[referencing: ${ingestedNames.join(", ")}] ${question}`
        : question
      : `[referencing: ${ingestedNames.join(", ")}] Describe the referenced files.`;

    setLoading(true);

    try {
      const history = chatRef.current.map(({ role, content }) => ({
        role,
        content,
      }));
      const result = await query(contextualQuestion, store, llm, embedder, {
        rag,
        memory: memoryRef.current,
        history,
        forcedContext,
      });

      const {
        cleanResponse: rawResponse,
        memory: updatedMemory,
        updated: memoryUpdated,
      } = processMemoryTags(spaceName, result.answer, memoryRef.current);
      memoryRef.current = updatedMemory;
      const cleanResponse = rawResponse.trim();

      addDisplay("assistant", cleanResponse);

      if (memoryUpdated) {
        addDisplay("status", pc.dim(`${pc.green("✓")} memory updated`));
        setMemoryCount(updatedMemory.split("\n").filter(Boolean).length);
      }

      const ts = new Date().toISOString();
      chatRef.current.push({
        role: "user",
        content: contextualQuestion,
        timestamp: ts,
      });
      chatRef.current.push({
        role: "assistant",
        content: cleanResponse,
        timestamp: ts,
      });
      persist();
    } catch (e: any) {
      addDisplay("status", pc.red(`Error: ${e.message}`));
    }

    setLoading(false);
  }, [buf, spaceName, store, llm, embedder, rag]);

  function pick(b: string, c: number): { newBuf: string; newCursor: number } {
    if (!pickerOpen || pickerItems.length === 0)
      return { newBuf: b, newCursor: c };
    const item = pickerItems[pickerIdx];
    const ctx = getAtCtx(b, c);
    if (!ctx) return { newBuf: b, newCursor: c };
    const completed = getCompletedPath(ctx.partial || "", item);
    const before = b.slice(0, ctx.start + 1);
    const after = b.slice(c);
    const newBuf = before + completed + after;
    const newCursor = before.length + completed.length;
    if (item.isDir) {
      refreshPicker(newBuf, newCursor);
    } else {
      setPickerOpen(false);
      setPickerItems([]);
    }
    return { newBuf, newCursor };
  }

  function wordLeftPos(b: string, c: number): number {
    let i = c - 1;
    while (i > 0 && /\s/.test(b[i])) i--;
    while (i > 0 && !/\s/.test(b[i - 1])) i--;
    return Math.max(0, i);
  }

  function wordRightPos(b: string, c: number): number {
    let i = c;
    while (i < b.length && !/\s/.test(b[i])) i++;
    while (i < b.length && /\s/.test(b[i])) i++;
    return i;
  }

  function logicalPos(b: string, c: number): { row: number; col: number } {
    const before = b.slice(0, c);
    const lines = before.split("\n");
    return { row: lines.length - 1, col: lines[lines.length - 1].length };
  }

  useInput(
    (input, key) => {
      if (loading) return;

      let b = buf;
      let c = cursor;

      if (key.ctrl && input === "c") {
        exit();
        return;
      }

      // Shift+Enter or Alt+Enter → newline
      if (key.return && (key.shift || key.meta)) {
        b = b.slice(0, c) + "\n" + b.slice(c);
        c += 1;
      }
      // Enter
      else if (key.return) {
        if (pickerOpen && pickerItems.length > 0) {
          const r = pick(b, c);
          b = r.newBuf;
          c = r.newCursor;
        } else {
          submit();
          return;
        }
      }
      // Tab
      else if (key.tab) {
        if (pickerOpen) {
          const r = pick(b, c);
          b = r.newBuf;
          c = r.newCursor;
        }
      }
      // Up arrow
      else if (key.upArrow) {
        if (pickerOpen && pickerIdx > 0) {
          setPickerIdx((i) => i - 1);
          return;
        }
        const { row, col } = logicalPos(b, c);
        if (row > 0) {
          const lines = b.split("\n");
          const newCol = Math.min(col, lines[row - 1].length);
          let pos = 0;
          for (let i = 0; i < row - 1; i++) pos += lines[i].length + 1;
          c = pos + newCol;
        }
      }
      // Down arrow
      else if (key.downArrow) {
        if (pickerOpen && pickerIdx < pickerItems.length - 1) {
          setPickerIdx((i) => i + 1);
          return;
        }
        const { row, col } = logicalPos(b, c);
        const lines = b.split("\n");
        if (row < lines.length - 1) {
          const newCol = Math.min(col, lines[row + 1].length);
          let pos = 0;
          for (let i = 0; i <= row; i++) pos += lines[i].length + 1;
          c = pos + newCol;
        } else {
          c = b.length;
        }
      }
      // Left arrow
      else if (key.leftArrow) {
        if (key.meta) {
          c = wordLeftPos(b, c);
        } else if (c > 0) {
          c--;
        }
      }
      // Right arrow
      else if (key.rightArrow) {
        if (key.meta) {
          c = wordRightPos(b, c);
        } else if (c < b.length) {
          c++;
        }
      }
      // Escape
      else if (key.escape) {
        setPickerOpen(false);
        setPickerItems([]);
        return;
      }
      // Backspace
      else if (key.backspace) {
        if (key.meta) {
          // Option+Backspace: delete word back
          const newC = wordLeftPos(b, c);
          b = b.slice(0, newC) + b.slice(c);
          c = newC;
        } else if (c > 0) {
          b = b.slice(0, c - 1) + b.slice(c);
          c--;
        }
      }
      // Delete
      else if (key.delete) {
        if (key.meta) {
          const newC = wordRightPos(b, c);
          b = b.slice(0, c) + b.slice(newC);
        } else if (c < b.length) {
          b = b.slice(0, c) + b.slice(c + 1);
        }
      }
      // Ctrl+W: delete word back
      else if (key.ctrl && input === "w") {
        const newC = wordLeftPos(b, c);
        b = b.slice(0, newC) + b.slice(c);
        c = newC;
      }
      // Ctrl+U: clear all
      else if (key.ctrl && input === "u") {
        b = "";
        c = 0;
      }
      // Ctrl+A: line start
      else if (key.ctrl && input === "a") {
        const { row } = logicalPos(b, c);
        const lines = b.split("\n");
        let pos = 0;
        for (let i = 0; i < row; i++) pos += lines[i].length + 1;
        c = pos;
      }
      // Ctrl+E: line end
      else if (key.ctrl && input === "e") {
        const { row } = logicalPos(b, c);
        const lines = b.split("\n");
        let pos = 0;
        for (let i = 0; i < row; i++) pos += lines[i].length + 1;
        c = pos + lines[row].length;
      }
      // Regular character
      else if (input && !key.ctrl && !key.meta) {
        b = b.slice(0, c) + input + b.slice(c);
        c += input.length;
      } else {
        return;
      }

      setBuf(b);
      setCursor(c);
      refreshPicker(b, c);
    },
    { isActive: !loading },
  );

  return (
    <Box flexDirection="column">
      <Static items={displayMessages}>
        {(msg) => (
          <Box key={msg.id} flexDirection="column">
            {msg.role === "user" ? (
              <Box>
                <Text color="blue">{"> "}</Text>
                <Text>{msg.content}</Text>
              </Box>
            ) : msg.role === "assistant" ? (
              <Text>
                {"\n" + addBorder(renderMarkdown(msg.content)) + "\n"}
              </Text>
            ) : (
              <Text>{msg.content + "\n"}</Text>
            )}
          </Box>
        )}
      </Static>

      {loading && <Spinner text="thinking..." />}

      {!loading && (
        <InputArea
          buf={buf}
          cursor={cursor}
          active={true}
          pickerOpen={pickerOpen}
          pickerItems={pickerItems}
          pickerIdx={pickerIdx}
        />
      )}

      <StatusBar space={spaceName} model={modelName} provider={modelProvider} />
    </Box>
  );
}
