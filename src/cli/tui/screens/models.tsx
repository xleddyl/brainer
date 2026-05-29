import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import {
  Chrome,
  Row,
  Spinner,
  ToggleField,
  TextField,
  useConfirm,
} from "../primitives.js";
import { useCursor, useTextBuffer } from "../hooks.js";
import { HINTS } from "../../../constants.js";
import { ProgressBar } from "../../utils/progress.js";
import {
  listModels,
  addModel,
  removeModel,
  useModel,
  pullModel,
} from "../../../core/models.js";
import {
  searchModels,
  listModelFiles,
  type HubModel,
  type HubFile,
} from "../../../core/hub.js";
import {
  formatSize,
  formatDownloads,
  suggestAlias,
} from "../../utils/format.js";
import type { ScreenProps, Nav } from "../types.js";
import type { ModelEntry } from "../../../core/config/index.js";

// ── Models list ──

interface DownloadState {
  status: "pull" | "done" | "fail";
  downloaded: number;
  total: number;
  startTime: number;
}

export function ModelsScreen({
  config,
  save,
  nav,
  back,
}: ScreenProps & { nav: Nav }) {
  const models = listModels(config);
  const actions = [
    { label: "Search Hugging Face", marker: "?" },
    { label: "Add model", marker: "+" },
    { label: "Pull all", marker: "↓" },
  ];
  const total = models.length + actions.length;
  const { i, up, down } = useCursor(total);
  const cf = useConfirm();
  const [downloads, setDownloads] = useState<Record<string, DownloadState>>({});
  const [confirmBack, setConfirmBack] = useState(false);

  const hasActiveDownloads = Object.values(downloads).some(
    (d) => d.status === "pull",
  );

  function startPull(name: string) {
    if (downloads[name]?.status === "pull") return;
    const start = Date.now();
    setDownloads((d) => ({
      ...d,
      [name]: { status: "pull", downloaded: 0, total: 0, startTime: start },
    }));
    pullModel(config, name, (downloaded, total) => {
      setDownloads((d) => ({
        ...d,
        [name]: { ...d[name], downloaded, total },
      }));
    }).then((result) => {
      setDownloads((d) => ({
        ...d,
        [name]: { ...d[name], status: result.ok ? "done" : "fail" },
      }));
    });
  }

  function startPullAll() {
    for (const m of models) {
      if (!m.downloaded) startPull(m.name);
    }
  }

  useInput((input, key) => {
    if (confirmBack) {
      if (input === "y") back();
      else if (input === "n" || key.escape) setConfirmBack(false);
      return;
    }

    if (cf.active) {
      if (input === "y") {
        if (cf.step === 0) {
          cf.advance();
        } else {
          removeModel(config, models[i].name).then(() => {
            save(config);
            cf.reset();
          });
        }
      } else if (input === "n" || key.escape) {
        cf.cancel();
      }
      return;
    }

    if (key.escape) {
      if (hasActiveDownloads) setConfirmBack(true);
      else back();
      return;
    }
    if (key.upArrow) up();
    else if (key.downArrow) down();
    else if (key.return) {
      if (i < models.length) {
        useModel(config, models[i].name);
        save(config);
      } else if (i === models.length) nav({ id: "model-search" });
      else if (i === models.length + 1) nav({ id: "model-add" });
      else if (i === models.length + 2) startPullAll();
    } else if (input === "p" && i < models.length) {
      startPull(models[i].name);
    } else if (input === "d" && i < models.length) {
      cf.start();
    }
  });

  const hint = confirmBack
    ? "Downloads in progress. Cancel and go back? y/n"
    : cf.active
      ? cf.step === 0
        ? `Remove "${models[i]?.name}"? y/n`
        : `Are you sure? The model file will be deleted. y/n`
      : "↑↓ move · enter use · p pull · d remove · esc back";

  return (
    <Chrome title="Models" path="brainer" hint={hint}>
      {models.length === 0 && <Text dimColor>{"  "}No models registered</Text>}
      {models.map((m, idx) => {
        const dl = downloads[m.name];
        return (
          <Box key={m.name} flexDirection="column">
            <Row selected={idx === i}>
              <Text
                color={
                  dl?.status === "done"
                    ? "green"
                    : dl?.status === "fail"
                      ? "red"
                      : m.downloaded
                        ? "green"
                        : "red"
                }
              >
                {dl?.status === "done" || m.downloaded
                  ? "✓"
                  : dl?.status === "fail"
                    ? "✗"
                    : dl?.status === "pull"
                      ? "⟳"
                      : "✗"}{" "}
              </Text>
              <Text bold={idx === i}>{m.name}</Text>
              <Text dimColor>
                {"  "}
                {m.type}
                {m.active ? " · active" : ""}
              </Text>
            </Row>
            {dl?.status === "pull" && dl.total > 0 ? (
              <Text>
                {"    "}
                <ProgressBar name={m.name} {...dl} showName={false} />
              </Text>
            ) : (
              <Text dimColor>
                {"    "}
                {m.uri}
              </Text>
            )}
          </Box>
        );
      })}
      {models.length > 0 && <Text> </Text>}
      {actions.map((a, idx) => (
        <Row key={a.label} selected={models.length + idx === i}>
          <Text>{a.marker} </Text>
          <Text bold={models.length + idx === i}>{a.label}</Text>
        </Row>
      ))}
    </Chrome>
  );
}

// ── Search Hugging Face ──

export function ModelSearchScreen({ config, save, nav, back }: ScreenProps) {
  const tb = useTextBuffer();
  const [results, setResults] = useState<HubModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"input" | "results">("input");
  const [cursor, setCursor] = useState(0);
  const [ggufOnly, setGgufOnly] = useState(true);

  useEffect(() => {
    tb.open("");
  }, []);

  const doSearch = () => {
    const q = tb.buf.trim();
    if (!q) return;
    setLoading(true);
    setError("");
    searchModels(q, ggufOnly)
      .then((models) => {
        setResults(models);
        setCursor(0);
        if (models.length > 0) setMode("results");
        else setError("No results");
      })
      .catch((e: any) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useInput((input, key) => {
    if (loading) return;

    if (mode === "input") {
      if (key.escape) return back();
      if (key.return) {
        doSearch();
        return;
      }
      if (key.downArrow && results.length > 0) {
        setMode("results");
        return;
      }
      if (key.tab) {
        setGgufOnly((v) => !v);
        return;
      }
      if (key.backspace || key.delete) {
        tb.del();
        return;
      }
      if (input && !key.ctrl && !key.meta) {
        tb.type(input);
        return;
      }
    }

    if (mode === "results") {
      if (key.escape) {
        setMode("input");
        return;
      }
      if (key.upArrow) {
        if (cursor === 0) {
          setMode("input");
        } else {
          setCursor((c) => c - 1);
        }
        return;
      }
      if (key.downArrow) {
        setCursor((c) => Math.min(results.length - 1, c + 1));
        return;
      }
      if (key.return && results[cursor]) {
        nav({ id: "model-files", repoId: results[cursor].id });
        return;
      }
    }
  });

  const hint = mode === "input" ? HINTS.SEARCH_INPUT : HINTS.SEARCH_RESULTS;

  return (
    <Chrome title="Search Models" path="brainer › models" hint={hint}>
      <TextField
        label="Query"
        value=""
        selected={mode === "input"}
        editing={mode === "input"}
        buffer={tb.buf}
      />
      <Row selected={false}>
        <Text>Format </Text>
        <Text color="cyan">{ggufOnly ? " ‹ GGUF › " : " ‹ All › "}</Text>
        <Text dimColor> tab to toggle</Text>
      </Row>

      {loading && (
        <Box marginTop={1}>
          <Spinner text="searching..." />
        </Box>
      )}
      {error && !loading && (
        <Box marginTop={1}>
          <Text color="red">
            {"  "}
            {error}
          </Text>
        </Box>
      )}
      {results.length > 0 && !loading && (
        <Box marginTop={1} flexDirection="column">
          {results.map((r, idx) => (
            <Row key={r.id} selected={mode === "results" && idx === cursor}>
              <Text bold={mode === "results" && idx === cursor}>{r.id}</Text>
              <Text dimColor>
                {"  "}↓ {formatDownloads(r.downloads)}
              </Text>
            </Row>
          ))}
        </Box>
      )}
    </Chrome>
  );
}

// ── Pick file from repo ──

export function ModelFilesScreen({
  config,
  save,
  back,
  repoId,
}: ScreenProps & { repoId: string }) {
  const [files, setFiles] = useState<HubFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [step, setStep] = useState<"list" | "alias" | "type">("list");
  const { i, up, down } = useCursor(files.length);
  const tb = useTextBuffer();
  const [typeIdx, setTypeIdx] = useState(0);
  const typeOptions = ["chat", "embed"];

  useEffect(() => {
    listModelFiles(repoId)
      .then((f) => {
        setFiles(f);
        setLoading(false);
      })
      .catch((e: any) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  useInput((input, key) => {
    if (loading) return;

    if (step === "list") {
      if (key.escape) return back();
      if (key.upArrow) up();
      else if (key.downArrow) down();
      else if (key.return && files[i]) {
        tb.open(suggestAlias(files[i].name));
        setStep("alias");
      }
    } else if (step === "alias") {
      if (key.escape) {
        tb.close();
        setStep("list");
        return;
      }
      if (key.return && tb.buf.trim()) {
        setStep("type");
        return;
      }
      if (key.backspace || key.delete) {
        tb.del();
        return;
      }
      if (input && !key.ctrl && !key.meta) {
        tb.type(input);
        return;
      }
    } else if (step === "type") {
      if (key.escape) {
        tb.open(tb.buf);
        setStep("alias");
        return;
      }
      if (key.leftArrow || key.rightArrow) {
        setTypeIdx((c) => (c === 0 ? 1 : 0));
        return;
      }
      if (key.return) {
        const uri = `hf:${repoId}/${files[i].name}`;
        addModel(config, {
          name: tb.buf.trim(),
          uri,
          type: typeOptions[typeIdx] as "chat" | "embed",
        });
        save(config);
        back();
      }
    }
  });

  const hints: Record<string, string> = {
    list: HINTS.NAV,
    alias: HINTS.TEXT_SUBMIT,
    type: HINTS.TOGGLE_SAVE,
  };

  return (
    <Chrome title={repoId} path="brainer › models › search" hint={hints[step]}>
      {loading && <Spinner text="loading files..." />}
      {error && (
        <Text color="red">
          {"  "}
          {error}
        </Text>
      )}

      {step === "list" &&
        files.map((f, idx) => (
          <Row key={f.name} selected={idx === i}>
            <Text bold={idx === i}>{f.name}</Text>
            <Text dimColor>
              {"  "}
              {formatSize(f.size)}
            </Text>
          </Row>
        ))}

      {step === "list" && !loading && files.length === 0 && !error && (
        <Text dimColor>{"  "}No GGUF files found</Text>
      )}

      {step !== "list" && files[i] && (
        <>
          <Text dimColor>
            {"  "}
            {files[i].name} ({formatSize(files[i].size)})
          </Text>
          <Box marginTop={1} flexDirection="column">
            <TextField
              label="Alias"
              value={tb.buf}
              selected={step === "alias"}
              editing={step === "alias"}
              buffer={tb.buf}
            />
            <ToggleField
              label="Type"
              options={typeOptions}
              value={typeOptions[typeIdx]}
              selected={step === "type"}
            />
          </Box>
        </>
      )}
    </Chrome>
  );
}

// ── Add model (manual) ──

export function ModelAddScreen({ config, save, back }: ScreenProps) {
  const steps = ["name", "uri", "type"] as const;
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [uri, setUri] = useState("");
  const typeOptions = ["chat", "embed"];
  const [typeIdx, setTypeIdx] = useState(0);
  const tb = useTextBuffer();

  useEffect(() => {
    tb.open("");
  }, []);

  useInput((input, key) => {
    if (key.escape) return back();
    const current = steps[step];

    if (current === "name" || current === "uri") {
      if (key.return && tb.buf) {
        if (current === "name") {
          setName(tb.buf);
          tb.open("");
          setStep(1);
        } else {
          setUri(tb.buf);
          tb.close();
          setStep(2);
        }
      } else if (key.backspace || key.delete) tb.del();
      else if (input && !key.ctrl && !key.meta) tb.type(input);
    }

    if (current === "type") {
      if (key.leftArrow || key.rightArrow) setTypeIdx((c) => (c === 0 ? 1 : 0));
      if (key.return) {
        const entry: ModelEntry = {
          name,
          uri,
          type: typeOptions[typeIdx] as "chat" | "embed",
        };
        addModel(config, entry);
        save(config);
        back();
      }
    }
  });

  return (
    <Chrome
      title="Add Model"
      path="brainer › models"
      hint={step < 2 ? HINTS.TEXT_NEXT : HINTS.TOGGLE_SAVE}
    >
      <TextField
        label="Name"
        value={name}
        selected={step === 0}
        editing={step === 0}
        buffer={tb.buf}
      />
      <TextField
        label="URI"
        value={uri}
        selected={step === 1}
        editing={step === 1}
        buffer={tb.buf}
      />
      <ToggleField
        label="Type"
        options={typeOptions}
        value={typeOptions[typeIdx]}
        selected={step === 2}
      />
    </Chrome>
  );
}
