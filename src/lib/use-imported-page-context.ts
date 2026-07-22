"use client";

import { useSyncExternalStore } from "react";
import {
  appStateFromImport,
  commandCentrePayloadFromImport,
  IMPORTED_TEAM_STORAGE_KEY,
  playersFromImport,
} from "@/lib/imported-team";
import type { DataSourceStatus, Player, StoredImportedTeam, UserGameState } from "@/lib/types";

export type ImportedPageContext = {
  imported: StoredImportedTeam;
  appState: UserGameState;
  payload: Record<string, unknown>;
  players: Player[];
  importSource: DataSourceStatus;
};

export type ImportedPageState = { status: "missing" } | { status: "ready"; context: ImportedPageContext };

const REAL_SOURCE: DataSourceStatus = { mode: "real", label: "Real backend connected" };

// useSyncExternalStore (not useEffect+useState) because localStorage is a true external
// store: it needs a getServerSnapshot for hydration safety, and re-parsing JSON on every
// getSnapshot() call would return a new object identity each time, which would make
// useSyncExternalStore think the store changed on every unrelated re-render and loop forever.
// This cache keeps the same parsed object as long as the raw string hasn't changed.
let cachedRaw: string | null = null;
let cachedValue: StoredImportedTeam | null = null;

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(IMPORTED_TEAM_STORAGE_KEY) ?? window.sessionStorage.getItem(IMPORTED_TEAM_STORAGE_KEY);
  } catch {
    return null;
  }
}

function getSnapshot(): StoredImportedTeam | null {
  const raw = readRaw();
  if (raw === cachedRaw) return cachedValue;
  cachedRaw = raw;
  if (!raw) {
    cachedValue = null;
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as StoredImportedTeam;
    cachedValue = parsed.entry_id && Array.isArray(parsed.squad) ? parsed : null;
  } catch {
    cachedValue = null;
  }
  return cachedValue;
}

function getServerSnapshot(): StoredImportedTeam | null {
  return null;
}

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

/**
 * Resolves the page's squad/appState/payload straight from the localStorage snapshot
 * saveImportedTeam() wrote at import time - no network round trip - so tab navigation never
 * has to block the page shell on a server-side re-fetch of the imported team. This also keeps
 * every tab's request payload identical to what the background precompute already hashed its
 * cache keys against, instead of risking a cache miss from a freshly re-fetched squad that
 * drifted slightly (e.g. the season having moved to a new gameweek since import).
 */
export function useImportedPageContext(): ImportedPageState {
  const imported = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (!imported || imported.squad.length === 0) {
    return { status: "missing" };
  }

  return {
    status: "ready",
    context: {
      imported,
      appState: appStateFromImport(imported),
      payload: commandCentrePayloadFromImport(imported),
      players: playersFromImport(imported),
      importSource: REAL_SOURCE,
    },
  };
}
