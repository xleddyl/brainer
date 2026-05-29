import { createWriteStream, existsSync, mkdirSync, renameSync } from "node:fs";
import { join } from "node:path";

interface HfUri {
  repo: string;
  file: string;
}

export function parseHfUri(uri: string): HfUri | null {
  const match = uri.match(/^hf:([^/]+\/[^/]+)\/(.+\.gguf)$/);
  if (!match) return null;
  return { repo: match[1], file: match[2] };
}

export function ggufFilename(uri: string): string {
  const parsed = parseHfUri(uri);
  if (parsed) return parsed.file;
  return uri.split("/").pop() ?? uri;
}

function findLocal(directory: string, uri: string): string | null {
  const parsed = parseHfUri(uri);

  if (!parsed) {
    if (existsSync(uri)) return uri;
    return null;
  }

  const name = parsed.file;
  const candidate = join(directory, name);
  if (existsSync(candidate)) return candidate;

  // node-llama-cpp legacy naming: hf_{org}_{filename}
  const org = parsed.repo.split("/")[0];
  const legacy = join(directory, `hf_${org}_${name}`);
  if (existsSync(legacy)) return legacy;

  return null;
}

export interface ResolveModelOpts {
  directory: string;
  download?: boolean;
  onProgress?: (downloaded: number, total: number) => void;
}

export async function resolveModelFile(
  uri: string,
  opts: ResolveModelOpts,
): Promise<string> {
  mkdirSync(opts.directory, { recursive: true });

  const existing = findLocal(opts.directory, uri);
  if (existing) return existing;

  if (opts.download === false) {
    throw new Error(`Model file not found locally: ${uri}`);
  }

  const parsed = parseHfUri(uri);
  if (!parsed) {
    throw new Error(`Invalid model URI and file not found: ${uri}`);
  }

  const url = `https://huggingface.co/${parsed.repo}/resolve/main/${parsed.file}`;
  const destPath = join(opts.directory, parsed.file);
  const tmpPath = destPath + ".tmp";

  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) {
    throw new Error(
      `Failed to download model: ${res.status} ${res.statusText}`,
    );
  }

  if (!res.body) {
    throw new Error("No response body");
  }

  const total = Number(res.headers.get("content-length") || 0);
  let downloaded = 0;
  const fileStream = createWriteStream(tmpPath);

  const reader = res.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      fileStream.write(value);
      downloaded += value.byteLength;
      opts.onProgress?.(downloaded, total);
    }
  } finally {
    fileStream.end();
    await new Promise<void>((resolve) => fileStream.on("finish", resolve));
  }

  renameSync(tmpPath, destPath);
  return destPath;
}
