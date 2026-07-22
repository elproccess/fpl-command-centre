import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { RunTrainingPanel } from "@/components/run-training-panel";
import { getProjectionModels, getProjectionTrainingStatus } from "@/lib/api";
import { loadPricingData } from "@/lib/use-command-centre";

export const dynamic = "force-dynamic";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractMae(metrics: unknown): number | null {
  if (!isRecord(metrics)) return null;
  const candidates = [
    // historical_sportmonks pipeline shape
    isRecord(metrics.per_gw_evaluation) && isRecord(metrics.per_gw_evaluation.best_candidate) && isRecord(metrics.per_gw_evaluation.best_candidate.test_metrics)
      ? metrics.per_gw_evaluation.best_candidate.test_metrics.mae
      : undefined,
    // standard /projection-training/train shape
    isRecord(metrics.test) ? metrics.test.mae : undefined,
    isRecord(metrics.best_candidate_metrics) ? metrics.best_candidate_metrics.mae : undefined,
    isRecord(metrics.test_metrics) ? metrics.test_metrics.mae : undefined,
    isRecord(metrics.validation_metrics) ? metrics.validation_metrics.mae : undefined,
    metrics.mae,
  ];
  for (const value of candidates) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

export default async function ProjectionModelsPage() {
  const { appState, dataSource } = loadPricingData();

  let statusData: Record<string, unknown> = {};
  let models: Record<string, unknown>[] = [];
  let loadError = "";
  try {
    const [statusResult, modelsResult] = await Promise.all([getProjectionTrainingStatus(), getProjectionModels()]);
    statusData = statusResult.data;
    models = modelsResult.data.models;
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Could not load projection training status.";
  }

  // /projection-training/status's active_trained_model doesn't carry full metrics -
  // look the same version up in the /models list, which does.
  const activeModelFromList = models.find((model) => model.model_version === statusData.active_trained_model_version) ?? null;
  const activeMae = activeModelFromList ? extractMae(activeModelFromList.metrics) : null;

  return (
    <AppShell title="Model Training" eyebrow="Projection engine training pipeline" state={appState} dataSource={dataSource}>
      <div className="mb-4">
        <Link href="/settings" className="text-sm font-black text-[#6C1DFF]">
          &larr; Back to Settings
        </Link>
      </div>

      {loadError ? (
        <section className="rounded-2xl border border-[#FF4D8D]/30 bg-[#FF4D8D]/10 p-5">
          <p className="text-sm font-bold text-[#C80046]">{loadError}</p>
        </section>
      ) : (
        <>
          <section className="rounded-2xl border border-[#111827] bg-[#070912] p-5 text-white shadow-[0_24px_60px_rgba(0,0,0,0.18)]">
            <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#A7F3D0]">Active trained model</p>
                <h2 className="mt-2 break-all text-2xl font-black">{String(statusData.active_trained_model_version ?? "None trained yet")}</h2>
                <p className="mt-2 text-sm font-semibold text-white/60">Formula fallback: {String(statusData.active_formula_model_version ?? "—")}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-white/8 p-4">
                  <p className="text-xs font-black uppercase text-white/50">MAE</p>
                  <p className="mt-2 text-3xl font-black text-[#00E6A8]">{activeMae != null ? activeMae.toFixed(3) : "—"}</p>
                </div>
                <div className="rounded-xl bg-white/8 p-4">
                  <p className="text-xs font-black uppercase text-white/50">Training tables</p>
                  <p className="mt-2 text-xl font-black text-white">{statusData.training_tables_available ? "Available" : "Missing"}</p>
                </div>
                <div className="rounded-xl bg-white/8 p-4">
                  <p className="text-xs font-black uppercase text-white/50">Backtest-safe</p>
                  <p className="mt-2 text-xl font-black text-white">{statusData.backtest_safe ? "Yes" : "No"}</p>
                </div>
              </div>
            </div>
          </section>

          <RunTrainingPanel />

          <section className="mt-6 rounded-2xl border border-[#E8DEF8] bg-white p-5 shadow-[0_18px_45px_rgba(55,0,60,0.08)]">
            <h2 className="text-2xl font-black text-[#17002F]">Promotion history</h2>
            <p className="mt-1 text-sm font-semibold text-[#5D4A70]">GET /projection-training/models - every trained candidate, promoted or rejected.</p>
            <div className="mt-4 space-y-2">
              {models.length === 0 ? (
                <p className="text-sm font-semibold text-[#5D4A70]">No trained candidates recorded yet.</p>
              ) : (
                models.map((model) => {
                  const mae = extractMae(model.metrics);
                  return (
                    <div key={String(model.model_version)} className="flex flex-col gap-2 rounded-xl bg-[#F8F5FF] p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-[#17002F]">{String(model.model_version)}</p>
                        <p className="text-xs font-semibold text-[#7B688E]">
                          {String(model.model_type ?? "")} - {model.created_at ? new Date(String(model.created_at)).toLocaleString() : "unknown date"}
                          {model.promoted_at ? ` - promoted ${new Date(String(model.promoted_at)).toLocaleString()}` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <p className="text-sm font-black text-[#6C1DFF]">MAE {mae != null ? mae.toFixed(3) : "—"}</p>
                        <span
                          className={`w-fit rounded-full px-3 py-1 text-xs font-black ${
                            model.active ? "bg-[#00C853]/12 text-[#008B3A]" : model.status === "rejected" ? "bg-[#E90052]/10 text-[#C80046]" : "bg-[#FFB800]/12 text-[#8A6200]"
                          }`}
                        >
                          {model.active ? "active" : String(model.status ?? "unknown")}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </>
      )}
    </AppShell>
  );
}
