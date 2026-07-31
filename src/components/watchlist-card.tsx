"use client";

import { FixturePill, formatPrice } from "@/components/fpl-ui";
import { usePlayerDetail } from "@/components/player-detail-modal";
import { PlayerVisual } from "@/components/player-visual";
import type { WatchlistItem } from "@/lib/types";

// Split out of watchlist/page.tsx (a server component) so the "click a player to see the full
// stat card" behavior - which needs the client-only PlayerDetailProvider context from AppShell -
// has somewhere to live without forcing the whole page to become a client component.
export function WatchlistCard({ item }: { item: WatchlistItem }) {
  const { open } = usePlayerDetail();
  const tone =
    item.status === "Buy soon"
      ? "bg-[#00C853]/12 text-[#008B3A]"
      : item.status === "Avoid" || item.status === "Sell soon"
        ? "bg-[#E90052]/10 text-[#C80046]"
        : "bg-[#6C1DFF]/10 text-[#6C1DFF]";

  return (
    <article className="rounded-2xl border border-[#E8DEF8] bg-white p-4 shadow-[0_18px_45px_rgba(55,0,60,0.08)]">
      <div className="flex items-start justify-between gap-3">
        <button type="button" onClick={() => open(item.player)} className="flex min-w-0 items-center gap-3 text-left">
          <PlayerVisual player={item.player} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-lg font-black text-[#17002F]">{item.player.name}</p>
            <p className="text-sm font-bold text-[#5D4A70]">{item.player.team} / {item.player.position} / {formatPrice(item.player.price)}</p>
          </div>
        </button>
        <span className={`rounded-lg px-3 py-1 text-xs font-black ${tone}`}>{item.status}</span>
      </div>
      <p className="mt-4 text-sm font-semibold leading-6 text-[#5D4A70]">{item.reason}</p>
      <div className="mt-4 rounded-xl bg-[#F8F5FF] p-3">
        <p className="text-xs font-black uppercase tracking-[0.12em] text-[#7B688E]">Trigger</p>
        <p className="mt-1 text-sm font-black text-[#17002F]">{item.trigger}</p>
      </div>
      <div className="mt-4"><FixturePill fixture={item.player.fixture} difficulty={item.player.fixture_difficulty} /></div>
      <div className="mt-4 flex gap-2">
        <button type="button" className="flex-1 rounded-xl bg-[#6C1DFF] px-3 py-2 text-xs font-black text-white">Update group</button>
        <button type="button" className="flex-1 rounded-xl border border-[#E8DEF8] bg-white px-3 py-2 text-xs font-black text-[#37003C]">Remove</button>
      </div>
    </article>
  );
}
