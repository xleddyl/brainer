import { existsSync, mkdirSync, rmSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { SPACES_DIR } from "../../paths.js";
import type { BrainerConfig } from "../config/index.js";
import { saveConfig } from "../config/index.js";

export function spaceDir(name: string): string {
  return join(SPACES_DIR, name);
}

export function createSpace(name: string): void {
  const dir = spaceDir(name);
  if (existsSync(dir)) throw new Error(`Space "${name}" already exists`);
  mkdirSync(join(dir, "documents"), { recursive: true });
  mkdirSync(join(dir, "chats"), { recursive: true });
}

export function deleteSpace(name: string): void {
  const dir = spaceDir(name);
  if (!existsSync(dir)) throw new Error(`Space "${name}" does not exist`);
  rmSync(dir, { recursive: true });
}

export function listSpaces(): string[] {
  if (!existsSync(SPACES_DIR)) return [];
  return readdirSync(SPACES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

export function spaceExists(name: string): boolean {
  return existsSync(spaceDir(name));
}

export function documentsDir(name: string): string {
  return join(spaceDir(name), "documents");
}

export function resolveSpace(config: BrainerConfig, explicit?: string): string {
  const space = explicit ?? config.lastSpace;

  if (!space) {
    const spaces = listSpaces();
    if (spaces.length === 0) {
      throw new Error(
        "No spaces found. Create one first:\n  brainer space create <name>",
      );
    }
    throw new Error(
      `No space specified. Use -s <name>\nAvailable: ${spaces.join(", ")}`,
    );
  }

  if (!spaceExists(space)) {
    const spaces = listSpaces();
    const hint =
      spaces.length > 0
        ? `Available spaces: ${spaces.join(", ")}`
        : "Create one first:\n  brainer space create <name>";
    throw new Error(`Space "${space}" not found. ${hint}`);
  }

  if (config.lastSpace !== space) {
    config.lastSpace = space;
    saveConfig(config);
  }

  return space;
}
