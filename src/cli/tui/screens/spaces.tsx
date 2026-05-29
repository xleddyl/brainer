import React, { useState, useEffect } from "react";
import { existsSync, unlinkSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { Box, Text, useInput } from "ink";
import { Chrome, Row, TextField, Spinner, useConfirm } from "../primitives.js";
import { useCursor, useTextBuffer } from "../hooks.js";
import { HINTS } from "../../../constants.js";
import {
  createSpace,
  deleteSpace,
  listSpaces,
  getSpaceInfo,
  openStore,
  listChats,
  deleteChat,
  documentsDir,
  writeMemory,
} from "../../../core/spaces/index.js";
import type { ScreenProps, Nav, MenuAction } from "../types.js";

export function SpacesScreen({ nav, back }: ScreenProps & { nav: Nav }) {
  const [spaces, setSpaces] = useState(listSpaces);
  const { i, up, down } = useCursor(spaces.length + 1);
  const cf = useConfirm();

  useInput((input, key) => {
    if (cf.active) {
      if (input === "y") {
        if (cf.step === 0) {
          cf.advance();
        } else {
          deleteSpace(spaces[i]);
          setSpaces(listSpaces());
          cf.reset();
        }
      } else if (input === "n" || key.escape) {
        cf.cancel();
      }
      return;
    }

    if (key.escape) return back();
    if (key.upArrow) up();
    else if (key.downArrow) down();
    else if (key.return) {
      if (i < spaces.length) nav({ id: "space-detail", name: spaces[i] });
      else nav({ id: "space-add" });
    } else if (input === "d" && i < spaces.length) {
      cf.start();
    }
  });

  const hint = cf.active
    ? cf.step === 0
      ? `Delete "${spaces[i]}"? y/n`
      : `Are you sure? This cannot be undone. y/n`
    : HINTS.NAV_OPEN_DELETE;

  return (
    <Chrome title="Spaces" path="brainer" hint={hint}>
      {spaces.length === 0 && <Text dimColor>{"  "}No spaces yet</Text>}
      {spaces.map((s, idx) => (
        <Row key={s} selected={idx === i}>
          <Text
            bold={idx === i}
            color={cf.active && idx === i ? "red" : undefined}
          >
            {s}
          </Text>
        </Row>
      ))}
      <Row selected={i === spaces.length}>
        <Text>+ </Text>
        <Text bold={i === spaces.length}>Create space</Text>
      </Row>
    </Chrome>
  );
}

export function SpaceAddScreen({ back }: ScreenProps) {
  const tb = useTextBuffer();
  const [error, setError] = useState("");

  useEffect(() => {
    tb.open("");
  }, []);

  useInput((input, key) => {
    if (key.escape) return back();
    if (key.return && tb.buf) {
      try {
        createSpace(tb.buf);
        back();
      } catch (e: any) {
        setError(e.message);
      }
      return;
    }
    if (key.backspace || key.delete) tb.del();
    else if (input && !key.ctrl && !key.meta) tb.type(input);
  });

  return (
    <Chrome
      title="Create Space"
      path="brainer › spaces"
      hint={HINTS.TEXT_SUBMIT}
    >
      <TextField label="Name" value="" selected editing buffer={tb.buf} />
      {error && (
        <Text color="red">
          {"  "}
          {error}
        </Text>
      )}
    </Chrome>
  );
}

type SpaceItem =
  | { kind: "chat"; id: string; name: string; date: string }
  | { kind: "doc"; filename: string; date: string }
  | { kind: "action"; action: "new-chat" | "rebuild" | "clear-memory" };

function buildItems(name: string): SpaceItem[] {
  const items: SpaceItem[] = [];

  for (const c of listChats(name)) {
    items.push({
      kind: "chat",
      id: c.id,
      name: c.name,
      date: c.createdAt.slice(0, 10),
    });
  }

  const info = getSpaceInfo(name);
  for (const d of info.documents) {
    items.push({
      kind: "doc",
      filename: d.filename,
      date: d.modifiedAt.slice(0, 10),
    });
  }

  items.push({ kind: "action", action: "new-chat" });
  items.push({ kind: "action", action: "rebuild" });
  items.push({ kind: "action", action: "clear-memory" });

  return items;
}

export function SpaceDetailScreen({
  back,
  name,
  onAction,
  onRebuild,
}: ScreenProps & {
  name: string;
  onAction: (a: MenuAction) => void;
  onRebuild: (space: string) => Promise<void>;
}) {
  const [items, setItems] = useState(() => buildItems(name));
  const { i, up, down } = useCursor(items.length);
  const cf = useConfirm();
  const [rebuilding, setRebuilding] = useState(false);

  useInput((input, key) => {
    if (rebuilding) return;

    if (cf.active) {
      if (input === "y") {
        if (cf.step === 0) {
          cf.advance();
        } else {
          const item = items[i];
          if (item.kind === "chat") {
            deleteChat(name, item.id);
          } else if (item.kind === "doc") {
            try {
              const s = openStore(name);
              const docs = s.listDocuments();
              const doc = docs.find((d) => d.filename === item.filename);
              if (doc) s.removeDocument(doc.id);
              s.close();
              const path = join(documentsDir(name), item.filename);
              if (existsSync(path)) unlinkSync(path);
            } catch {}
          } else if (item.kind === "action" && item.action === "clear-memory") {
            writeMemory(name, "");
          }
          setItems(buildItems(name));
          cf.reset();
        }
      } else if (input === "n" || key.escape) {
        cf.cancel();
      }
      return;
    }

    if (key.escape) return back();
    if (key.upArrow) up();
    else if (key.downArrow) down();
    else if (key.return && items.length > 0) {
      const item = items[i];
      if (item.kind === "chat") {
        onAction({ type: "open-chat", space: name, chatId: item.id });
      } else if (item.kind === "doc") {
        try {
          const path = join(documentsDir(name), item.filename);
          execSync(`open ${JSON.stringify(path)}`);
        } catch {}
      } else if (item.kind === "action") {
        if (item.action === "new-chat") {
          onAction({ type: "new-chat", space: name });
        } else if (item.action === "rebuild") {
          setRebuilding(true);
          onRebuild(name).finally(() => {
            setItems(buildItems(name));
            setRebuilding(false);
          });
        } else if (item.action === "clear-memory") {
          cf.start();
        }
      }
    } else if (input === "d" && items.length > 0) {
      const item = items[i];
      if (item.kind === "chat" || item.kind === "doc") {
        cf.start();
      }
    }
  });

  const chatItems = items.filter((it) => it.kind === "chat");
  const docItems = items.filter((it) => it.kind === "doc");

  const hint = cf.active
    ? cf.step === 0
      ? `Delete? y/n`
      : `Are you sure? y/n`
    : HINTS.NAV_OPEN_DELETE;

  return (
    <Chrome title={name} path="brainer › spaces" hint={hint}>
      {/* Chats section */}
      <Text dimColor>
        {"  "}Chats ({chatItems.length})
      </Text>
      {chatItems.length === 0 && <Text dimColor>{"    "}No chats yet</Text>}
      {items.map((item, itemIdx) => {
        if (item.kind !== "chat") return null;
        const selected = i === itemIdx;
        return (
          <Row key={item.id} selected={selected}>
            <Text
              bold={selected}
              color={cf.active && selected ? "red" : undefined}
            >
              {item.name}
            </Text>
            <Text dimColor>
              {"  "}
              {item.date}
            </Text>
          </Row>
        );
      })}

      {/* Documents section */}
      <Box marginTop={1}>
        <Text dimColor>
          {"  "}Documents ({docItems.length})
        </Text>
      </Box>
      {docItems.length === 0 && (
        <Text dimColor>
          {"    "}No documents — ingest with: brainer ingest {"<file>"} -s{" "}
          {name}
        </Text>
      )}
      {items.map((item, itemIdx) => {
        if (item.kind !== "doc") return null;
        const selected = i === itemIdx;
        return (
          <Row key={item.filename} selected={selected}>
            <Text
              bold={selected}
              color={cf.active && selected ? "red" : undefined}
            >
              {item.filename}
            </Text>
            <Text dimColor>
              {"  "}
              {item.date}
            </Text>
          </Row>
        );
      })}

      {/* Actions */}
      <Box marginTop={1}>
        <Text dimColor>{"  "}─</Text>
      </Box>
      {items.map((item, itemIdx) => {
        if (item.kind !== "action") return null;
        const selected = i === itemIdx;
        if (item.action === "rebuild" && rebuilding) {
          return (
            <Box key={item.action}>
              <Text>{"  "}</Text>
              <Spinner text="rebuilding vector store..." />
            </Box>
          );
        }
        const label =
          item.action === "new-chat"
            ? "+ New chat"
            : item.action === "rebuild"
              ? "⟳ Rebuild vector store"
              : "✗ Clear memory";
        return (
          <Row key={item.action} selected={selected}>
            <Text bold={selected}>{label}</Text>
          </Row>
        );
      })}
    </Chrome>
  );
}
