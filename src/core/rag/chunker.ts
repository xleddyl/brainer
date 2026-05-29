import {
  CHUNK_MAX_TOKENS,
  CHUNK_OVERLAP_TOKENS,
  APPROX_CHARS_PER_TOKEN,
} from "../../constants.js";

export interface ChunkOptions {
  maxTokens?: number;
  overlap?: number;
}

export function chunkText(text: string, options: ChunkOptions = {}): string[] {
  const maxChars =
    (options.maxTokens ?? CHUNK_MAX_TOKENS) * APPROX_CHARS_PER_TOKEN;
  const overlapChars =
    (options.overlap ?? CHUNK_OVERLAP_TOKENS) * APPROX_CHARS_PER_TOKEN;

  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);

  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();

    if (current.length + trimmed.length + 1 <= maxChars) {
      current += (current ? "\n\n" : "") + trimmed;
    } else {
      if (current) chunks.push(current);

      if (trimmed.length <= maxChars) {
        current = trimmed;
      } else {
        for (const subChunk of splitLong(trimmed, maxChars, overlapChars)) {
          chunks.push(subChunk);
        }
        current = "";
      }
    }
  }

  if (current) chunks.push(current);

  if (chunks.length > 1 && overlapChars > 0) {
    return addOverlap(chunks, overlapChars);
  }

  return chunks;
}

function splitLong(
  text: string,
  maxChars: number,
  overlapChars: number,
): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+\s*/g) || [text];
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if (current.length + sentence.length <= maxChars) {
      current += sentence;
    } else {
      if (current) chunks.push(current.trim());
      current = sentence;
    }
  }
  if (current) chunks.push(current.trim());

  if (chunks.length > 1 && overlapChars > 0) {
    return addOverlap(chunks, overlapChars);
  }
  return chunks;
}

function addOverlap(chunks: string[], overlapChars: number): string[] {
  return chunks.map((chunk, i) => {
    if (i === 0) return chunk;
    const prev = chunks[i - 1];
    const overlap = prev.slice(-overlapChars);
    return overlap + "\n\n" + chunk;
  });
}
