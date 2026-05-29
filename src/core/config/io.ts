import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { type } from "arktype";
import { BRAINER_DIR, CONFIG_PATH } from "../../paths.js";
import type { BrainerConfig } from "./schema.js";
import {
  DEFAULT_CONFIG,
  BUILTIN_MODELS,
  BrainerConfigSchema,
} from "./schema.js";
import { migrateConfig } from "./migrate.js";

export function loadConfig(): BrainerConfig {
  if (existsSync(CONFIG_PATH)) {
    const raw = readFileSync(CONFIG_PATH, "utf-8");
    const migrated = migrateConfig(JSON.parse(raw));
    const merged = { ...DEFAULT_CONFIG, ...migrated };
    if (migrated.chat)
      merged.chat = { ...DEFAULT_CONFIG.chat, ...migrated.chat };
    if (migrated.embed)
      merged.embed = { ...DEFAULT_CONFIG.embed, ...migrated.embed };

    const savedNames = new Set((migrated.models ?? []).map((m: any) => m.name));
    const missingBuiltins = BUILTIN_MODELS.filter(
      (b) => !savedNames.has(b.name),
    );
    merged.models = [...(migrated.models ?? []), ...missingBuiltins];
    const result = BrainerConfigSchema(merged);
    if (result instanceof type.errors) {
      throw new Error(`Invalid config at ${CONFIG_PATH}:\n${result.summary}`);
    }
    saveConfig(result);
    return result;
  }
  return DEFAULT_CONFIG;
}

export function saveConfig(config: BrainerConfig): void {
  if (!existsSync(BRAINER_DIR)) mkdirSync(BRAINER_DIR, { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n");
}
