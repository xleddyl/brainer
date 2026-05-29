interface Disposable {
  stop?(): Promise<void>;
  close?(): void;
}

function disposeResources(resources: Disposable[]): Promise<void>[] {
  for (const r of resources) {
    try {
      if (r.close) r.close();
    } catch {}
  }
  return resources
    .map((r) => {
      try {
        return r.stop?.();
      } catch {
        return undefined;
      }
    })
    .filter((p): p is Promise<void> => p !== undefined);
}

export async function withCleanup<T>(
  resources: Disposable[],
  fn: () => Promise<T>,
): Promise<T> {
  let cleaned = false;

  const cleanup = async () => {
    if (cleaned) return;
    cleaned = true;
    await Promise.allSettled(disposeResources(resources));
  };

  const onSignal = () => {
    const stops = disposeResources(resources);
    if (stops.length > 0) {
      Promise.allSettled(stops).finally(() => process.exit(0));
      setTimeout(() => process.exit(0), 500);
    } else {
      process.exit(0);
    }
  };

  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);

  try {
    return await fn();
  } finally {
    process.removeListener("SIGINT", onSignal);
    process.removeListener("SIGTERM", onSignal);
    await cleanup();
  }
}
