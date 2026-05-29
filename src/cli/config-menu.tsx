import React, { useState, useCallback } from "react";
import { render, useApp } from "ink";
import type { BrainerConfig } from "../core/config/index.js";
import type { Screen, ScreenProps, SaveFn, MenuAction } from "./tui/types.js";
import { MainScreen } from "./tui/screens/main.js";
import {
  ProvidersScreen,
  ProviderConfigScreen,
} from "./tui/screens/providers.js";
import {
  ModelsScreen,
  ModelAddScreen,
  ModelSearchScreen,
  ModelFilesScreen,
} from "./tui/screens/models.js";
import {
  SpacesScreen,
  SpaceAddScreen,
  SpaceDetailScreen,
} from "./tui/screens/spaces.js";
import { ConfigJsonScreen } from "./tui/screens/config-json.js";
import { CommandsScreen } from "./tui/screens/commands.js";

function App({
  initialConfig,
  persist,
  onAction,
  onRebuild,
}: {
  initialConfig: BrainerConfig;
  persist: SaveFn;
  onAction: (action: MenuAction) => void;
  onRebuild: (space: string) => Promise<void>;
}) {
  const [config, setConfig] = useState(initialConfig);
  const [screen, setScreen] = useState<Screen>({ id: "main" });
  const [mainIndex, setMainIndex] = useState(0);
  const { exit } = useApp();

  const save: SaveFn = useCallback(
    (c) => {
      persist(c);
      setConfig({ ...c });
    },
    [persist],
  );

  const emitAction = useCallback(
    (action: MenuAction) => {
      onAction(action);
      exit();
    },
    [onAction, exit],
  );

  const MAIN_IDS = ["providers", "models", "spaces", "config-json", "commands"];

  const navFromMain = useCallback((s: Screen) => {
    const idx = MAIN_IDS.indexOf(s.id);
    if (idx >= 0) setMainIndex(idx);
    setScreen(s);
  }, []);

  const main = useCallback(() => setScreen({ id: "main" }), []);
  const toProviders = useCallback(() => setScreen({ id: "providers" }), []);
  const toModels = useCallback(() => setScreen({ id: "models" }), []);
  const toSearch = useCallback(() => setScreen({ id: "model-search" }), []);
  const toSpaces = useCallback(() => setScreen({ id: "spaces" }), []);

  const props: ScreenProps = { config, save, nav: setScreen, back: main };

  switch (screen.id) {
    case "main":
      return <MainScreen nav={navFromMain} initialIndex={mainIndex} />;
    case "providers":
      return <ProvidersScreen {...props} nav={setScreen} />;
    case "provider-config":
      return (
        <ProviderConfigScreen
          {...props}
          role={screen.role}
          back={toProviders}
        />
      );
    case "models":
      return <ModelsScreen {...props} nav={setScreen} />;
    case "model-add":
      return <ModelAddScreen {...props} back={toModels} />;
    case "model-search":
      return <ModelSearchScreen {...props} back={toModels} />;
    case "model-files":
      return (
        <ModelFilesScreen {...props} repoId={screen.repoId} back={toSearch} />
      );
    case "spaces":
      return <SpacesScreen {...props} nav={setScreen} />;
    case "space-add":
      return <SpaceAddScreen {...props} back={toSpaces} />;
    case "space-detail":
      return (
        <SpaceDetailScreen
          {...props}
          name={screen.name}
          back={toSpaces}
          onAction={emitAction}
          onRebuild={onRebuild}
        />
      );
    case "config-json":
      return <ConfigJsonScreen {...props} />;
    case "commands":
      return <CommandsScreen {...props} />;
    default:
      return <MainScreen nav={setScreen} />;
  }
}

export async function configMenu(
  config: BrainerConfig,
  save: SaveFn,
  onRebuild: (space: string) => Promise<void>,
): Promise<MenuAction | null> {
  let result: MenuAction | null = null;
  process.stdout.write("\x1b[?1049h\x1b[H");
  try {
    const { waitUntilExit } = render(
      <App
        initialConfig={config}
        persist={save}
        onAction={(action) => {
          result = action;
        }}
        onRebuild={onRebuild}
      />,
    );
    await waitUntilExit();
  } finally {
    process.stdout.write("\x1b[?1049l");
  }
  return result;
}
