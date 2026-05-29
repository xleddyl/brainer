import pc from "picocolors";

// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1b\[[0-9;]*m/g;

export function visibleLength(s: string): number {
  return s.replace(ANSI_RE, "").length;
}

export function wrapLine(line: string, maxWidth: number): string[] {
  if (visibleLength(line) <= maxWidth) return [line];

  // tokenize into words and ANSI codes, preserving spaces
  const tokens: { text: string; vis: number; isCode: boolean }[] = [];
  let plain = "";
  let last = 0;
  for (const m of line.matchAll(new RegExp(ANSI_RE.source, "g"))) {
    if (m.index! > last) {
      plain = line.slice(last, m.index!);
      for (const word of plain.split(/( +)/)) {
        if (word) tokens.push({ text: word, vis: word.length, isCode: false });
      }
    }
    tokens.push({ text: m[0], vis: 0, isCode: true });
    last = m.index! + m[0].length;
  }
  if (last < line.length) {
    for (const word of line.slice(last).split(/( +)/)) {
      if (word) tokens.push({ text: word, vis: word.length, isCode: false });
    }
  }

  const rows: string[] = [];
  let current = "";
  let currentVis = 0;

  for (const tok of tokens) {
    if (tok.isCode) {
      current += tok.text;
      continue;
    }
    if (
      currentVis > 0 &&
      currentVis + tok.vis > maxWidth &&
      tok.text.trim().length > 0
    ) {
      rows.push(current);
      current = "";
      currentVis = 0;
    }
    current += tok.text;
    currentVis += tok.vis;
  }
  if (current) rows.push(current);
  return rows;
}

export function addBorder(text: string): string {
  const prefix = `${pc.magenta("│")} `;
  const termWidth = process.stdout.columns || 80;
  const maxContent = termWidth - 3;

  return text
    .split("\n")
    .flatMap((line) =>
      visibleLength(line) <= maxContent
        ? [prefix + line]
        : wrapLine(line, maxContent).map((row) => prefix + row),
    )
    .join("\n");
}
