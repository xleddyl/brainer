import type { BrainerConfig } from "../../core/config/index.js";

export type SaveFn = (config: BrainerConfig) => void;
export type Nav = (s: Screen) => void;

export type Screen =
  | { id: "main" }
  | { id: "providers" }
  | { id: "provider-config"; role: "chat" | "embed" }
  | { id: "models" }
  | { id: "model-add" }
  | { id: "model-search" }
  | { id: "model-files"; repoId: string }
  | { id: "spaces" }
  | { id: "space-add" }
  | { id: "space-detail"; name: string }
  | { id: "config-json" }
  | { id: "commands" };

export interface ScreenProps {
  config: BrainerConfig;
  save: SaveFn;
  nav: Nav;
  back: () => void;
}

export type MenuAction =
  | { type: "open-chat"; space: string; chatId: string }
  | { type: "new-chat"; space: string };

export type FormField = {
  key: string;
  label: string;
  kind: "toggle" | "text" | "link";
  readonly?: boolean;
  section?: string;
  value: () => string;
  display?: () => string;
  displayValue?: string;
  options?: string[];
  apply: (v: string) => void;
  action?: () => void;
};
