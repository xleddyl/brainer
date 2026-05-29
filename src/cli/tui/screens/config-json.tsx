import React from "react";
import { Text, useInput } from "ink";
import { Chrome } from "../primitives.js";
import { HINTS } from "../../../constants.js";
import type { ScreenProps } from "../types.js";

export function ConfigJsonScreen({ config, back }: ScreenProps) {
  useInput((_input, key) => {
    if (key.escape || key.return) back();
  });

  const mask = (obj: any): any => {
    if (!obj || typeof obj !== "object") return obj;
    if (Array.isArray(obj)) return obj.map(mask);
    const out: any = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = k === "apiKey" && v ? "····" : mask(v);
    }
    return out;
  };

  return (
    <Chrome title="Config JSON" path="brainer" hint={HINTS.BACK}>
      <Text>{JSON.stringify(mask(config), null, 2)}</Text>
    </Chrome>
  );
}
