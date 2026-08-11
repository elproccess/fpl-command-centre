"use client";

import { useState } from "react";
import { createRecommendationSnapshot, getGameweekCommandCentreRaw } from "@/lib/api";
import { commandCentrePayloadFromImport, readImportedTeam } from "@/lib/imported-team";

type Status = "idle" | "loading" | "ready" | "error";

export function CreateAuditSnapshotPanel() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [auditId, setAuditId] = useState("");

  async function handleCreateSnapshot() {
    const imported = readImportedTeam();
    if (!imported) {
      setStatus("error");
      setError("No imported team found in this browser. Import your FPL team first.");
      return;
    }

    setStatus("loading");
    setError("");
    try {
      const payload = commandCentrePayloadFromImport(imported);
      const dashboard = await getGameweekCommandCentreRaw(payload, {
        apiName: "createAuditSnapshotDashboard",
        disableFallback: true,
        timeoutMs: 120000,
      });
      const snapshot = await createRecommendationSnapshot({
        entry_id: imported.entry_id,
        gameweek: imported.event,
        source: "command_centre",
        recommendation_payload: dashboard.data,
      });
      setAuditId(snapshot.data.audit_id ?? "");
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Could not create audit snapshot.");
    }
  }

  return (
    <section className="mb-6 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-5 shadow-[0_18px_45px_rgba(55,0,60,0.08)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--accent)]">Recommendation audit</p>
          <h2 className="mt-1 text-2xl font-black text-[var(--ink)]">Create new audit snapshot</h2>
          <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[var(--muted)]">
            Captures the current Command Centre recommendation (best move, captaincy) for this gameweek so it can be
            evaluated against actual results later. POST /recommendation-audit/snapshot.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleCreateSnapshot()}
          disabled={status === "loading"}
          className="shrink-0 rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-black text-white disabled:cursor-wait disabled:opacity-60"
        >
          {status === "loading" ? "Capturing..." : "Create snapshot"}
        </button>
      </div>

      {status === "error" ? <p className="mt-4 text-sm font-bold text-[var(--danger)]">{error}</p> : null}
      {status === "ready" ? (
        <p className="mt-4 text-sm font-bold text-[var(--success)]">
          Snapshot stored{auditId ? ` (audit_id: ${auditId})` : ""}. It will show up in evaluation once the gameweek results are in.
        </p>
      ) : null}
    </section>
  );
}
