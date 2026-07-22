"use client";

import { useState } from "react";
import { runProjectionTraining } from "@/lib/api";

type Status = "idle" | "loading" | "ready" | "error";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractMae(metrics: unknown): number | null {
  if (!isRecord(metrics)) return null;
  const candidates = [
    isRecord(metrics.test) ? metrics.test.mae : undefined,
    isRecord(metrics.best_candidate_metrics) ? metrics.best_candidate_metrics.mae : undefined,
    isRecord(metrics.per_gw_evaluation) && isRecord(metrics.per_gw_evaluation.best_candidate) && isRecord(metrics.per_gw_evaluation.best_candidate.test_metrics)
      ? metrics.per_gw_evaluation.best_candidate.test_metrics.mae
      : undefined,
    metrics.mae,
  ];
  for (const value of candidates) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

export function RunTrainingPanel() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  async function handleRun() {
    setStatus("loading");
    setError("");
    try {
      const response = await runProjectionTraining({});
      setResult(response.data);
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Training run failed.");
    }
  }

  const promotionDecision = result && isRecord(result.promotion_decision) ? result.promotion_decision : null;
  const mae = result ? extractMae(result.metrics) : null;

  return (
    <section className="mt-6 rounded-2xl border border-[#FFB800]/40 bg-[#FFF8E8] p-5 shadow-[0_18px_45px_rgba(55,0,60,0.08)]">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#8A6200]">Dev tool</p>
        <span className="rounded-full bg-[#FFB800]/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[#8A6200]">No permission check yet</span>
      </div>
      <h2 className="mt-2 text-2xl font-black text-[#17002F]">Run training</h2>
      <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[#5D4A70]">
        Manually triggers POST /projection-training/train over the full available dataset (~4 minutes locally). The
        resulting candidate is only promoted to active automatically if it clears the promotion gates - this button
        does not force promotion.
      </p>

      <button
        type="button"
        onClick={() => void handleRun()}
        disabled={status === "loading"}
        className="mt-4 rounded-xl bg-[#6C1DFF] px-4 py-3 text-sm font-black text-white disabled:cursor-wait disabled:opacity-60"
      >
        {status === "loading" ? "Training... (can take several minutes)" : "Run training"}
      </button>

      {status === "error" ? <p className="mt-4 text-sm font-bold text-[#C80046]">{error}</p> : null}

      {status === "ready" && result ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-white p-3">
            <p className="text-xs font-black uppercase text-[#7B688E]">New candidate</p>
            <p className="mt-1 break-all text-sm font-black text-[#17002F]">{String(result.model_version ?? "—")}</p>
          </div>
          <div className="rounded-xl bg-white p-3">
            <p className="text-xs font-black uppercase text-[#7B688E]">Test MAE</p>
            <p className="mt-1 text-sm font-black text-[#17002F]">{mae != null ? mae.toFixed(3) : "—"}</p>
          </div>
          <div className="rounded-xl bg-white p-3">
            <p className="text-xs font-black uppercase text-[#7B688E]">Promotion decision</p>
            <p className="mt-1 text-sm font-black text-[#17002F]">
              {promotionDecision ? String(promotionDecision.promotion_status ?? "unknown") : String(result.status ?? "unknown")}
            </p>
            {promotionDecision?.reason ? <p className="mt-1 text-xs font-semibold text-[#7B688E]">{String(promotionDecision.reason)}</p> : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
