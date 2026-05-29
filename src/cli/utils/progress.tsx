import React from "react";
import { Text } from "ink";
import pc from "picocolors";
import { formatBytes } from "./format.js";

export interface ProgressBarProps {
  name: string;
  downloaded: number;
  total: number;
  startTime: number;
  showName?: boolean;
}

function formatEta(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "";
  const s = Math.round(seconds);
  if (s <= 0) return "0";
  if (s < 60) {
    const rounded = Math.round(s / 10) * 10;
    return rounded > 0 ? `${rounded}s` : `${s}s`;
  }
  const m = Math.floor(s / 60);
  if (m < 60) {
    return m === 1 ? "1 minute" : `${m} minutes`;
  }
  const h = Math.floor(m / 60);
  const rm = m % 60;
  const hStr = h === 1 ? "1 hour" : `${h} hours`;
  if (rm === 0) return hStr;
  const mStr = rm === 1 ? "1 minute" : `${rm} minutes`;
  return `${hStr} ${mStr}`;
}

function render(props: ProgressBarProps): string {
  const { name, downloaded, total, startTime, showName = true } = props;
  const pct = total > 0 ? downloaded / total : 0;

  const elapsed = (Date.now() - startTime) / 1000;
  const speed = elapsed > 0 ? downloaded / elapsed : 0;
  const remaining = speed > 0 ? (total - downloaded) / speed : 0;

  const pctStr = `${(pct * 100).toFixed(1)}%`;
  const sizeStr = `${formatBytes(downloaded)}/${formatBytes(total)}`;
  const etaStr = formatEta(remaining);

  const left = showName ? ` ${name} ` : "";
  const right = etaStr ? ` ${etaStr} ` : "";
  const barContent = ` ${pctStr} ${sizeStr} `;
  const barWidth = 30;
  const filled = Math.round(barWidth * pct);

  const padRight = Math.max(barWidth - barContent.length, 0);
  const barText = (barContent + " ".repeat(padRight)).slice(0, barWidth);

  const filledText = barText.slice(0, filled);
  const emptyText = barText.slice(filled);

  return (
    (left ? pc.blue(left) : "") +
    pc.bgWhite(pc.black(filledText)) +
    pc.bgBlackBright(pc.white(emptyText)) +
    pc.dim(right)
  );
}

export function ProgressBar(props: ProgressBarProps) {
  return <Text>{render(props)}</Text>;
}

export function renderProgressBar(props: ProgressBarProps): string {
  return render(props);
}
