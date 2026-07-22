"use client";

import { useState } from "react";
import { getSavedSquadHealth } from "@/lib/api";
import type { SquadHealthDiagnostics } from "@/lib/types";
import { ConfidenceBadge, RiskBadge } from "./badges";
import { SquadHealthCard } from "./cards";

type Status = "idle" | "loading" | "ready" | "error";

export function SavedSquadHealthPanel({ entryId, currentGameweek }: { entryId: string; currentGameweek: number }) {
  const [gameweek, setGameweek] = useState(String(Math.max(1, currentGameweek - 1)));
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [diagnostics, setDiagnostics] = useState<SquadHealthDiagnostics | null>(null);
  const [viewedGw, setViewedGw] = useState<number | null>(null);

  async function handleView() {
    const gw = Number(gameweek);
    if (!Number.isFinite(gw) || gw < 1) {
      setStatus("error");
      setError("Enter a valid past gameweek number.");
      return;
    }
    setStatus("loading");
    setError("");
    try {
      const response = await getSavedSquadHealth(entryId, gw);
      setDiagnostics(response.data);
      setViewedGw(gw);
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "No saved squad found for that gameweek.");
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-[#E8DEF8] bg-white p-5 shadow-[0_18px_45px_rgba(55,0,60,0.08)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.14em] text-[#6C1DFF]">Saved / historical view</p>
          <h2 className="text-2xl font-black text-[#17002F]">Squad health for a past gameweek</h2>
          <p className="mt-1 max-w-2xl text-sm font-semibold leading-6 text-[#5D4A70]">
            GET /squad-health/{"{entry_id}"} re-runs diagnostics on whatever squad was actually saved for a chosen
            gameweek, unlike the live view above which always reflects your current squad.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <input
            value={gameweek}
            onChange={(event) => setGameweek(event.target.value)}
            inputMode="numeric"
            aria-label="Gameweek"
            className="w-24 rounded-xl border border-[#E8DEF8] bg-white px-3 py-2 text-sm font-semibold text-[#17002F] outline-none focus:border-[#6C1DFF]"
          />
          <button
            type="button"
            onClick={() => void handleView()}
            disabled={status === "loading"}
            className="shrink-0 rounded-xl bg-[#6C1DFF] px-4 py-3 text-sm font-black text-white disabled:cursor-wait disabled:opacity-60"
          >
            {status === "loading" ? "Loading..." : "View saved health"}
          </button>
        </div>
      </div>

      {status === "error" ? <p className="mt-4 text-sm font-bold text-[#C80046]">{error}</p> : null}

      {status === "ready" && diagnostics ? (
        <div className="mt-5 space-y-4">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-[#7B688E]">Showing saved squad health for GW{viewedGw}</p>
          <SquadHealthCard health={diagnostics.health} compact />
          <div className="rounded-xl border border-[#E8DEF8] bg-[#F8F5FF] p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#6C1DFF]">Recommended fix (as of GW{viewedGw})</p>
            <h3 className="mt-2 text-lg font-black text-[#17002F]">{diagnostics.recommended_fix.action}</h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-[#5D4A70]">{diagnostics.recommended_fix.why}</p>
            <div className="mt-3 flex gap-2">
              <ConfidenceBadge value={diagnostics.recommended_fix.confidence} />
              <RiskBadge value={diagnostics.recommended_fix.risk} />
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
