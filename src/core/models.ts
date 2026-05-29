import { existsSync, unlinkSync, readdirSync } from "node:fs";
import { resolveModelFile, ggufFilename, parseHfUri } from "../native/hub.js";
import { MODELS_DIR } from "../paths.js";
import type { BrainerConfig, ModelEntry } from "./config/index.js";

export interface ModelInfo extends ModelEntry {
  downloaded: boolean;
  active: boolean;
}

export function listModels(config: BrainerConfig): ModelInfo[] {
  return config.models.map((m) => ({
    ...m,
    downloaded: isDownloaded(m.uri),
    active:
      config.chat.local?.model === m.name ||
      config.embed.local?.model === m.name,
  }));
}

export function addModel(config: BrainerConfig, entry: ModelEntry): void {
  const idx = config.models.findIndex((m) => m.name === entry.name);
  if (idx >= 0) config.models[idx] = entry;
  else config.models.push(entry);
}

export async function removeModel(
  config: BrainerConfig,
  name: string,
): Promise<{ deleted: boolean; filename?: string }> {
  const idx = config.models.findIndex((m) => m.name === name);
  if (idx < 0) return { deleted: false };

  const entry = config.models[idx];
  let fileDeleted: string | undefined;

  try {
    const filePath = await resolveModelFile(entry.uri, {
      directory: MODELS_DIR,
      download: false,
    });
    unlinkSync(filePath);
    fileDeleted = filePath.split("/").pop();
  } catch {}

  config.models.splice(idx, 1);
  return { deleted: true, filename: fileDeleted };
}

export function useModel(
  config: BrainerConfig,
  name: string,
): { ok: boolean; role?: "chat" | "embed" } {
  const entry = config.models.find((m) => m.name === name);
  if (!entry) return { ok: false };

  if (entry.type === "chat") {
    if (!config.chat.local) config.chat.local = { model: name };
    else config.chat.local.model = name;
  } else {
    if (!config.embed.local) config.embed.local = { model: name };
    else config.embed.local.model = name;
  }

  return { ok: true, role: entry.type };
}

export async function pullModel(
  config: BrainerConfig,
  name: string,
  onProgress?: (downloaded: number, total: number) => void,
): Promise<{ ok: boolean; path?: string; error?: string }> {
  const entry = config.models.find((m) => m.name === name);
  const uri = entry ? entry.uri : name;
  try {
    const path = await resolveModelFile(uri, {
      directory: MODELS_DIR,
      onProgress,
    });
    return { ok: true, path };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

export async function pullAllModels(
  config: BrainerConfig,
  onStatus?: (name: string, status: "start" | "done" | "fail") => void,
  onProgress?: (name: string, downloaded: number, total: number) => void,
): Promise<{ results: { name: string; ok: boolean; path?: string }[] }> {
  const results: { name: string; ok: boolean; path?: string }[] = [];
  for (const m of config.models) {
    onStatus?.(m.name, "start");
    try {
      const path = await resolveModelFile(m.uri, {
        directory: MODELS_DIR,
        onProgress: onProgress
          ? (downloaded, total) => onProgress(m.name, downloaded, total)
          : undefined,
      });
      results.push({ name: m.name, ok: true, path });
      onStatus?.(m.name, "done");
    } catch {
      results.push({ name: m.name, ok: false });
      onStatus?.(m.name, "fail");
    }
  }
  return { results };
}

export function isDownloaded(uri: string): boolean {
  if (!existsSync(MODELS_DIR)) return false;
  const name = ggufFilename(uri);
  if (!name) return false;
  try {
    const parsed = parseHfUri(uri);
    const org = parsed ? parsed.repo.split("/")[0] : undefined;
    return readdirSync(MODELS_DIR).some(
      (f) => f === name || (org && f === `hf_${org}_${name}`),
    );
  } catch {
    return false;
  }
}
