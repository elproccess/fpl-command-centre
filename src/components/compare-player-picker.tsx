"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { PlayerDirectoryEntry } from "@/lib/api";
import type { Player } from "@/lib/types";
import { TeamShirtImage } from "./player-visual";

// Groups the full-league player directory by club so the picker reads as clubs with rosters,
// not one flat alphabetical wall of 800+ names. A club with zero entries left after search
// filtering simply never gets a Map key, so its section header disappears on its own - no
// separate "hide empty groups" step needed.
function groupByClub(directory: PlayerDirectoryEntry[], excludeId?: number) {
  const byClub = new Map<string, PlayerDirectoryEntry[]>();
  for (const entry of directory) {
    if (entry.player_id === excludeId) continue;
    const group = byClub.get(entry.team_short_name);
    if (group) group.push(entry);
    else byClub.set(entry.team_short_name, [entry]);
  }
  return [...byClub.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

// Shared panel content (club groups, dividers, shirt icons per row, live name search) - used
// by both ComparePlayerPicker (a fixed source player, pick who to compare against) and the
// standalone "Compare Any Two Players" section's independent Player A / Player B pickers. Kept
// as one piece so both stay visually/behaviorally identical instead of drifting apart.
export function GroupedPlayerDropdownPanel({
  headerText,
  directory,
  excludeId,
  searchQuery = "",
  onPick,
}: {
  headerText: string;
  directory: PlayerDirectoryEntry[];
  excludeId?: number;
  searchQuery?: string;
  onPick: (entry: PlayerDirectoryEntry) => void;
}) {
  const query = searchQuery.trim().toLowerCase();
  const filtered = useMemo(
    () => (query ? directory.filter((entry) => entry.web_name.toLowerCase().includes(query)) : directory),
    [directory, query],
  );
  const groups = useMemo(() => groupByClub(filtered, excludeId), [filtered, excludeId]);
  return (
    <div className="absolute right-0 top-full z-50 mt-2 max-h-80 w-72 overflow-y-auto rounded-xl border border-[#E8DEF8] bg-white p-2 shadow-[0_18px_45px_rgba(55,0,60,0.18)]">
      <p className="px-2 pb-2 pt-1 text-xs font-black text-[#17002F]">{headerText}</p>
      {groups.length === 0 ? <p className="px-2 py-3 text-sm font-semibold text-[#8B7A9B]">No players match &ldquo;{searchQuery}&rdquo;.</p> : null}
      {groups.map(([team, entries]) => (
        <div key={team} className="mb-2 border-t border-[#F1E8FF] pt-2 first:mt-0 first:border-0 first:pt-0">
          <p className="px-2 pb-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#8B7A9B]">{team}</p>
          {entries.map((entry) => (
            <button
              key={entry.player_id}
              type="button"
              onClick={() => onPick(entry)}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm font-bold text-[#17002F] hover:bg-[#F8F5FF]"
            >
              <span className="grid h-6 w-6 shrink-0 place-items-center">
                <TeamShirtImage team={entry.team_short_name} position={entry.position} size={66} className="h-full w-full object-contain" />
              </span>
              <span className="truncate">{entry.web_name}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

export function ComparePlayerPicker({ sourcePlayer, directory }: { sourcePlayer: Player; directory: PlayerDirectoryEntry[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();
  const sourceApiId = sourcePlayer.api_id ?? sourcePlayer.id;

  function pick(entry: PlayerDirectoryEntry) {
    setOpen(false);
    setQuery("");
    router.push(`/compare?a=${sourceApiId}&b=${entry.player_id}`);
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        placeholder="Compare with…"
        className="w-40 rounded-lg border border-[#6C1DFF] px-3 py-1.5 text-xs font-black text-[#6C1DFF] placeholder:text-[#6C1DFF]/60"
      />
      {open ? (
        <>
          <button
            type="button"
            aria-label="Close"
            onClick={() => {
              setOpen(false);
              setQuery("");
            }}
            className="fixed inset-0 z-40 cursor-default"
          />
          <GroupedPlayerDropdownPanel
            headerText={`Compare ${sourcePlayer.name} with…`}
            directory={directory}
            excludeId={sourceApiId}
            searchQuery={query}
            onPick={pick}
          />
        </>
      ) : null}
    </div>
  );
}
