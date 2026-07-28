import { AppShell } from "@/components/app-shell";
import { ImportTeamForm } from "@/components/import-team-form";
import { loadPricingData } from "@/lib/use-command-centre";

// The import POST route redirects back here with ?error=&status=&message= when the backend
// rejects an import. `message` is the raw backend body (often JSON) - pull the human detail out.
function backendDetail(message: string): string {
  try {
    const parsed = JSON.parse(message) as { detail?: unknown };
    if (typeof parsed.detail === "string") return parsed.detail;
  } catch {
    /* not JSON - use as-is */
  }
  return message;
}

function ImportErrorNotice({ error, status, message }: { error: string; status: string; message: string }) {
  if (!error) return null;

  const detail = backendDetail(message);

  // Pre-season: FPL has zero finished events until the GW1 deadline passes, so every real
  // team-ID import fails with this. It's expected, not broken - say so.
  if (/no finished fpl events/i.test(detail)) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-[#6C1DFF] bg-[#F5EFFF] p-5">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#6C1DFF]">Season not started yet</p>
        <h2 className="mt-2 text-lg font-black text-[#17002F]">Team imports open at the Gameweek 1 deadline</h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-[#3C2752]">
          The 2026/27 season hasn&apos;t kicked off, so FPL keeps every manager&apos;s squad private —
          there&apos;s nothing to import yet. Imports start working the moment the GW1 deadline passes
          (Friday 21 Aug, 18:30 UK). Until then, use the demo squad below to explore the full platform.
        </p>
      </div>
    );
  }

  if (status === "404") {
    return (
      <div className="rounded-2xl border border-[#F3D99C] bg-[#FFF9E8] p-5">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#9B6500]">Team not found</p>
        <h2 className="mt-2 text-lg font-black text-[#17002F]">That team ID doesn&apos;t exist yet</h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-[#705315]">
          FPL couldn&apos;t find a team with that ID. Entry IDs reset every season — check yours on
          fantasy.premierleague.com under Points (it&apos;s the number in the page URL).
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#E90052]/25 bg-[#E90052]/8 p-5">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#C80046]">Import failed</p>
      <h2 className="mt-2 text-lg font-black text-[#17002F]">That import didn&apos;t go through</h2>
      <p className="mt-2 text-sm font-semibold leading-6 text-[#8A0038]">
        {detail || "Something went wrong talking to the FPL API. Try again in a moment."}
      </p>
    </div>
  );
}

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const asString = (value: string | string[] | undefined) => (typeof value === "string" ? value : "");
  const { appState, dataSource } = loadPricingData();

  return (
    <AppShell title="Import team" eyebrow="Start here" state={appState} dataSource={dataSource}>
      <div className="space-y-5">
      <ImportErrorNotice error={asString(params.error)} status={asString(params.status)} message={asString(params.message)} />
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
      </div>
    </AppShell>
  );
}
