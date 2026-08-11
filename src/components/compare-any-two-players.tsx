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
      <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--muted)]">{label}</p>
      <div className="relative mt-2">
        {open ? (
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search players…"
            className="w-full rounded-xl border border-[var(--accent)] bg-[var(--surface)] px-4 py-3 text-sm font-semibold text-[var(--ink)] outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={openForSearch}
            className="flex w-full items-center gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-3 text-left"
          >
            {selected ? (
              <>
                <span className="grid h-8 w-8 shrink-0 place-items-center">
                  <TeamShirtImage team={selected.team_short_name} position={selected.position} size={66} className="h-full w-full object-contain" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-black text-[var(--ink)]">{selected.web_name}</span>
                  <span className="block text-xs font-bold text-[var(--muted)]">{selected.team_short_name} / {selected.position}</span>
                </span>
              </>
            ) : (
              <span className="flex-1 text-sm font-semibold text-[var(--muted)]">Select a player…</span>
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
    <section className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-5 shadow-[0_18px_45px_rgba(55,0,60,0.08)]">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--accent)]">Head-to-head</p>
      <h2 className="mt-1 text-2xl font-black text-[var(--ink)]">Compare Any Two Players</h2>
      <p className="mt-2 text-sm font-semibold text-[var(--muted)]">Pick any two players in the league, grouped by club, and jump straight into a full comparison.</p>

      <div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto_1fr_auto] md:items-end">
        <PlayerSlotPicker label="Player A" selected={playerA} otherSelectedId={playerB?.player_id} directory={directory} onSelect={setPlayerA} />
        <p className="hidden pb-3 text-center text-sm font-black text-[var(--muted)] md:block">vs</p>
        <PlayerSlotPicker label="Player B" selected={playerB} otherSelectedId={playerA?.player_id} directory={directory} onSelect={setPlayerB} />
        <button
          type="button"
          onClick={handleCompare}
          disabled={!playerA || !playerB}
          className="rounded-xl bg-[var(--accent)] px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          Compare
        </button>
      </div>
    </section>
  );
}
