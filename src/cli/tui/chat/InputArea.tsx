import React from "react";
import { Box, Text } from "ink";
import type { FileEntry } from "../../utils/file-picker.js";

export function InputArea({
  buf,
  cursor,
  active,
  pickerOpen,
  pickerItems,
  pickerIdx,
}: {
  buf: string;
  cursor: number;
  active: boolean;
  pickerOpen: boolean;
  pickerItems: FileEntry[];
  pickerIdx: number;
}) {
  const lines = buf.split("\n");
  const before = buf.slice(0, cursor);
  const beforeLines = before.split("\n");
  const cursorLine = beforeLines.length - 1;
  const cursorCol = beforeLines[cursorLine].length;

  return (
    <Box flexDirection="column">
      {lines.map((line, i) => {
        const prefix = i === 0 ? "> " : "  ";
        const prefixColor = i === 0 ? "blue" : "gray";

        if (active && i === cursorLine) {
          const bef = line.slice(0, cursorCol);
          const ch = line[cursorCol] ?? " ";
          const aft = line.slice(cursorCol + 1);
          return (
            <Box key={i}>
              <Text color={prefixColor}>{prefix}</Text>
              <Text>
                {bef}
                <Text inverse>{ch}</Text>
                {aft}
              </Text>
            </Box>
          );
        }

        return (
          <Box key={i}>
            <Text color={prefixColor}>{prefix}</Text>
            <Text>{line}</Text>
          </Box>
        );
      })}
      {pickerOpen &&
        pickerItems.map((item, i) => (
          <Box key={item.path}>
            <Text color={i === pickerIdx ? "cyan" : "gray"}>
              {i === pickerIdx ? "  › " : "    "}
              {item.isDir ? "\u{1F4C1}" : "\u{1F4C4}"} {item.name}
            </Text>
          </Box>
        ))}
    </Box>
  );
}
