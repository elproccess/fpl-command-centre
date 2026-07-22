import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { RefreshProjectionsPanel } from "@/components/refresh-projections-panel";
import { loadPricingData } from "@/lib/use-command-centre";

export default function SettingsPage() {
  const { appState, dataSource } = loadPricingData();
  const settings = [
    ["Team", appState.team_name],
    ["Team ID", appState.team_id_label],
    ["Subscription", appState.current_tier],
    ["Gameweek", appState.gameweek_label],
    ["Deadline", appState.deadline_label],
    ["Theme", "Premium command centre"],
  ];

  return (
    <AppShell title="Settings" eyebrow="Account and data preferences" state={appState} dataSource={dataSource}>
      <div className="grid gap-5 lg:grid-cols-2">
        {settings.map(([label, value]) => (
          <section key={label} className="rounded-2xl border border-[#E8DEF8] bg-white p-5 shadow-[0_18px_45px_rgba(55,0,60,0.08)]">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#7B688E]">{label}</p>
            <p className="mt-3 text-xl font-black text-[#17002F]">{value}</p>
          </section>
        ))}
      </div>

      <section className="mt-6 rounded-2xl border border-[#111827] bg-[#070912] p-5 text-white shadow-[0_24px_60px_rgba(0,0,0,0.18)]">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#A7F3D0]">Model trust</p>
        <h2 className="mt-2 text-2xl font-black">Why trust this?</h2>
        <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-white/70">Read the plain-English explanation of confidence, risk, fallback warnings, model comparison, and rollback safety.</p>
        <Link href="/trust" className="mt-5 inline-flex rounded-xl bg-[#00E6A8] px-4 py-3 text-sm font-black text-[#05070D]">
          Open trust page
        </Link>
      </section>

      <section className="mt-6 rounded-2xl border border-[#E8DEF8] bg-white p-5 shadow-[0_18px_45px_rgba(55,0,60,0.08)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.14em] text-[#6C1DFF]">Projection engine</p>
            <h2 className="text-2xl font-black text-[#17002F]">Model training pipeline</h2>
          </div>
          <Link href="/settings/models" className="rounded-xl bg-[#6C1DFF] px-4 py-3 text-sm font-black text-white">
            Open model training
          </Link>
        </div>
      </section>

      <RefreshProjectionsPanel />
    </AppShell>
  );
}
