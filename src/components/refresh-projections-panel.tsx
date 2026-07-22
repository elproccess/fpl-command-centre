"use client";

import { useState } from "react";
import { computeProjections, type ProjectionComputeResult } from "@/lib/api";
import { readImportedTeam } from "@/lib/imported-team";

type Status = "idle" | "loading" | "ready" | "error";

export function RefreshProjectionsPanel() {
  const defaultGw = readImportedTeam()?.event ?? 1;
  const [fromGw, setFromGw] = useState(String(defaultGw));
  const [horizon, setHorizon] = useState("5");
  const [persist, setPersist] = useState(true);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState<ProjectionComputeResult | null>(null);

  async function handleRefresh() {
    const parsedFromGw = Number(fromGw);
    const parsedHorizon = Number(horizon);
    if (!Number.isFinite(parsedFromGw) || parsedFromGw < 1) {
      setStatus("error");
      setError("Enter a valid starting gameweek (1 or higher).");
      return;
    }

    setStatus("loading");
    setError("");
    try {
      const response = await computeProjections({
        from_gw: parsedFromGw,
        horizon: Number.isFinite(parsedHorizon) && parsedHorizon > 0 ? parsedHorizon : undefined,
        persist,
        force: false,
      });
      setResult(response.data);
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Projection refresh failed.");
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-[#FFB800]/40 bg-[#FFF8E8] p-5 shadow-[0_18px_45px_rgba(55,0,60,0.08)]">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#8A6200]">Dev tool</p>
        <span className="rounded-full bg-[#FFB800]/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[#8A6200]">No permission check yet</span>
      </div>
      <h2 className="mt-2 text-2xl font-black text-[#17002F]">Refresh Projections</h2>
      <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[#5D4A70]">
        Manually triggers POST /projections/compute. This recomputes and (optionally) persists projection rows for the
        selected gameweek range — useful right after ingesting new data, ahead of a real scheduled job. An unfiltered
        run across all players can take a minute or two.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="text-sm font-black text-[#17002F]">
          From gameweek
          <input
            value={fromGw}
            onChange={(event) => setFromGw(event.target.value)}
            inputMode="numeric"
            className="mt-2 w-full rounded-xl border border-[#E8DEF8] bg-white px-3 py-2 font-semibold text-[#17002F] outline-none focus:border-[#6C1DFF]"
          />
        </label>
        <label className="text-sm font-black text-[#17002F]">
          Horizon
          <input
            value={horizon}
            onChange={(event) => setHorizon(event.target.value)}
            inputMode="numeric"
            className="mt-2 w-full rounded-xl border border-[#E8DEF8] bg-white px-3 py-2 font-semibold text-[#17002F] outline-none focus:border-[#6C1DFF]"
          />
        </label>
        <label className="flex items-center gap-2 self-end text-sm font-black text-[#17002F]">
          <input type="checkbox" checked={persist} onChange={(event) => setPersist(event.target.checked)} className="h-4 w-4" />
          Persist rows
        </label>
      </div>

      <button
        type="button"
        onClick={() => void handleRefresh()}
        disabled={status === "loading"}
        className="mt-4 rounded-xl bg-[#6C1DFF] px-4 py-3 text-sm font-black text-white disabled:cursor-wait disabled:opacity-60"
      >
        {status === "loading" ? "Refreshing..." : "Refresh Projections"}
      </button>

      {status === "error" ? <p className="mt-4 text-sm font-bold text-[#C80046]">{error}</p> : null}

      {status === "ready" && result ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-white p-3"><p className="text-xs font-black uppercase text-[#7B688E]">Model version</p><p className="mt-1 text-sm font-black text-[#17002F]">{result.model_version || "-"}</p></div>
          <div className="rounded-xl bg-white p-3"><p className="text-xs font-black uppercase text-[#7B688E]">GW range</p><p className="mt-1 text-sm font-black text-[#17002F]">{result.from_gw}-{result.to_gw}</p></div>
          <div className="rounded-xl bg-white p-3"><p className="text-xs font-black uppercase text-[#7B688E]">Players considered</p><p className="mt-1 text-sm font-black text-[#17002F]">{result.players_considered}</p></div>
          <div className="rounded-xl bg-white p-3"><p className="text-xs font-black uppercase text-[#7B688E]">Projections computed</p><p className="mt-1 text-sm font-black text-[#17002F]">{result.projections_computed}</p></div>
          <div className="rounded-xl bg-white p-3"><p className="text-xs font-black uppercase text-[#7B688E]">Rows inserted / updated</p><p className="mt-1 text-sm font-black text-[#17002F]">{result.rows_inserted} / {result.rows_updated}</p></div>
          <div className="rounded-xl bg-white p-3"><p className="text-xs font-black uppercase text-[#7B688E]">Rows skipped (existing)</p><p className="mt-1 text-sm font-black text-[#17002F]">{result.rows_skipped_existing}</p></div>
        </div>
      ) : null}
    </section>
  );
}
