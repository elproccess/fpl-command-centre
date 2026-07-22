"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PlayerDirectoryEntry } from "@/lib/api";
import { GroupedPlayerDropdownPanel } from "./compare-player-picker";
import { TeamShirtImage } from "./player-visual";

export function PlayerSlotPicker({
  label,
  selected,
  otherSelectedId,
  directory,
  onSelect,
}: {
  label: string;
  selected: PlayerDirectoryEntry | null;
  otherSelectedId?: number;
  directory: PlayerDirectoryEntry[];
  onSelect: (entry: PlayerDirectoryEntry) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  function openForSearch() {
    setQuery("");
    setOpen(true);
  }

  return (
    <div className="min-w-0">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-[#7B688E]">{label}</p>
      <div className="relative mt-2">
        {open ? (
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search players…"
            className="w-full rounded-xl border border-[#6C1DFF] bg-white px-4 py-3 text-sm font-semibold text-[#17002F] outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={openForSearch}
            className="flex w-full items-center gap-3 rounded-xl border border-[#E8DEF8] bg-white px-4 py-3 text-left"
          >
            {selected ? (
              <>
                <span className="grid h-8 w-8 shrink-0 place-items-center">
                  <TeamShirtImage team={selected.team_short_name} position={selected.position} size={66} className="h-full w-full object-contain" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-black text-[#17002F]">{selected.web_name}</span>
                  <span className="block text-xs font-bold text-[#5D4A70]">{selected.team_short_name} / {selected.position}</span>
                </span>
              </>
            ) : (
              <span className="flex-1 text-sm font-semibold text-[#8B7A9B]">Select a player…</span>
            )}
          </button>
        )}
        {open ? (
          <>
            <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="fixed inset-0 z-40 cursor-default" />
            <GroupedPlayerDropdownPanel
              headerText={`Pick ${label}`}
              directory={directory}
              excludeId={otherSelectedId}
              searchQuery={query}
              onPick={(entry) => {
                setOpen(false);
                setQuery("");
                onSelect(entry);
              }}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}

export function CompareAnyTwoPlayers({ directory }: { directory: PlayerDirectoryEntry[] }) {
  const router = useRouter();
  const [playerA, setPlayerA] = useState<PlayerDirectoryEntry | null>(null);
  const [playerB, setPlayerB] = useState<PlayerDirectoryEntry | null>(null);

  function handleCompare() {
    if (!playerA || !playerB) return;
    router.push(`/compare?a=${playerA.player_id}&b=${playerB.player_id}`);
  }

  return (
    <section className="rounded-2xl border border-[#E8DEF8] bg-white p-5 shadow-[0_18px_45px_rgba(55,0,60,0.08)]">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#6C1DFF]">Head-to-head</p>
      <h2 className="mt-1 text-2xl font-black text-[#17002F]">Compare Any Two Players</h2>
      <p className="mt-2 text-sm font-semibold text-[#5D4A70]">Pick any two players in the league, grouped by club, and jump straight into a full comparison.</p>

      <div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto_1fr_auto] md:items-end">
        <PlayerSlotPicker label="Player A" selected={playerA} otherSelectedId={playerB?.player_id} directory={directory} onSelect={setPlayerA} />
        <p className="hidden pb-3 text-center text-sm font-black text-[#8B7A9B] md:block">vs</p>
        <PlayerSlotPicker label="Player B" selected={playerB} otherSelectedId={playerA?.player_id} directory={directory} onSelect={setPlayerB} />
        <button
          type="button"
          onClick={handleCompare}
          disabled={!playerA || !playerB}
          className="rounded-xl bg-[#6C1DFF] px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          Compare
        </button>
      </div>
    </section>
  );
}
