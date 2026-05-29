import {
  existsSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  unlinkSync,
} from "node:fs";
import { join } from "node:path";
import { spaceDir, listSpaces } from "./lifecycle.js";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface ChatSession {
  id: string;
  name?: string;
  createdAt: string;
  messages: ChatMessage[];
}

function chatsDir(spaceName: string): string {
  const dir = join(spaceDir(spaceName), "chats");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

export function saveChat(spaceName: string, session: ChatSession): void {
  if (!session.name) {
    const firstMsg = session.messages.find((m) => m.role === "user");
    if (firstMsg) session.name = firstMsg.content.slice(0, 50).trim();
  }
  const file = join(chatsDir(spaceName), `${session.id}.json`);
  writeFileSync(file, JSON.stringify(session, null, 2) + "\n");
}

export function loadChat(spaceName: string, id: string): ChatSession | null {
  const file = join(chatsDir(spaceName), `${id}.json`);
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, "utf-8"));
}

export function listChats(
  spaceName: string,
): { id: string; name: string; createdAt: string; preview: string }[] {
  const dir = chatsDir(spaceName);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      try {
        const data: ChatSession = JSON.parse(
          readFileSync(join(dir, f), "utf-8"),
        );
        const firstMsg = data.messages.find((m) => m.role === "user");
        return {
          id: data.id,
          name: data.name ?? firstMsg?.content.slice(0, 50).trim() ?? "(empty)",
          createdAt: data.createdAt,
          preview: firstMsg?.content.slice(0, 60) ?? "(empty)",
        };
      } catch {
        return null;
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function findChat(
  chatId: string,
): { spaceName: string; session: ChatSession } | null {
  for (const space of listSpaces()) {
    const session = loadChat(space, chatId);
    if (session) return { spaceName: space, session };
  }
  return null;
}

export function deleteChat(spaceName: string, id: string): void {
  const file = join(chatsDir(spaceName), `${id}.json`);
  if (existsSync(file)) unlinkSync(file);
}
