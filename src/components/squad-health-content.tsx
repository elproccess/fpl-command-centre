"use client";

import { RiskBadge } from "@/components/badges";
import { DataModeBadge } from "@/components/app-shell";
import { NativeMetric } from "@/components/fpl-ui";
import { PlayerVisual } from "@/components/player-visual";
import { ErrorState } from "@/components/states";
import { getSquadHealthDiagnostics } from "@/lib/api";
import { StillComputingPanel, usePolledAnalysis } from "@/components/polled-analysis";
import type { SquadIssue } from "@/lib/types";

function IssueCard({ issue }: { issue: SquadIssue }) {
  return (
    <article className="rounded-2xl border border-[#E8DEF8] bg-white p-4 shadow-[0_18px_45px_rgba(55,0,60,0.08)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <PlayerVisual player={issue.affected_player} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-lg font-black text-[#17002F]">{issue.affected_player.name}</p>
            <p className="text-xs font-black uppercase tracking-[0.12em] text-[#6C1DFF]">{issue.category}</p>
          </div>
        </div>
        <RiskBadge value={issue.severity} />
      </div>
      <p className="mt-4 text-sm font-semibold leading-6 text-[#5D4A70]">{issue.reason}</p>
      <div className="mt-4 rounded-xl bg-[#F8F5FF] p-3">
        <p className="text-xs font-black uppercase tracking-[0.12em] text-[#7B688E]">Suggested action</p>
        <p className="mt-1 text-sm font-black text-[#17002F]">{issue.suggested_action}</p>
      </div>
    </article>
  );
}

function IssueSection({ title, issues }: { title: string; issues: SquadIssue[] }) {
  return (
    <section>
      <h2 className="mb-4 text-2xl font-black text-[#17002F]">{title}</h2>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {issues.map((issue) => <IssueCard key={issue.id} issue={issue} />)}
      </div>
    </section>
  );
}

export function SquadHealthContent({ payload }: { payload: Record<string, unknown> }) {
  const entryIdValue = payload.entry_id ?? payload.team_id;
  const entryId = entryIdValue == null ? null : String(entryIdValue);
  const gameweekValue = payload.gameweek ?? payload.start_gw;
  const gameweekNumber = typeof gameweekValue === "number" ? gameweekValue : Number(gameweekValue);
  const state = usePolledAnalysis(() => getSquadHealthDiagnostics(payload), [payload.entry_id], "squad-health-tab", {
    entryId,
    gameweek: Number.isFinite(gameweekNumber) ? gameweekNumber : undefined,
    analysisType: "squad_health",
  });

  if (state.phase !== "ready") {
    if (state.phase === "error") return <ErrorState message={state.message} />;
    return <StillComputingPanel phase={state.phase} elapsedMs={"elapsedMs" in state ? state.elapsedMs : undefined} label="Squad health analysis" />;
  }

  const diagnostics = state.data;

  return (
    <>
      <div className="mb-4 flex justify-end"><DataModeBadge source={{ mode: "real", label: "Real backend connected" }} /></div>
      <section className="rounded-2xl border border-[#111827] bg-[#070912] p-5 text-white shadow-[0_24px_60px_rgba(0,0,0,0.18)]">
        <div className="grid gap-5 lg:grid-cols-[0.75fr_1.25fr] lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#A7F3D0]">Squad Health score</p>
            <div className="mt-4 flex items-end gap-3">
              <p className="text-7xl font-black text-[#00E6A8]">{diagnostics.health.score ?? "—"}</p>
              <p className="pb-3 text-2xl font-black text-white/72">{diagnostics.health.grade}</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-white/8 p-4"><p className="text-xs font-black uppercase text-white/50">Minutes risk</p><p className="mt-2 text-3xl font-black text-[#FFB800]">{diagnostics.health.minutes_risk != null ? `${diagnostics.health.minutes_risk}%` : "—"}</p></div>
            <div className="rounded-xl bg-white/8 p-4"><p className="text-xs font-black uppercase text-white/50">Injury risk</p><p className="mt-2 text-3xl font-black text-[#FF4D8D]">{diagnostics.health.injury_risk != null ? `${diagnostics.health.injury_risk}%` : "—"}</p></div>
            <div className="rounded-xl bg-white/8 p-4"><p className="text-xs font-black uppercase text-white/50">Captaincy</p><p className="mt-2 text-3xl font-black text-[#00E6A8]">{diagnostics.captaincy_strength}</p></div>
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <NativeMetric label="Transfer pressure" value={diagnostics.transfer_pressure.level} tone={diagnostics.transfer_pressure.level === "High" ? "pink" : "amber"} />
        <NativeMetric label="Urgent issues" value={String(diagnostics.urgent_issues.length)} tone="pink" />
      </div>

      <div className="mt-8 space-y-8">
        <IssueSection title="Urgent issues" issues={diagnostics.urgent_issues} />
        <IssueSection title="Minutes risk list" issues={diagnostics.minutes_risk_list} />
        <IssueSection title="Injury and suspension risk" issues={diagnostics.injury_suspension_risk_list} />
        <IssueSection title="Fixture problem areas" issues={diagnostics.fixture_problem_areas} />
      </div>
    </>
  );
}
