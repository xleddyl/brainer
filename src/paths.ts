import { join } from "node:path";
import { homedir } from "node:os";

export const BRAINER_DIR = join(homedir(), ".brainer");
export const CONFIG_PATH = join(BRAINER_DIR, "config.json");
export const MODELS_DIR = join(BRAINER_DIR, "models");
export const SPACES_DIR = join(BRAINER_DIR, "spaces");
