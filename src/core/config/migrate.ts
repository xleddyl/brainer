export function migrateConfig(raw: any): any {
  // v0.1 → v0.2: flat local/remote → per-role config
  if (raw.local && !raw.chat?.local) {
    const l = raw.local;
    raw.chat = {
      provider: raw.chat?.provider ?? "local",
      local: {
        model: l.chatModel ?? "qwen3-8b",
        gpuLayers: l.gpuLayers,
        inference: l.chat ?? {
          contextSize: l.contextSize,
        },
      },
      remote: raw.chat?.remote,
    };
    raw.embed = {
      provider: raw.embed?.provider ?? "local",
      local: {
        model: l.embedModel ?? "nomic-embed",
        gpuLayers: l.gpuLayers,
      },
      remote: raw.embed?.remote,
    };
    delete raw.local;
  }

  // v0.2: add service + format fields to remote configs
  for (const role of ["chat", "embed"] as const) {
    const rem = raw[role]?.remote;
    if (!rem) continue;
    if (!rem.format) rem.format = "openai";
    if (!rem.service) rem.service = "custom";
    if (rem.service === "selfhosted") rem.service = "custom";
  }

  // v0.1 → v0.2: old top-level remote → per-role remote
  if (raw.remote && !raw.chat?.remote && !raw.embed?.remote) {
    const r = raw.remote;
    const service = r.service ?? "custom";
    if (raw.chat) {
      raw.chat.remote = {
        service,
        url: r.url,
        apiKey: r.apiKey,
        model: r.model ?? "",
      };
    }
    if (raw.embed) {
      raw.embed.remote = {
        service,
        url: r.url,
        apiKey: r.apiKey,
        model: r.embedModel ?? r.model ?? "",
      };
    }
    delete raw.remote;
  }

  // clean up stale top-level fields from old format
  delete raw.local;
  delete raw.remote;

  return raw;
}
