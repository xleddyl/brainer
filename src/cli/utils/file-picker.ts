import { readdirSync, statSync } from "node:fs";
import { resolve, dirname, basename, join } from "node:path";

export interface FileEntry {
  name: string;
  path: string;
  isDir: boolean;
}

export function listFiles(partial: string): FileEntry[] {
  const resolved = resolve(partial);
  let dir: string;
  let prefix: string;

  try {
    const stat = statSync(resolved);
    if (stat.isDirectory()) {
      dir = resolved;
      prefix = "";
    } else {
      dir = dirname(resolved);
      prefix = basename(resolved);
    }
  } catch {
    dir = dirname(resolved);
    prefix = basename(partial);
  }

  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    return entries
      .filter(
        (e) =>
          !e.name.startsWith(".") &&
          e.name.toLowerCase().startsWith(prefix.toLowerCase()),
      )
      .slice(0, 12)
      .map((e) => ({
        name: e.name + (e.isDirectory() ? "/" : ""),
        path: join(dir, e.name),
        isDir: e.isDirectory(),
      }))
      .sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  } catch {
    return [];
  }
}

export function getCompletedPath(partial: string, entry: FileEntry): string {
  const dir = partial.endsWith("/")
    ? partial
    : partial.substring(0, partial.lastIndexOf("/") + 1);
  return dir + entry.name;
}
