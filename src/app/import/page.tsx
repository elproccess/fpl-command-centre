import Image from "next/image";
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
      <div className="rounded-2xl border-2 border-dashed border-[var(--accent)] bg-[var(--accent-soft)] p-5">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--accent)]">Season not started yet</p>
        <h2 className="mt-2 text-lg font-black text-[var(--ink)]">Team imports open at the Gameweek 1 deadline</h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ink-soft)]">
          The 2026/27 season hasn&apos;t kicked off, so FPL keeps every manager&apos;s squad private —
          there&apos;s nothing to import yet. Imports start working the moment the GW1 deadline passes
          (Friday 21 Aug, 18:30 UK). Until then, use the demo squad below to explore the full platform.
        </p>
      </div>
    );
  }

  if (status === "404") {
    return (
      <div className="rounded-2xl border border-[var(--warning-border)] bg-[var(--warning-soft)] p-5">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--warning)]">Team not found</p>
        <h2 className="mt-2 text-lg font-black text-[var(--ink)]">That team ID doesn&apos;t exist yet</h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-[var(--warning)]">
          FPL couldn&apos;t find a team with that ID. Entry IDs reset every season — check yours on
          fantasy.premierleague.com under Points (it&apos;s the number in the page URL).
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--danger)]/25 bg-[var(--danger)]/8 p-5">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--danger)]">Import failed</p>
      <h2 className="mt-2 text-lg font-black text-[var(--ink)]">That import didn&apos;t go through</h2>
      <p className="mt-2 text-sm font-semibold leading-6 text-[var(--danger)]">
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
      <div className="mx-auto max-w-[480px] space-y-5">
        <ImportErrorNotice error={asString(params.error)} status={asString(params.status)} message={asString(params.message)} />

        <div className="relative">
          <div className="pointer-events-none absolute -top-6 right-0 z-0 hidden h-[320px] w-[220px] translate-x-[65%] lg:block" aria-hidden="true">
            <Image
              src="/players/martinelli.png"
              alt=""
              fill
              sizes="220px"
              className="object-contain object-bottom"
              style={{ transform: "scaleX(-1)" }}
            />
          </div>
          <div className="pointer-events-none absolute -top-6 left-0 z-0 hidden h-[320px] w-[220px] -translate-x-[65%] lg:block" aria-hidden="true">
            <Image
              src="/players/reece-james.png"
              alt=""
              fill
              sizes="220px"
              className="object-contain object-bottom"
              style={{ transform: "scale(0.9)", transformOrigin: "bottom" }}
            />
          </div>
          <div className="relative z-[1]">
            <ImportTeamForm />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
