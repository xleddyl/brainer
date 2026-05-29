import { useState, useEffect, useCallback } from "react";

export function useCursor(count: number, initial = 0) {
  const [i, setI] = useState(initial);
  useEffect(() => {
    if (i >= count && count > 0) setI(count - 1);
  }, [count]);
  const up = useCallback(() => setI((c) => Math.max(0, c - 1)), []);
  const down = useCallback(
    () => setI((c) => Math.min(count - 1, c + 1)),
    [count],
  );
  return { i, up, down, set: setI };
}

export function useTextBuffer(initial = "") {
  const [buf, setBuf] = useState(initial);
  const [active, setActive] = useState(false);
  return {
    buf,
    active,
    open: (val: string) => {
      setBuf(val);
      setActive(true);
    },
    close: () => setActive(false),
    type: (ch: string) => setBuf((b) => b + ch),
    del: () => setBuf((b) => b.slice(0, -1)),
    reset: () => {
      setBuf("");
      setActive(false);
    },
  };
}

export function handleText(
  input: string,
  key: {
    return: boolean;
    escape: boolean;
    backspace: boolean;
    delete: boolean;
    ctrl: boolean;
    meta: boolean;
  },
  tb: ReturnType<typeof useTextBuffer>,
  onSubmit: (val: string) => void,
) {
  if (key.escape) {
    tb.close();
    return true;
  }
  if (key.return) {
    onSubmit(tb.buf);
    tb.close();
    return true;
  }
  if (key.backspace || key.delete) {
    tb.del();
    return true;
  }
  if (input && !key.ctrl && !key.meta) {
    tb.type(input);
    return true;
  }
  return false;
}
