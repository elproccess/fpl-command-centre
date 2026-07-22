"use client";

import { FootballPitch } from "@/components/player-maps/FootballPitch";
import type { MapPoint, PlayerHeatmapResponse } from "@/lib/api/playerMaps";

const EVENT_STYLE: Record<MapPoint["event_type"], string> = {
  touch: "bg-[#00B8FF]",
  shot: "bg-[#E90052]",
  pass: "bg-[#00C853]",
  defensive_action: "bg-[#FFB800]",
};

export function PlayerHeatmap({ heatmap }: { heatmap: PlayerHeatmapResponse }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#070912] p-4 text-white">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#A7F3D0]">Heatmap</p>
          <h3 className="mt-1 text-xl font-black">Last {heatmap.matches_used.length || 5} matches</h3>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-black ${heatmap.has_coordinate_data ? "bg-[#E6F8EF] text-[#00974D]" : "bg-[#FFF4D7] text-[#B57700]"}`}>
          {heatmap.has_coordinate_data ? "Coordinate data" : "Aggregate fallback"}
        </span>
      </div>
      <FootballPitch label={`${heatmap.player.web_name} heatmap`}>
        {heatmap.has_coordinate_data ? (
          heatmap.points.map((point, index) => <HeatPoint key={`${point.fixture_id}-${point.minute}-${index}`} point={point} />)
        ) : (
          <FallbackOverlay />
        )}
      </FootballPitch>
      <div className="mt-4 flex flex-wrap gap-3 text-xs font-bold text-white/72">
        <Legend color="bg-[#00B8FF]" label="Touch" />
        <Legend color="bg-[#E90052]" label="Shot" />
        <Legend color="bg-[#00C853]" label="Pass" />
        <Legend color="bg-[#FFB800]" label="Defensive" />
      </div>
      {!heatmap.has_coordinate_data ? (
        <p className="mt-4 rounded-xl border border-[#FFB800]/25 bg-[#FFB800]/10 p-3 text-sm font-semibold leading-6 text-[#FFE7A0]">
          Coordinate event data is not available for this player in the current data package. Showing role summary from aggregate stats instead.
        </p>
      ) : null}
    </div>
  );
}

function HeatPoint({ point }: { point: MapPoint }) {
  const size = point.event_type === "shot" ? 14 : point.event_type === "defensive_action" ? 11 : 9;
  return (
    <span
      title={`${point.event_type}${point.minute ? ` ${point.minute}'` : ""}`}
      className={`absolute rounded-full ${EVENT_STYLE[point.event_type]} opacity-70 shadow-[0_0_18px_rgba(255,255,255,0.28)]`}
      style={{
        left: `${point.x}%`,
        top: `${point.y}%`,
        width: size,
        height: size,
        transform: "translate(-50%, -50%)",
      }}
    />
  );
}

function FallbackOverlay() {
  return (
    <div className="absolute inset-0 grid place-items-center bg-black/20 px-6 text-center">
      <div className="max-w-sm rounded-2xl border border-white/14 bg-[#070912]/86 p-5 backdrop-blur">
        <p className="text-sm font-black text-white">No coordinate points available</p>
        <p className="mt-2 text-xs font-semibold leading-5 text-white/64">This pitch is intentionally empty. No coordinates are being invented.</p>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      {label}
    </span>
  );
}
