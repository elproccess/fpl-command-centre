"use client";

import type { PlayerHeatmapResponse, PlayerShotMapResponse, RoleSummary } from "@/lib/api/playerMaps";

function pct(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "Unavailable";
  return `${Math.round(value * 100)}%`;
}

function numberText(value: number | null | undefined, suffix = "") {
  if (value == null || !Number.isFinite(value)) return "Unavailable";
  return `${value.toFixed(1)}${suffix}`;
}

function summarySentence(summary: RoleSummary, hasCoordinates: boolean) {
  if (!hasCoordinates) {
    return "Coordinate event data is not available for this player in the current data package. Showing role summary from aggregate stats instead.";
  }
  return `Role map trends ${summary.dominant_third} with a ${summary.dominant_side} bias and ${pct(summary.box_involvement_rate)} box involvement.`;
}

export function RoleMapSummary({ heatmap, shotMap }: { heatmap: PlayerHeatmapResponse; shotMap?: PlayerShotMapResponse | null }) {
  const summary = heatmap.role_summary;
  return (
    <div className="rounded-2xl border border-white/10 bg-white/8 p-4 text-white">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-[#A7F3D0]">Role Map Summary</p>
      <p className="mt-3 text-sm font-semibold leading-6 text-white/78">{summarySentence(summary, heatmap.has_coordinate_data)}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <MapMetric label="Dominant third" value={summary.dominant_third} />
        <MapMetric label="Dominant side" value={summary.dominant_side} />
        <MapMetric label="Average X" value={numberText(summary.average_x)} />
        <MapMetric label="Average Y" value={numberText(summary.average_y)} />
        <MapMetric label="Box involvement" value={pct(summary.box_involvement_rate)} />
        <MapMetric label="Advanced role score" value={numberText(summary.advanced_role_score)} />
        {shotMap ? <MapMetric label="Shots / xG" value={`${shotMap.summary.shots} / ${shotMap.summary.xg ?? "n/a"}`} /> : null}
        {shotMap ? <MapMetric label="Big chances" value={String(shotMap.summary.big_chance_count)} /> : null}
      </div>
    </div>
  );
}

function MapMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/8 px-3 py-2">
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-white/48">{label}</p>
      <p className="mt-1 text-sm font-black text-white">{value}</p>
    </div>
  );
}
