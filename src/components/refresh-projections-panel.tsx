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
    <section className="mt-6 rounded-2xl border border-[var(--warning)]/40 bg-[var(--warning-soft)] p-5 shadow-[0_18px_45px_rgba(55,0,60,0.08)]">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--warning)]">Dev tool</p>
        <span className="rounded-full bg-[var(--warning)]/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[var(--warning)]">No permission check yet</span>
      </div>
      <h2 className="mt-2 text-2xl font-black text-[var(--ink)]">Refresh Projections</h2>
      <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[var(--muted)]">
        Manually triggers POST /projections/compute. This recomputes and (optionally) persists projection rows for the
        selected gameweek range — useful right after ingesting new data, ahead of a real scheduled job. An unfiltered
        run across all players can take a minute or two.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="text-sm font-black text-[var(--ink)]">
          From gameweek
          <input
            value={fromGw}
            onChange={(event) => setFromGw(event.target.value)}
            inputMode="numeric"
            className="mt-2 w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-2 font-semibold text-[var(--ink)] outline-none focus:border-[var(--accent)]"
          />
        </label>
        <label className="text-sm font-black text-[var(--ink)]">
          Horizon
          <input
            value={horizon}
            onChange={(event) => setHorizon(event.target.value)}
            inputMode="numeric"
            className="mt-2 w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-2 font-semibold text-[var(--ink)] outline-none focus:border-[var(--accent)]"
          />
        </label>
        <label className="flex items-center gap-2 self-end text-sm font-black text-[var(--ink)]">
          <input type="checkbox" checked={persist} onChange={(event) => setPersist(event.target.checked)} className="h-4 w-4" />
          Persist rows
        </label>
      </div>

      <button
        type="button"
        onClick={() => void handleRefresh()}
        disabled={status === "loading"}
        className="mt-4 rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-black text-white disabled:cursor-wait disabled:opacity-60"
      >
        {status === "loading" ? "Refreshing..." : "Refresh Projections"}
      </button>

      {status === "error" ? <p className="mt-4 text-sm font-bold text-[var(--danger)]">{error}</p> : null}

      {status === "ready" && result ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-[var(--surface)] p-3"><p className="text-xs font-black uppercase text-[var(--muted)]">Model version</p><p className="mt-1 text-sm font-black text-[var(--ink)]">{result.model_version || "-"}</p></div>
          <div className="rounded-xl bg-[var(--surface)] p-3"><p className="text-xs font-black uppercase text-[var(--muted)]">GW range</p><p className="mt-1 text-sm font-black text-[var(--ink)]">{result.from_gw}-{result.to_gw}</p></div>
          <div className="rounded-xl bg-[var(--surface)] p-3"><p className="text-xs font-black uppercase text-[var(--muted)]">Players considered</p><p className="mt-1 text-sm font-black text-[var(--ink)]">{result.players_considered}</p></div>
          <div className="rounded-xl bg-[var(--surface)] p-3"><p className="text-xs font-black uppercase text-[var(--muted)]">Projections computed</p><p className="mt-1 text-sm font-black text-[var(--ink)]">{result.projections_computed}</p></div>
          <div className="rounded-xl bg-[var(--surface)] p-3"><p className="text-xs font-black uppercase text-[var(--muted)]">Rows inserted / updated</p><p className="mt-1 text-sm font-black text-[var(--ink)]">{result.rows_inserted} / {result.rows_updated}</p></div>
          <div className="rounded-xl bg-[var(--surface)] p-3"><p className="text-xs font-black uppercase text-[var(--muted)]">Rows skipped (existing)</p><p className="mt-1 text-sm font-black text-[var(--ink)]">{result.rows_skipped_existing}</p></div>
        </div>
      ) : null}
    </section>
  );
}
