import { AppShell } from "@/components/app-shell";
import { RouteError } from "@/components/route-error";
import { apiAudit, futureBffTodos } from "@/lib/api-audit";
import { getBacktestRuns, getBacktestStatus, getDecisionVariables } from "@/lib/api";
import { loadTrustData } from "@/lib/use-command-centre";

export const dynamic = "force-dynamic";

function TrustCard({ title, body }: { title: string; body: string }) {
  return (
    <section className="rounded-2xl border border-[#E8DEF8] bg-white p-5 shadow-[0_18px_45px_rgba(55,0,60,0.08)]">
      <h2 className="text-xl font-black text-[#17002F]">{title}</h2>
      <p className="mt-3 text-sm font-semibold leading-6 text-[#5D4A70]">{body}</p>
    </section>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractRunMae(summary: unknown): number | null {
  if (!isRecord(summary)) return null;
  const candidates = [
    isRecord(summary.v1_metrics) ? summary.v1_metrics.mean_absolute_error : undefined,
    isRecord(summary.v1_metrics) ? summary.v1_metrics.mae : undefined,
    summary.mean_absolute_error,
    summary.mae,
  ];
  for (const value of candidates) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

export default async function TrustPage() {
  let data;
  try {
    data = await loadTrustData();
  } catch (error) {
    return <RouteError title="Why Trust This?" route="/trust" error={error} />;
  }
  const { appState, trust, projectionStatus, dataSource } = data;

  let backtestStatus: Record<string, unknown> = {};
  let backtestRuns: Record<string, unknown>[] = [];
  let backtestError = "";
  try {
    const [statusResult, runsResult] = await Promise.all([getBacktestStatus(), getBacktestRuns(5)]);
    backtestStatus = statusResult.data;
    backtestRuns = runsResult.data;
  } catch (error) {
    backtestError = error instanceof Error ? error.message : "Could not load backtest results.";
  }
  const dataQuality = isRecord(backtestStatus.data_quality_summary) ? backtestStatus.data_quality_summary : {};

  let usedVariables: unknown[] = [];
  let availableVariables: unknown[] = [];
  let variablesError = "";
  try {
    const variablesResult = await getDecisionVariables();
    usedVariables = Array.isArray(variablesResult.data.currently_used_in_scoring) ? variablesResult.data.currently_used_in_scoring : [];
    availableVariables = Array.isArray(variablesResult.data.available_but_not_yet_scored) ? variablesResult.data.available_but_not_yet_scored : [];
  } catch (error) {
    variablesError = error instanceof Error ? error.message : "Could not load decision variables.";
  }

  return (
    <AppShell title="Why Trust This?" eyebrow="Model confidence, risk, and safety" state={appState} dataSource={dataSource}>
      <section className="rounded-2xl border border-[#111827] bg-[#070912] p-5 text-white shadow-[0_24px_60px_rgba(0,0,0,0.18)]">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#A7F3D0]">Plain English model note</p>
        <h2 className="mt-2 text-4xl font-black">Model-backed, not black-box theatre</h2>
        <p className="mt-3 max-w-4xl text-sm font-semibold leading-6 text-white/72">{trust.prediction_system}</p>
      </section>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <TrustCard title="Confidence and risk labels" body={trust.confidence_risk_labels} />
        <TrustCard title="Fallback warning" body={trust.fallback_warning} />
        <TrustCard title="Previous model comparison" body={trust.previous_model_comparison} />
        <TrustCard title="Rollback safety" body={trust.rollback_safety} />
      </div>

      <section className="mt-6 rounded-2xl border border-[#E8DEF8] bg-white p-5 shadow-[0_18px_45px_rgba(55,0,60,0.08)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#6C1DFF]">Active model status</p>
            <h2 className="mt-2 text-2xl font-black text-[#17002F]">{String(projectionStatus.projection_model_type ?? "Projection status")}</h2>
            <p className="mt-2 text-sm font-semibold text-[#5D4A70]">
              Fallback: {projectionStatus.fallback_used ? "active" : "not reported"} {projectionStatus.fallback_reason ? `- ${projectionStatus.fallback_reason}` : ""}
            </p>
          </div>
          <span className="rounded-full bg-[#17002F] px-4 py-2 text-sm font-black text-white">Advanced details folded away</span>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-[#E8DEF8] bg-white p-5 shadow-[0_18px_45px_rgba(55,0,60,0.08)]">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#6C1DFF]">Decision variables</p>
        <h2 className="mt-2 text-2xl font-black text-[#17002F]">What actually drives a recommendation</h2>
        {variablesError ? (
          <p className="mt-3 text-sm font-bold text-[#C80046]">{variablesError}</p>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl bg-[#F8F5FF] p-4">
              <p className="text-xs font-black uppercase tracking-[0.1em] text-[#7B688E]">Used in scoring today ({usedVariables.length})</p>
              <div className="mt-2 flex max-h-40 flex-wrap gap-1.5 overflow-auto">
                {usedVariables.map((variable) => (
                  <span key={String(variable)} className="rounded-full bg-[#00C853]/12 px-2 py-1 text-[11px] font-bold text-[#008B3A]">{String(variable)}</span>
                ))}
              </div>
            </div>
            <div className="rounded-xl bg-[#F8F5FF] p-4">
              <p className="text-xs font-black uppercase tracking-[0.1em] text-[#7B688E]">Tracked but not yet scored ({availableVariables.length})</p>
              <div className="mt-2 flex max-h-40 flex-wrap gap-1.5 overflow-auto">
                {availableVariables.map((variable) => (
                  <span key={String(variable)} className="rounded-full bg-[#FFB800]/12 px-2 py-1 text-[11px] font-bold text-[#8A6200]">{String(variable)}</span>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-[#E8DEF8] bg-white p-5 shadow-[0_18px_45px_rgba(55,0,60,0.08)]">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#6C1DFF]">Backtest results</p>
        <h2 className="mt-2 text-2xl font-black text-[#17002F]">How the model performs against real gameweek outcomes</h2>

        {backtestError ? (
          <p className="mt-3 text-sm font-bold text-[#C80046]">{backtestError}</p>
        ) : (
          <>
            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              <div className="rounded-xl bg-[#F8F5FF] p-3">
                <p className="text-xs font-black uppercase text-[#7B688E]">Last run</p>
                <p className="mt-1 text-sm font-black text-[#17002F]">{backtestStatus.latest_run_at ? new Date(String(backtestStatus.latest_run_at)).toLocaleString() : "—"}</p>
              </div>
              <div className="rounded-xl bg-[#F8F5FF] p-3">
                <p className="text-xs font-black uppercase text-[#7B688E]">Model version</p>
                <p className="mt-1 truncate text-sm font-black text-[#17002F]">{String(backtestStatus.projection_model_version ?? "—")}</p>
              </div>
              <div className="rounded-xl bg-[#F8F5FF] p-3">
                <p className="text-xs font-black uppercase text-[#7B688E]">Leakage risk</p>
                <p className="mt-1 text-sm font-black text-[#17002F]">{String(dataQuality.leakage_risk ?? "—")}</p>
              </div>
              <div className="rounded-xl bg-[#F8F5FF] p-3">
                <p className="text-xs font-black uppercase text-[#7B688E]">Actual results available</p>
                <p className="mt-1 text-sm font-black text-[#17002F]">{String(backtestStatus.available_actual_results ?? "—")}</p>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {backtestRuns.length === 0 ? (
                <p className="text-sm font-semibold text-[#5D4A70]">No backtest runs recorded yet.</p>
              ) : (
                backtestRuns.map((run) => {
                  const mae = extractRunMae(run.summary);
                  return (
                    <div key={String(run.id)} className="flex flex-col gap-2 rounded-xl bg-[#F8F5FF] p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-black text-[#17002F]">
                          {String(run.backtest_type)} - GW{String(run.from_gw)}-{String(run.to_gw)}
                        </p>
                        <p className="truncate text-xs font-semibold text-[#7B688E]">
                          {String(run.model_version)} - {run.created_at ? new Date(String(run.created_at)).toLocaleString() : "unknown date"}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <p className="text-sm font-black text-[#6C1DFF]">MAE {mae != null ? mae.toFixed(3) : "—"}</p>
                        <span className={`rounded-full px-3 py-1 text-xs font-black ${run.status === "completed" ? "bg-[#00C853]/12 text-[#008B3A]" : "bg-[#FFB800]/12 text-[#8A6200]"}`}>
                          {String(run.status)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-[#111827] bg-[#070912] p-5 text-white shadow-[0_24px_60px_rgba(0,0,0,0.18)]">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#A7F3D0]">API alignment audit</p>
        <h2 className="mt-2 text-3xl font-black">Real routes vs UI adapters</h2>
        <div className="mt-5 grid gap-3">
          {apiAudit.map((entry) => (
            <div key={entry.feature} className="rounded-xl bg-white/8 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-black">{entry.feature}</p>
                <span className={`w-fit rounded-full px-3 py-1 text-xs font-black ${entry.status === "future-bff" ? "bg-[#FFB800]/15 text-[#FFB800]" : "bg-[#00E6A8]/15 text-[#A7F3D0]"}`}>
                  {entry.status}
                </span>
              </div>
              <p className="mt-2 text-sm font-semibold text-white/72">{entry.realEndpoint ?? entry.oldSpeculativeEndpoint}</p>
              <p className="mt-1 text-xs font-semibold leading-5 text-white/52">{entry.note}</p>
            </div>
          ))}
        </div>
        {futureBffTodos.length ? (
          <div className="mt-5 rounded-xl border border-[#FFB800]/30 bg-[#FFB800]/10 p-4">
            <p className="text-sm font-black text-[#FFB800]">Backend BFF TODO</p>
            <p className="mt-2 text-sm font-semibold text-white/72">{futureBffTodos.map((item) => item.feature).join(", ")}</p>
          </div>
        ) : null}
      </section>
    </AppShell>
  );
}
