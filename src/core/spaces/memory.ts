import { existsSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spaceDir } from "./lifecycle.js";

function memoryPath(name: string): string {
  return join(spaceDir(name), "memory.md");
}

export function loadMemory(name: string): string {
  const path = memoryPath(name);
  if (!existsSync(path)) {
    writeFileSync(path, "");
    return "";
  }
  return readFileSync(path, "utf-8").trim();
}

export function writeMemory(name: string, content: string): void {
  writeFileSync(memoryPath(name), content.trim() + "\n");
}

export function processMemoryTags(
  spaceName: string,
  response: string,
  currentMemory: string,
): { cleanResponse: string; memory: string; updated: boolean } {
  const match = response.match(/<memory>([\s\S]*?)<\/memory>/);
  if (!match)
    return {
      cleanResponse: response.trim(),
      memory: currentMemory,
      updated: false,
    };

  const newMemory = match[1].trim();
  const cleaned = response.replace(/<memory>[\s\S]*?<\/memory>/g, "").trim();

  if (newMemory && newMemory !== currentMemory) {
    writeMemory(spaceName, newMemory);
    const refreshed = loadMemory(spaceName);
    return { cleanResponse: cleaned, memory: refreshed, updated: true };
  }
  return { cleanResponse: cleaned, memory: currentMemory, updated: false };
}
