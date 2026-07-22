import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/states";
import { FixturePill, formatPrice } from "@/components/fpl-ui";
import { PlayerVisual } from "@/components/player-visual";
import { loadWatchlistData } from "@/lib/use-command-centre";
import type { WatchlistItem } from "@/lib/types";

export const dynamic = "force-dynamic";

function WatchlistCard({ item }: { item: WatchlistItem }) {
  const tone =
    item.status === "Buy soon"
      ? "bg-[#00C853]/12 text-[#008B3A]"
      : item.status === "Avoid" || item.status === "Sell soon"
        ? "bg-[#E90052]/10 text-[#C80046]"
        : "bg-[#6C1DFF]/10 text-[#6C1DFF]";

  return (
    <article className="rounded-2xl border border-[#E8DEF8] bg-white p-4 shadow-[0_18px_45px_rgba(55,0,60,0.08)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <PlayerVisual player={item.player} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-lg font-black text-[#17002F]">{item.player.name}</p>
            <p className="text-sm font-bold text-[#5D4A70]">{item.player.team} / {item.player.position} / {formatPrice(item.player.price)}</p>
          </div>
        </div>
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

function Group({ title, items }: { title: string; items: WatchlistItem[] }) {
  return (
    <section>
      <h2 className="mb-4 text-2xl font-black text-[#17002F]">{title}</h2>
      {items.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => <WatchlistCard key={`${title}-${item.player.id}`} item={item} />)}
        </div>
      ) : (
        <EmptyState title={`No ${title.toLowerCase()} players`} body="Save a player from Market or Compare to start tracking this group." />
      )}
    </section>
  );
}

export default async function WatchlistPage() {
  const { appState, watchlist, usageState, dataSource } = await loadWatchlistData();
  const buySoon = watchlist.saved_players.filter((item) => item.status === "Buy soon");
  const monitor = watchlist.saved_players.filter((item) => item.status === "Monitor");
  const avoid = watchlist.saved_players.filter((item) => item.status === "Avoid");
  const sellSoon = watchlist.saved_players.filter((item) => item.status === "Sell soon");

  return (
    <AppShell title="Watchlist" eyebrow="Saved players and alerts" state={appState} dataSource={dataSource}>
      {!usageState.has_saved_plans ? (
        <section className="mb-6 rounded-2xl border border-[#111827] bg-[#070912] p-5 text-white shadow-[0_24px_60px_rgba(0,0,0,0.18)]">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#A7F3D0]">Retention feature</p>
          <h2 className="mt-2 text-3xl font-black">Saved plans unlock on Plus</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-white/70">Free users can preview saved players and alerts; Plus keeps persistent plans and full watchlist actions.</p>
        </section>
      ) : null}

      {watchlist.saved_players.length ? (
        <div className="space-y-8">
          <Group title="Buy soon" items={buySoon} />
          <Group title="Monitor" items={monitor} />
          <Group title="Sell soon" items={sellSoon} />
          <Group title="Avoid" items={avoid} />
        </div>
      ) : (
        <EmptyState title={watchlist.empty_state.title} body={watchlist.empty_state.body} />
      )}

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-[#E8DEF8] bg-white p-5 shadow-[0_18px_45px_rgba(55,0,60,0.08)]">
          <h2 className="text-2xl font-black text-[#17002F]">Fixture swing alerts</h2>
          <ul className="mt-4 space-y-3 text-sm font-semibold text-[#5D4A70]">
            {watchlist.fixture_swing_alerts.map((alert) => <li key={alert} className="rounded-xl bg-[#F8F5FF] p-3">- {alert}</li>)}
          </ul>
        </section>
        <section className="rounded-2xl border border-[#E8DEF8] bg-white p-5 shadow-[0_18px_45px_rgba(55,0,60,0.08)]">
          <h2 className="text-2xl font-black text-[#17002F]">Price and value alerts</h2>
          <ul className="mt-4 space-y-3 text-sm font-semibold text-[#5D4A70]">
            {watchlist.price_value_alerts.map((alert) => <li key={alert} className="rounded-xl bg-[#F8F5FF] p-3">- {alert}</li>)}
          </ul>
        </section>
      </div>
      <section className="mt-6 rounded-2xl border border-[#111827] bg-[#070912] p-5 text-white shadow-[0_24px_60px_rgba(0,0,0,0.18)]">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#A7F3D0]">Plus saved plan CTA</p>
        <h2 className="mt-2 text-2xl font-black">Save watchlist as next-GW plan</h2>
        <p className="mt-2 text-sm font-semibold text-white/70">Turn Buy soon, Monitor, Sell soon, and Avoid groups into a saved plan when persistence lands.</p>
        <button type="button" className="mt-4 rounded-xl bg-[#00E6A8] px-4 py-3 text-sm font-black text-[#05070D]">Save plan preview</button>
      </section>
    </AppShell>
  );
}
