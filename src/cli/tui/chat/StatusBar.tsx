import React from "react";
import { Box, Text } from "ink";

export function StatusBar({
  space,
  model,
  provider,
}: {
  space: string;
  model: string;
  provider: "local" | "remote";
}) {
  const cols = process.stdout.columns || 80;
  const line = "─".repeat(cols);
  const info = `  ${space} · ${model} · ${provider}`;

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text dimColor>{line}</Text>
      <Text dimColor>{info}</Text>
      <Text dimColor>{"  Ctrl+C exit · @ files · Tab/↑↓ pick"}</Text>
    </Box>
  );
}
