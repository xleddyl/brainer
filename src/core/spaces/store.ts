import { existsSync, unlinkSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { spaceDir, documentsDir } from "./lifecycle.js";
import { VectorStore } from "../rag/store.js";

export interface SpaceInfo {
  name: string;
  documents: { filename: string; modifiedAt: string }[];
}

export function openStore(name: string, dimensions?: number): VectorStore {
  const dir = spaceDir(name);
  if (!existsSync(dir)) throw new Error(`Space "${name}" does not exist`);
  const dbPath = join(dir, "store.db");

  try {
    return new VectorStore(dbPath, dimensions);
  } catch (e: any) {
    if (e.message?.includes("dimensions mismatch") && existsSync(dbPath)) {
      unlinkSync(dbPath);
      return new VectorStore(dbPath, dimensions);
    }
    throw e;
  }
}

export function getSpaceInfo(name: string): SpaceInfo {
  const dir = documentsDir(name);
  let docs: { filename: string; modifiedAt: string }[] = [];
  try {
    docs = readdirSync(dir)
      .filter((f) => !f.startsWith("."))
      .map((f) => {
        const st = statSync(join(dir, f));
        return { filename: f, modifiedAt: st.mtime.toISOString() };
      })
      .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
  } catch {}
  return { name, documents: docs };
}
