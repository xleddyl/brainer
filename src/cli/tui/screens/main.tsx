import React from "react";
import { Text, useApp, useInput } from "ink";
import { Chrome, Row } from "../primitives.js";
import { useCursor } from "../hooks.js";
import { HINTS } from "../../../constants.js";
import type { Nav } from "../types.js";

const items = [
  {
    label: "Providers",
    hint: "local / remote, models, inference, RAG",
    id: "providers" as const,
  },
  {
    label: "Models",
    hint: "search, download, manage",
    id: "models" as const,
  },
  {
    label: "Spaces",
    hint: "knowledge spaces & documents",
    id: "spaces" as const,
  },
  { label: "Config JSON", hint: "view raw config", id: "config-json" as const },
  { label: "Commands", hint: "CLI reference", id: "commands" as const },
];

export function MainScreen({
  nav,
  initialIndex,
}: {
  nav: Nav;
  initialIndex?: number;
}) {
  const { i, up, down } = useCursor(items.length + 1, initialIndex);
  const { exit } = useApp();

  useInput((input, key) => {
    if (key.upArrow) up();
    else if (key.downArrow) down();
    else if (key.return) {
      if (i < items.length) nav({ id: items[i].id });
      else exit();
    } else if (key.escape || input === "q") exit();
  });

  return (
    <Chrome title="brainer" hint={HINTS.MAIN}>
      {items.map((item, idx) => (
        <Row key={idx} selected={idx === i}>
          <Text bold={idx === i}>{item.label}</Text>
          <Text dimColor>
            {"  "}
            {item.hint}
          </Text>
        </Row>
      ))}
      <Row selected={i === items.length}>
        <Text bold={i === items.length} dimColor={i !== items.length}>
          Exit
        </Text>
      </Row>
    </Chrome>
  );
}
