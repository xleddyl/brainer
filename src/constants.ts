// ── RAG ──
export const RAG_MAX_SOURCES = 5;
// L2 distance on normalized embeddings: 0 = identical, 2 = opposite
export const RAG_RELEVANCE_THRESHOLD = 1.2;

// ── Chunking ──
export const CHUNK_MAX_TOKENS = 512;
export const CHUNK_OVERLAP_TOKENS = 64;
export const APPROX_CHARS_PER_TOKEN = 4;

// ── LLM defaults ──
export const DEFAULT_GPU_LAYERS = 99;
export const DEFAULT_CONTEXT_SIZE = 8192;
export const DEFAULT_TEMPERATURE = 0.7;
export const DEFAULT_TOP_P = 0.9;
export const DEFAULT_TOP_K = 40;
export const DEFAULT_REPEAT_PENALTY = 1.1;
export const COMPLETE_CONTEXT_SIZE = 2048;

// ── UI ──
export const SPINNER_FRAMES = [
  "⠋",
  "⠙",
  "⠹",
  "⠸",
  "⠼",
  "⠴",
  "⠦",
  "⠧",
  "⠇",
  "⠏",
];
export const SPINNER_INTERVAL_MS = 80;

// ── TUI hints ──
export const HINTS = {
  NAV: "↑↓ move · enter select · esc back",
  NAV_TOGGLE: "↑↓ move · ←→ toggle · esc back",
  NAV_TOGGLE_EDIT: "↑↓ move · ←→ toggle · enter edit · esc back",
  NAV_DELETE: "↑↓ move · enter select · d remove · esc back",
  NAV_OPEN: "↑↓ move · enter open · esc back",
  NAV_OPEN_DELETE: "↑↓ move · enter open · d delete · esc back",
  EDIT: "type value · enter save · esc cancel",
  TEXT_NEXT: "type · enter next · esc cancel",
  TEXT_SUBMIT: "type · enter confirm · esc cancel",
  TOGGLE_SAVE: "←→ toggle · enter save · esc back",
  SCROLL: "↑↓ scroll · esc back",
  DONE: "enter · esc back",
  BACK: "esc back",
  MAIN: "↑↓ move · enter open · q quit",
  SEARCH_INPUT: "type query · enter search · tab format · esc back",
  SEARCH_RESULTS: "↑↓ navigate · enter select · esc search",
  DOWNLOADING: "downloading...",
} as const;
