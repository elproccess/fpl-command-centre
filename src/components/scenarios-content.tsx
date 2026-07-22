"use client";

import { useEffect, useState } from "react";
import { DataModeBadge } from "@/components/app-shell";
import { analyseScenario, getPlayersDirectory, type PlayerDirectoryEntry } from "@/lib/api";
import { usePolledAnalysis } from "@/components/polled-analysis";
import { ScenarioBuilder } from "@/components/scenario-builder";
import type { Player, TransferRoute } from "@/lib/types";

const FALLBACK_ROUTE: TransferRoute = {
  id: "imported-roll",
  title: "Recommendation is still computing",
  move: "Hold the current squad while analysis loads",
  expected_gain: 0,
  confidence: "Low",
  risk: "Low",
  why: ["The Scenario Builder is available now. The live recommended route will appear as soon as the background analysis completes."],
  why_this_could_be_wrong: [],
  route_type: "roll",
};

function apiId(player?: Player) {
  return player ? player.api_id ?? player.id : undefined;
}

// Mirrors use-command-centre.ts's server-only scenarioPayload() helper without importing
// next/headers into this client bundle. Keeping this payload shape aligned preserves the
// import-triggered scenario cache key while the interactive builder remains independently usable.
function buildScenarioPayload(payload: Record<string, unknown>, players: Player[]) {
  const captain = players.find((player) => player.role === "captain") ?? players.find((player) => player.position !== "GK") ?? players[0];
  const viceCaptain =
    players.find((player) => player.role === "vice captain") ??
    players.find((player) => player.id !== captain?.id && player.position !== "GK") ??
    players[1] ??
    captain;

  return {
    ...payload,
    scenarios: [
      {
        scenario_id: "imported_roll_transfer",
        name: "Roll transfer",
        scenario_type: "roll",
        transfers: [],
        captain_id: apiId(captain),
        vice_captain_id: apiId(viceCaptain),
      },
    ],
    auto_generate: true,
    max_auto_scenarios: 6,
    save: false,
  };
}

type DirectoryState =
  | { phase: "loading"; data: PlayerDirectoryEntry[]; message: "" }
  | { phase: "ready"; data: PlayerDirectoryEntry[]; message: "" }
  | { phase: "error"; data: PlayerDirectoryEntry[]; message: string };

export function ScenariosContent({
  payload,
  players,
  entryId,
}: {
  payload: Record<string, unknown>;
  players: Player[];
  entryId: string;
}) {
  const gameweekValue = payload.gameweek ?? payload.start_gw;
  const gameweekNumber = typeof gameweekValue === "number" ? gameweekValue : Number(gameweekValue);
  const recommendationState = usePolledAnalysis(
    () => analyseScenario(buildScenarioPayload(payload, players)),
    [payload.entry_id, players.length],
    "scenarios",
    { entryId, gameweek: Number.isFinite(gameweekNumber) ? gameweekNumber : undefined, analysisType: "scenarios" },
  );
  const [directoryState, setDirectoryState] = useState<DirectoryState>({ phase: "loading", data: [], message: "" });

  useEffect(() => {
    let cancelled = false;

    void getPlayersDirectory()
      .then((result) => {
        if (!cancelled) setDirectoryState({ phase: "ready", data: result.data, message: "" });
      })
      .catch((error) => {
        if (!cancelled) {
          setDirectoryState({
            phase: "error",
            data: [],
            message: error instanceof Error ? error.message : "The player directory could not be loaded.",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const recommendationStatus =
    recommendationState.phase === "ready" ? "ready" : recommendationState.phase === "error" ? "error" : "loading";
  const recommendedRoute =
    recommendationState.phase === "ready" ? recommendationState.data.ranked_scenarios[0] ?? FALLBACK_ROUTE : FALLBACK_ROUTE;
  const recommendationMessage = recommendationState.phase === "error" ? recommendationState.message : "";

  return (
    <>
      <div className="mb-4 flex justify-end">
        <DataModeBadge source={{ mode: "real", label: "Real backend connected" }} />
      </div>
      <ScenarioBuilder
        players={players}
        payload={payload}
        directory={directoryState.data}
        directoryStatus={directoryState.phase}
        directoryMessage={directoryState.message}
        recommendedRoute={recommendedRoute}
        recommendationStatus={recommendationStatus}
        recommendationMessage={recommendationMessage}
        entryId={entryId}
      />
    </>
  );
}