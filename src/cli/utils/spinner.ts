import pc from "picocolors";
import { SPINNER_FRAMES, SPINNER_INTERVAL_MS } from "../../constants.js";

export function startSpinner(label: string): () => void {
  let i = 0;
  const timer = setInterval(() => {
    process.stdout.write(
      `\r${pc.cyan(SPINNER_FRAMES[i % SPINNER_FRAMES.length])} ${pc.dim(label)}`,
    );
    i++;
  }, SPINNER_INTERVAL_MS);
  return () => {
    clearInterval(timer);
    process.stdout.write("\r\x1b[K");
  };
}
