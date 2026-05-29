import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import { SPINNER_FRAMES, SPINNER_INTERVAL_MS } from "../../constants.js";

export function Chrome({
  title,
  path,
  hint,
  children,
}: {
  title: string;
  path?: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        {path && <Text dimColor>{path} › </Text>}
        <Text bold color="cyan">
          {title}
        </Text>
      </Box>
      {children}
      <Box marginTop={1}>
        <Text dimColor>{hint}</Text>
      </Box>
    </Box>
  );
}

export function Row({
  selected,
  children,
}: {
  selected: boolean;
  children: React.ReactNode;
}) {
  return (
    <Box>
      <Text color={selected ? "cyan" : "gray"}>{selected ? "› " : "  "}</Text>
      {children}
    </Box>
  );
}

export function Spinner({ text }: { text: string }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(
      () => setI((n) => (n + 1) % SPINNER_FRAMES.length),
      SPINNER_INTERVAL_MS,
    );
    return () => clearInterval(t);
  }, []);
  return (
    <Text>
      <Text color="cyan">{SPINNER_FRAMES[i]}</Text> {text}
    </Text>
  );
}

export function ToggleField({
  label,
  options,
  value,
  selected,
  displayValue,
}: {
  label: string;
  options: string[];
  value: string;
  selected: boolean;
  displayValue?: string;
}) {
  const idx = options.indexOf(value);
  const showInline = options.length <= 4;
  const shown = displayValue ?? value;

  return (
    <Row selected={selected}>
      <Text bold={selected}>{label} </Text>
      {selected ? (
        <>
          {options.length <= 1 ? (
            <>
              <Text color="cyan">{` ‹ ${shown} › `}</Text>
              <Text dimColor> no alternatives</Text>
            </>
          ) : showInline ? (
            options.map((o) => (
              <Text key={o} color={o === value ? "cyan" : "gray"}>
                {o === value ? ` ‹ ${o === value ? shown : o} › ` : ` ${o} `}
              </Text>
            ))
          ) : (
            <>
              <Text color="cyan">{` ‹ ${shown} › `}</Text>
              <Text dimColor>
                {" "}
                {idx + 1}/{options.length}
              </Text>
            </>
          )}
        </>
      ) : (
        <Text dimColor>{shown}</Text>
      )}
    </Row>
  );
}

export function useConfirm() {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState<0 | 1>(0);
  return {
    active,
    step,
    start: () => {
      setActive(true);
      setStep(0);
    },
    advance: () => setStep(1),
    cancel: () => {
      setActive(false);
      setStep(0);
    },
    reset: () => {
      setActive(false);
      setStep(0);
    },
  };
}

export function TextField({
  label,
  value,
  selected,
  editing,
  buffer,
}: {
  label: string;
  value: string;
  selected: boolean;
  editing: boolean;
  buffer: string;
}) {
  return (
    <Row selected={selected}>
      <Text bold={selected}>{label} </Text>
      {editing ? (
        <Text color="yellow">
          {buffer}
          <Text dimColor>_</Text>
        </Text>
      ) : (
        <Text dimColor={!selected}>{value || "—"}</Text>
      )}
    </Row>
  );
}
