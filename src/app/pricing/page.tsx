import { AppShell } from "@/components/app-shell";
import { PricingCard } from "@/components/cards";
import { loadPricingData } from "@/lib/use-command-centre";

function GateCard({ title, tier, body, locked = false }: { title: string; tier: string; body: string; locked?: boolean }) {
  return (
    <article className={`rounded-2xl border p-5 shadow-[0_18px_45px_rgba(55,0,60,0.08)] ${locked ? "border-[#17002F] bg-[#17002F] text-white" : "border-[#E8DEF8] bg-white text-[#17002F]"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`text-xs font-black uppercase tracking-[0.16em] ${locked ? "text-[#A7F3D0]" : "text-[#6C1DFF]"}`}>{tier}</p>
          <h2 className="mt-2 text-xl font-black">{title}</h2>
        </div>
        {locked ? <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-white">Locked</span> : <span className="rounded-full bg-[#00C853]/12 px-3 py-1 text-xs font-black text-[#008B3A]">Open</span>}
      </div>
      <p className={`mt-3 text-sm font-semibold leading-6 ${locked ? "text-white/70" : "text-[#5D4A70]"}`}>{body}</p>
      <button type="button" className={`mt-4 rounded-xl px-4 py-3 text-sm font-black ${locked ? "bg-[#00E6A8] text-[#05070D]" : "bg-[#6C1DFF] text-white"}`}>
        {locked ? "Upgrade" : "Use feature"}
      </button>
    </article>
  );
}

export default function PricingPage() {
  const { appState, usageState, pricingTiers, dataSource } = loadPricingData();
  const scenarioRemaining = Math.max(0, usageState.scenario_checks_limit - usageState.scenario_checks_used);
  const roadmap = ["Live GW Centre", "Predicted Lineups / Team News", "Mini-League Chase Mode", "Chip Planner"];

  return (
    <AppShell title="Pricing" eyebrow="Free, Plus, Pro" state={appState} dataSource={dataSource}>
      <section className="mb-6 rounded-2xl border border-[#111827] bg-[#070912] p-5 text-white shadow-[0_24px_60px_rgba(0,0,0,0.18)]">
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-xl bg-white/8 p-4"><p className="text-xs font-black uppercase text-white/50">Current tier</p><p className="mt-2 text-3xl font-black text-[#00E6A8]">{usageState.current_tier}</p></div>
          <div className="rounded-xl bg-white/8 p-4"><p className="text-xs font-black uppercase text-white/50">Scenario checks</p><p className="mt-2 text-3xl font-black text-white">{scenarioRemaining}/{usageState.scenario_checks_limit}</p></div>
          <div className="rounded-xl bg-white/8 p-4"><p className="text-xs font-black uppercase text-white/50">Market signals</p><p className="mt-2 text-3xl font-black text-white">Top {usageState.market_signal_limit}</p></div>
          <div className="rounded-xl bg-white/8 p-4"><p className="text-xs font-black uppercase text-white/50">Planner</p><p className="mt-2 text-3xl font-black text-[#FFB800]">{usageState.has_full_planner ? "Full" : "3-GW preview"}</p></div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">{pricingTiers.map((tier) => <PricingCard key={tier.name} tier={tier} />)}</div>

      <section className="mt-8">
        <h2 className="mb-4 text-2xl font-black text-[#17002F]">Feature gates</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <GateCard title="Best move each GW" tier="Free" body="Core recommendation with why, risk, confidence, and downside." />
          <GateCard title="3 scenario checks" tier="Free" body="Test transfers, captains, bench switches, and hits before upgrading." />
          <GateCard title="Top 10 market signals" tier="Free" body="See the highest-priority buy, hold, sell, watch, and avoid signals." />
          <GateCard title="Unlimited scenarios" tier="Plus" body="Remove scenario usage limits for transfer and captaincy testing." locked />
          <GateCard title="Full market and compare" tier="Plus" body="Unlock full filters, player detail depth, transfer comparisons, and saved plans." locked />
          <GateCard title="5-GW and advanced audit" tier="Pro" body="Longer planning, differential finder, mini-league chase, and advanced confidence audit later." locked />
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-[#111827] bg-[#070912] p-5 text-white shadow-[0_24px_60px_rgba(0,0,0,0.18)]">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#A7F3D0]">Locked roadmap previews</p>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          {roadmap.map((item) => (
            <div key={item} className="rounded-xl border border-white/10 bg-white/8 p-4">
              <p className="text-sm font-black">{item}</p>
              <p className="mt-2 text-xs font-semibold text-white/58">Not part of beta core yet</p>
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
