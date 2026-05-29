import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import { Chrome, Row, Spinner, ToggleField, TextField } from "../primitives.js";
import { useCursor, useTextBuffer, handleText } from "../hooks.js";
import { DEFAULT_CONFIG } from "../../../core/config/index.js";
import {
  DEFAULT_GPU_LAYERS,
  DEFAULT_CONTEXT_SIZE,
  DEFAULT_TEMPERATURE,
  DEFAULT_TOP_P,
  DEFAULT_TOP_K,
  DEFAULT_REPEAT_PENALTY,
  RAG_MAX_SOURCES,
  RAG_RELEVANCE_THRESHOLD,
  HINTS,
} from "../../../constants.js";
import {
  getProviderDef,
  getServicesForFormat,
  listRemoteModels,
  type ApiFormat,
} from "../../../providers/registry.js";
import type { ScreenProps, Nav, FormField } from "../types.js";
import { renderFormField, formHint } from "../form-render.js";

// ── Hub: pick provider + open sub-config ──

export function ProvidersScreen({
  config,
  save,
  nav,
  back,
}: ScreenProps & { nav: Nav }) {
  if (!config.rag) config.rag = {};
  const rag = config.rag;

  const providerOptions = ["local", "remote"];

  const items: FormField[] = [
    {
      key: "chat-provider",
      label: "Chat provider",
      kind: "toggle",
      value: () => config.chat.provider,
      options: providerOptions,
      apply: (v) => {
        config.chat.provider = v as "local" | "remote";
      },
    },
    {
      key: "chat-config",
      label: `Config chat (${config.chat.provider})`,
      kind: "link",
      value: () => "",
      apply: () => {},
      action: () => nav({ id: "provider-config", role: "chat" }),
    },
    {
      key: "embed-provider",
      label: "Embed provider",
      kind: "toggle",
      value: () => config.embed.provider,
      options: providerOptions,
      apply: (v) => {
        config.embed.provider = v as "local" | "remote";
      },
    },
    {
      key: "embed-config",
      label: `Config embed (${config.embed.provider})`,
      kind: "link",
      value: () => "",
      apply: () => {},
      action: () => nav({ id: "provider-config", role: "embed" }),
    },
    {
      key: "rag-sources",
      label: "Max sources",
      kind: "text",
      section: "RAG",
      value: () => String(rag.maxSources ?? RAG_MAX_SOURCES),
      apply: (v) => {
        rag.maxSources = Number(v) || RAG_MAX_SOURCES;
      },
    },
    {
      key: "rag-threshold",
      label: "Relevance threshold",
      kind: "text",
      value: () => String(rag.relevanceThreshold ?? RAG_RELEVANCE_THRESHOLD),
      apply: (v) => {
        rag.relevanceThreshold = Number(v) || RAG_RELEVANCE_THRESHOLD;
      },
    },
  ];

  const cursor = useCursor(items.length);
  const tb = useTextBuffer();
  const f = items[cursor.i];

  useInput((input, key) => {
    if (tb.active) {
      handleText(input, key, tb, (val) => {
        f.apply(val);
        save(config);
      });
      return;
    }
    if (key.escape) return back();
    if (key.upArrow) cursor.up();
    else if (key.downArrow) cursor.down();
    else if (
      f.kind === "toggle" &&
      f.options &&
      (key.leftArrow || key.rightArrow)
    ) {
      const opts = f.options;
      const idx = opts.indexOf(f.value());
      const next = key.leftArrow
        ? Math.max(0, idx - 1)
        : Math.min(opts.length - 1, idx + 1);
      f.apply(opts[next]);
      save(config);
    } else if (f.kind === "link" && key.return) {
      f.action?.();
    } else if (f.kind === "text" && key.return) {
      tb.open(f.value());
    }
  });

  return (
    <Chrome title="Providers" path="brainer" hint={formHint(f, tb.active)}>
      {items.map((item, idx) => {
        const sectionHeader = item.section ? (
          <Box key={`s-${item.key}`} marginTop={1}>
            <Text dimColor>
              {"  "}-- {item.section} --
            </Text>
          </Box>
        ) : null;

        const row = renderFormField(item, idx, cursor.i, tb);

        return sectionHeader ? (
          <React.Fragment key={item.key}>
            {sectionHeader}
            {row}
          </React.Fragment>
        ) : (
          row
        );
      })}
    </Chrome>
  );
}

// ── Sub-config screen ──

export function ProviderConfigScreen({
  config,
  save,
  back,
  role,
}: ScreenProps & { role: "chat" | "embed" }) {
  const ref = config[role];
  const isLocal = ref.provider === "local";
  const title = `${role === "chat" ? "Chat" : "Embed"} · ${ref.provider}`;

  const [remoteModels, setRemoteModels] = useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState("");
  const [onCustom, setOnCustom] = useState(false);

  const fetchModels = () => {
    if (!ref.remote?.url) {
      setModelsError("no URL");
      return;
    }
    setModelsLoading(true);
    setModelsError("");
    listRemoteModels(ref.remote)
      .then((models) => {
        setRemoteModels(models);
        setModelsLoading(false);
      })
      .catch((e: any) => {
        setModelsError(e.message);
        setModelsLoading(false);
      });
  };

  useEffect(() => {
    if (!isLocal && ref.remote?.apiKey) fetchModels();
  }, []);

  const fields: FormField[] = [];

  if (isLocal) {
    if (role === "chat") {
      if (!ref.local) ref.local = { ...DEFAULT_CONFIG.chat.local! };
      const lc = ref.local as typeof DEFAULT_CONFIG.chat.local;
      if (!lc!.inference) lc!.inference = {};
      const inf = lc!.inference!;

      const chatNames = config.models
        .filter((m) => m.type === "chat")
        .map((m) => m.name);

      fields.push(
        {
          key: "model",
          label: "Model",
          kind: "toggle",
          value: () => lc!.model,
          options: chatNames,
          apply: (v) => {
            lc!.model = v;
          },
        },
        {
          key: "gpu",
          label: "GPU layers",
          kind: "text",
          value: () => String(lc!.gpuLayers ?? DEFAULT_GPU_LAYERS),
          apply: (v) => {
            lc!.gpuLayers = Number(v) || DEFAULT_GPU_LAYERS;
          },
        },
        {
          key: "ctx",
          label: "Context size",
          kind: "text",
          value: () => String(inf.contextSize ?? DEFAULT_CONTEXT_SIZE),
          apply: (v) => {
            inf.contextSize = Number(v) || DEFAULT_CONTEXT_SIZE;
          },
        },
        {
          key: "temp",
          label: "Temperature",
          kind: "text",
          value: () => String(inf.temperature ?? DEFAULT_TEMPERATURE),
          apply: (v) => {
            inf.temperature = parseFloat(v) || DEFAULT_TEMPERATURE;
          },
        },
        {
          key: "topP",
          label: "Top P",
          kind: "text",
          value: () => String(inf.topP ?? DEFAULT_TOP_P),
          apply: (v) => {
            inf.topP = parseFloat(v) || DEFAULT_TOP_P;
          },
        },
        {
          key: "topK",
          label: "Top K",
          kind: "text",
          value: () => String(inf.topK ?? DEFAULT_TOP_K),
          apply: (v) => {
            inf.topK = Number(v) || DEFAULT_TOP_K;
          },
        },
        {
          key: "repeat",
          label: "Repeat penalty",
          kind: "text",
          value: () => String(inf.repeatPenalty ?? DEFAULT_REPEAT_PENALTY),
          apply: (v) => {
            inf.repeatPenalty = parseFloat(v) || DEFAULT_REPEAT_PENALTY;
          },
        },
        {
          key: "seed",
          label: "Seed",
          kind: "text",
          value: () => (inf.seed != null ? String(inf.seed) : "random"),
          apply: (v) => {
            const n = parseInt(v);
            inf.seed = isNaN(n) ? undefined : n;
          },
        },
      );
    } else {
      if (!ref.local) ref.local = { ...DEFAULT_CONFIG.embed.local! };
      const le = ref.local!;

      const embedNames = config.models
        .filter((m) => m.type === "embed")
        .map((m) => m.name);

      fields.push(
        {
          key: "model",
          label: "Model",
          kind: "toggle",
          value: () => le.model,
          options: embedNames,
          apply: (v) => {
            le.model = v;
          },
        },
        {
          key: "gpu",
          label: "GPU layers",
          kind: "text",
          value: () => String(le.gpuLayers ?? DEFAULT_GPU_LAYERS),
          apply: (v) => {
            le.gpuLayers = Number(v) || DEFAULT_GPU_LAYERS;
          },
        },
      );
    }
  } else {
    if (!ref.remote)
      ref.remote = {
        format: "openai",
        service: "openai",
        url: "https://api.openai.com/v1",
        apiKey: "",
        model: "",
      };
    const rem = ref.remote;

    const formats: ApiFormat[] =
      role === "embed" ? ["openai"] : ["openai", "anthropic"];

    const services = getServicesForFormat(rem.format, role === "embed");
    const serviceIds = services.map((p) => p.id);

    const hasModels = remoteModels.length > 0;
    const modelIsCustom = !hasModels || !remoteModels.includes(rem.model);

    fields.push(
      {
        key: "format",
        label: "Format",
        kind: "toggle",
        value: () => rem.format,
        options: formats,
        apply: (v) => {
          rem.format = v as ApiFormat;
          const newServices = getServicesForFormat(
            v as ApiFormat,
            role === "embed",
          );
          rem.service = newServices[0]?.id ?? "custom";
          const def = getProviderDef(rem.service);
          if (def) rem.url = def.url;
          rem.apiKey = "";
          rem.model = "";
          setRemoteModels([]);
          setModelsError("");
        },
      },
      {
        key: "service",
        label: "Service",
        kind: "toggle",
        value: () => rem.service,
        options: serviceIds,
        apply: (v) => {
          rem.service = v;
          const def = getProviderDef(v);
          if (def && v !== "custom") rem.url = def.url;
          rem.apiKey = "";
          rem.model = "";
          setRemoteModels([]);
          setModelsError("");
        },
      },
      {
        key: "url",
        label: "URL",
        kind: "text",
        readonly: rem.service !== "custom",
        value: () => rem.url,
        apply: (v) => {
          rem.url = v;
        },
      },
      {
        key: "apiKey",
        label: "API key",
        kind: "text",
        value: () => rem.apiKey,
        display: () => (rem.apiKey ? "····" + rem.apiKey.slice(-4) : ""),
        apply: (v) => {
          if (v) rem.apiKey = v;
        },
      },
      {
        key: "model",
        label: "Model",
        kind: "toggle",
        value: () => (onCustom || modelIsCustom ? "custom" : rem.model),
        displayValue:
          (onCustom || modelIsCustom) && rem.model && rem.model !== "custom"
            ? `custom: ${rem.model}`
            : undefined,
        options: hasModels ? [...remoteModels, "custom"] : ["custom"],
        apply: (v) => {
          if (v !== "custom") {
            rem.model = v;
            setOnCustom(false);
          }
        },
      },
    );
  }

  const cursor = useCursor(fields.length);
  const tb = useTextBuffer();
  const f = fields[cursor.i];

  useInput((input, key) => {
    if (modelsLoading) return;
    if (tb.active) {
      handleText(input, key, tb, (val) => {
        f.apply(val);
        save(config);
        if (f.key === "apiKey" && val) fetchModels();
      });
      return;
    }
    if (key.escape) return back();
    if (key.upArrow) cursor.up();
    else if (key.downArrow) cursor.down();
    else if (
      f.key === "model" &&
      f.kind === "toggle" &&
      f.options &&
      f.options.length > 1 &&
      (key.leftArrow || key.rightArrow)
    ) {
      const opts = f.options;
      const idx = opts.indexOf(f.value());
      const next = key.leftArrow
        ? Math.max(0, idx - 1)
        : Math.min(opts.length - 1, idx + 1);
      if (opts[next] === "custom") {
        setOnCustom(true);
      } else {
        setOnCustom(false);
        f.apply(opts[next]);
        save(config);
      }
    } else if (
      f.key === "model" &&
      f.kind === "toggle" &&
      f.value() === "custom" &&
      key.return
    ) {
      const current = ref.remote!.model;
      setOnCustom(false);
      tb.open(current === "custom" ? "" : current);
    } else if (
      f.kind === "toggle" &&
      f.options &&
      f.options.length > 1 &&
      (key.leftArrow || key.rightArrow)
    ) {
      const opts = f.options;
      const idx = opts.indexOf(f.value());
      const next = key.leftArrow
        ? Math.max(0, idx - 1)
        : Math.min(opts.length - 1, idx + 1);
      f.apply(opts[next]);
      save(config);
    } else if (f.kind === "link" && key.return) {
      f.action?.();
    } else if (f.kind === "text" && key.return && !f.readonly) {
      tb.open(f.display ? "" : f.value());
    }
  });

  return (
    <Chrome
      title={title}
      path="brainer › providers"
      hint={
        tb.active
          ? HINTS.EDIT
          : f?.kind === "text" ||
              (f?.key === "model" && f?.value() === "custom")
            ? HINTS.NAV_TOGGLE_EDIT
            : HINTS.NAV_TOGGLE
      }
    >
      {modelsLoading && (
        <Box marginBottom={1}>
          <Spinner text="loading models..." />
        </Box>
      )}
      {fields.map((field, idx) => renderFormField(field, idx, cursor.i, tb))}
    </Chrome>
  );
}
