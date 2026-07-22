import type { Player } from "@/lib/types";
import { Armband } from "./fpl-ui";
import { PlayerVisual } from "./player-visual";

function PlayerChip({ player, role, loading }: { player: Player; role?: "C" | "V"; loading?: boolean }) {
  // See PlayerCard's identical `loading` prop for why: right after import, the real per-player
  // projected/ownership numbers haven't resolved yet, and a confident "0.0 pts / 0% own" on a
  // real player reads exactly like broken/mock data. "…" is honest about still loading instead.
  // team_has_fixture === false is different and stable (not a loading state): the player's real
  // club has zero fixtures in the loaded calendar (e.g. relegated) - the 0 is real and final.
  const noFixtureData = !loading && player.team_has_fixture === false;
  return (
    <div className="relative w-full max-w-36 rounded-xl border border-white/55 bg-white/92 px-2.5 py-2 text-center shadow-[0_10px_22px_rgba(23,0,47,0.16)] backdrop-blur">
      {role ? <span className="absolute -right-2 -top-2"><Armband label={role} /></span> : null}
      <div className="mx-auto mb-1 flex justify-center">
        <PlayerVisual player={player} size="sm" preferPhoto={false} />
      </div>
      <p className="truncate text-xs font-black leading-tight text-[#17002F]">{player.name}</p>
      {noFixtureData ? (
        <p className="mt-1 text-[10px] font-bold text-[#B97800]">No fixture (not in league)</p>
      ) : (
        <div className="mt-1 flex items-center justify-center gap-1.5">
          <p className="text-[11px] font-black text-[#00A844]">{loading ? "…" : `${player.projected.toFixed(1)} pts`}</p>
          <p className="text-[10px] font-bold text-[#7B688E]">{loading ? "…" : `${player.ownership}% own`}</p>
        </div>
      )}
    </div>
  );
}

function FormationRow({ label, players, roles, loading }: { label: string; players: Player[]; roles: Record<number, "C" | "V">; loading?: boolean }) {
  if (!players.length) return null;
  // Column count matches this row's REAL player count (a 5-def or 5-mid formation gets 5
  // columns, not squeezed into a hardcoded 3/4/3 grid meant for 4-3-3) - inline style, not a
  // Tailwind grid-cols-N class, since the count is only known at render time and Tailwind can't
  // generate a class for an arbitrary runtime number without it being statically discoverable.
  const gridStyle = { gridTemplateColumns: `repeat(${players.length}, minmax(0, 1fr))` };
  return (
    <div>
      <div className="mx-auto grid max-w-[720px] justify-items-center gap-2" style={gridStyle}>
        {players.map((player) => <PlayerChip key={player.id} player={player} role={roles[player.id]} loading={loading} />)}
      </div>
      <p className="mt-1 text-center text-[10px] font-black uppercase tracking-[0.16em] text-white/70">{label}</p>
    </div>
  );
}

function BenchPlayer({ player, loading }: { player: Player; loading?: boolean }) {
  const noFixtureData = !loading && player.team_has_fixture === false;
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-lg border border-[#E8DEF8] bg-white px-2 py-2 shadow-sm">
      <PlayerVisual player={player} size="sm" preferPhoto={false} />
      <div className="min-w-0">
        <p className="truncate text-xs font-black text-[#17002F]">{player.name}</p>
        <p className="truncate text-[10px] font-bold text-[#5D4A70]">
          {player.position} / {noFixtureData ? "no fixture" : loading ? "…" : `${player.projected.toFixed(1)} pts`}
        </p>
      </div>
    </div>
  );
}

export function PitchView({
  players,
  teamName = "Imported XI",
  formation = "3-4-3",
  captainId,
  viceCaptainId,
  loading = false,
}: {
  players: Player[];
  teamName?: string;
  formation?: string;
  captainId?: number;
  viceCaptainId?: number;
  // True while the real per-player projected/ownership analysis is still resolving (e.g. right
  // after import) - see PlayerChip/PlayerCard's own `loading` prop docs.
  loading?: boolean;
}) {
  const roles: Record<number, "C" | "V"> = {};
  if (captainId) roles[captainId] = "C";
  if (viceCaptainId) roles[viceCaptainId] = "V";
  const starters = players.slice(0, 11);
  const bench = players.slice(11, 15);
  const gk = starters.filter((player) => player.position === "GK");
  const def = starters.filter((player) => player.position === "DEF");
  const mid = starters.filter((player) => player.position === "MID");
  const fwd = starters.filter((player) => player.position === "FWD");

  return (
    <section className="h-full rounded-2xl border border-[#E8DEF8] bg-white p-3 shadow-[0_18px_45px_rgba(55,0,60,0.08)] sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#6C1DFF]">Squad pitch</p>
          <h2 className="text-xl font-black text-[#17002F]">{teamName}</h2>
        </div>
        <span className="rounded-xl bg-[#F1E8FF] px-4 py-2 text-sm font-black text-[#6C1DFF]">{formation}</span>
      </div>
      <div className="relative overflow-hidden rounded-xl bg-[linear-gradient(90deg,rgba(255,255,255,0.08)_50%,transparent_50%),linear-gradient(#3CCB6F,#178340)] bg-[length:72px_100%,100%_100%] px-4 py-5">
        <div className="absolute inset-4 rounded-xl border-2 border-white/65" />
        <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/55" />
        <div className="absolute bottom-4 left-1/2 h-16 w-44 -translate-x-1/2 border-2 border-white/55" />
        <div className="absolute left-1/2 top-4 h-16 w-44 -translate-x-1/2 border-2 border-white/55" />
        <div className="relative grid min-h-[470px] content-between gap-3">
          <FormationRow label="GK" players={gk} roles={roles} loading={loading} />
          <FormationRow label="DEF" players={def} roles={roles} loading={loading} />
          <FormationRow label="MID" players={mid} roles={roles} loading={loading} />
          <FormationRow label="FWD" players={fwd} roles={roles} loading={loading} />
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {bench.map((player) => <BenchPlayer key={player.id} player={player} loading={loading} />)}
      </div>
    </section>
  );
}
