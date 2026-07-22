import { AppShell } from "@/components/app-shell";
import { CompareTool } from "@/components/compare-tool";
import { RouteError } from "@/components/route-error";
import { loadCompareData } from "@/lib/use-command-centre";

export const dynamic = "force-dynamic";

function parsePlayerId(value: string | string[] | undefined): number | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export default async function ComparePage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = (await searchParams) ?? {};
  const a = parsePlayerId(params.a);
  const b = parsePlayerId(params.b);

  let data;
  try {
    data = await loadCompareData(a && b ? [a, b] : undefined);
  } catch (error) {
    return <RouteError title="Player Compare" route="/compare" error={error} />;
  }

  const { appState, comparison, players, usageState, dataSource } = data;

  return (
    <AppShell title="Player Compare" eyebrow="Make the better ownership decision" state={appState} dataSource={dataSource}>
      {!usageState.has_transfer_comparisons ? (
        <section className="mb-6 overflow-hidden rounded-[22px] border border-[#12182A] bg-[#080B16] p-5 text-white shadow-[0_24px_60px_rgba(0,0,0,0.20)]">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#A7F3D0]">Plus preview</p>
          <h2 className="mt-2 text-2xl font-black sm:text-3xl">Live head-to-head comparisons are limited on Free</h2>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-white/70">You can still inspect the featured comparison. Plus unlocks unrestricted pair selection, saved comparisons and deeper historical evidence.</p>
        </section>
      ) : null}

      <CompareTool initialComparison={comparison} players={players} />
    </AppShell>
  );
}