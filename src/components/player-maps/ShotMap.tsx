"use client";

import { FootballPitch } from "@/components/player-maps/FootballPitch";
import type { PlayerShotMapResponse, ShotPoint } from "@/lib/api/playerMaps";

const OUTCOME_STYLE: Record<ShotPoint["outcome"], string> = {
  goal: "bg-[#00C853] border-white",
  saved: "bg-[#00B8FF] border-white/80",
  blocked: "bg-[#FFB800] border-white/70",
  off_target: "bg-[#E90052] border-white/70",
  unknown: "bg-white border-[#6C1DFF]",
};

export function ShotMap({ shotMap }: { shotMap: PlayerShotMapResponse }) {
  const hasRealShotCoordinates = shotMap.has_coordinate_data && shotMap.shots.length > 0;

  return (
    <div className="rounded-2xl border border-white/10 bg-[#070912] p-4 text-white">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#A7F3D0]">Shot Map</p>
          <h3 className="mt-1 text-xl font-black">{shotMap.summary.shots} shots</h3>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-black ${hasRealShotCoordinates ? "bg-[#E6F8EF] text-[#00974D]" : "bg-[#FFF4D7] text-[#B57700]"}`}>
          {hasRealShotCoordinates ? "Shot coordinates" : "Aggregate summary"}
        </span>
      </div>
      {hasRealShotCoordinates ? (
        <FootballPitch label={`${shotMap.player.web_name} shot map`}>
          {shotMap.shots.map((shot, index) => <ShotDot key={`${shot.fixture_id}-${shot.minute}-${index}`} shot={shot} />)}
        </FootballPitch>
      ) : (
        <div className="rounded-2xl border border-[#FFB800]/25 bg-[#FFB800]/10 p-4">
          <p className="text-sm font-black text-[#FFE7A0]">Shot map unavailable from current Sportmonks payload.</p>
          <p className="mt-2 text-xs font-semibold leading-5 text-white/64">
            No player-linked shot coordinates were found. Showing aggregate shooting summary only.
          </p>
        </div>
      )}
      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
        <ShotMetric label="Goals" value={String(shotMap.summary.goals)} />
        <ShotMetric label="xG" value={shotMap.summary.xg == null ? "n/a" : shotMap.summary.xg.toFixed(2)} />
        <ShotMetric label="Box rate" value={shotMap.summary.box_shot_rate == null ? "n/a" : `${Math.round(shotMap.summary.box_shot_rate * 100)}%`} />
      </div>
    </div>
  );
}

function ShotDot({ shot }: { shot: ShotPoint }) {
  const xg = shot.xg ?? 0.08;
  const size = Math.max(11, Math.min(28, 11 + xg * 38));
  return (
    <span
      title={`${shot.outcome}${shot.xg != null ? ` xG ${shot.xg}` : ""}${shot.minute ? ` ${shot.minute}'` : ""}`}
      className={`absolute rounded-full border-2 ${OUTCOME_STYLE[shot.outcome]} shadow-[0_0_22px_rgba(255,255,255,0.34)]`}
      style={{
        left: `${shot.x}%`,
        top: `${shot.y}%`,
        width: size,
        height: size,
        transform: "translate(-50%, -50%)",
      }}
    />
  );
}

function ShotMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/8 px-3 py-2">
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-white/48">{label}</p>
      <p className="mt-1 text-sm font-black text-white">{value}</p>
    </div>
  );
}
