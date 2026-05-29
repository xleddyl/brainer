import React from "react";
import { Text } from "ink";
import { Row, ToggleField, TextField } from "./primitives.js";
import { HINTS } from "../../constants.js";
import type { FormField } from "./types.js";
import type { useTextBuffer } from "./hooks.js";

export function renderFormField(
  field: FormField,
  idx: number,
  cursorIdx: number,
  tb: ReturnType<typeof useTextBuffer>,
): React.ReactNode {
  if (field.kind === "toggle" && idx === cursorIdx && tb.active) {
    return (
      <TextField
        key={field.key}
        label={field.label}
        value=""
        selected
        editing
        buffer={tb.buf}
      />
    );
  }
  if (field.kind === "toggle") {
    return (
      <ToggleField
        key={field.key}
        label={field.label}
        options={field.options ?? []}
        value={field.value()}
        selected={idx === cursorIdx}
        displayValue={field.displayValue}
      />
    );
  }
  if (field.kind === "link") {
    return (
      <Row key={field.key} selected={idx === cursorIdx}>
        <Text bold={idx === cursorIdx}>{field.label}</Text>
        <Text dimColor>{"  "}→</Text>
      </Row>
    );
  }
  return (
    <TextField
      key={field.key}
      label={field.label}
      value={(field.display ?? field.value)()}
      selected={idx === cursorIdx}
      editing={idx === cursorIdx && tb.active}
      buffer={tb.buf}
    />
  );
}

export function formHint(
  field: FormField | undefined,
  editing: boolean,
): string {
  if (editing) return HINTS.EDIT;
  if (field?.kind === "text") return HINTS.NAV_TOGGLE_EDIT;
  return HINTS.NAV_TOGGLE;
}
