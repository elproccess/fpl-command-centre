import { AppShell } from "@/components/app-shell";
import { ImportTeamForm } from "@/components/import-team-form";
import { loadPricingData } from "@/lib/use-command-centre";

export default function ImportPage() {
  const { appState, dataSource } = loadPricingData();

  return (
    <AppShell title="Import team" eyebrow="Start here" state={appState} dataSource={dataSource}>
      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        <ImportTeamForm />
        <section className="rounded-2xl border border-[#E8DEF8] bg-white p-6 shadow-[0_18px_45px_rgba(55,0,60,0.08)]">
          <h2 className="text-2xl font-black text-[#17002F]">What happens next?</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {["Build your squad view", "Find the best move", "Compare your 3-GW plan"].map((item) => (
              <div key={item} className="rounded-xl border border-[#E8DEF8] bg-[#F8F5FF] p-4 text-sm font-bold text-[#3C2752]">{item}</div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
