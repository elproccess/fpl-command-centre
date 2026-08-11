import { AppShell } from "@/components/app-shell";
import { ConfidenceBadge, RiskBadge } from "@/components/badges";
import { CreateAuditSnapshotPanel } from "@/components/create-audit-snapshot-panel";
import { RouteError } from "@/components/route-error";
import { loadReviewData } from "@/lib/use-command-centre";

export const dynamic = "force-dynamic";

function ReviewCard({ label, value }: { label: string; value: string }) {
  return (
    <section className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-5 shadow-[0_18px_45px_rgba(55,0,60,0.08)]">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--accent)]">{label}</p>
      <p className="mt-3 text-lg font-black leading-7 text-[var(--ink)]">{value}</p>
    </section>
  );
}

export default async function ReviewPage() {
  let data;
  try {
    data = await loadReviewData();
  } catch (error) {
    return <RouteError title="Last GW Review" route="/review" error={error} />;
  }
  const { appState, audit, dataSource } = data;
  const history = [
    { gw: "Last GW", label: audit.result, expected: "+4.4", actual: "+5.1", note: audit.last_gw_recommendation },
    { gw: "GW-2", label: "Neutral", expected: "+2.0", actual: "+0.4", note: "Held transfer for flexibility" },
    { gw: "GW-3", label: "Good call", expected: "+6.2", actual: "+8.0", note: "Captaincy edge landed" },
  ];

  return (
    <AppShell title="Last GW Review" eyebrow="Recommendation audit" state={appState} dataSource={dataSource}>
      <CreateAuditSnapshotPanel />

      <section className="rounded-2xl border border-[#111827] bg-[#070912] p-5 text-white shadow-[0_24px_60px_rgba(0,0,0,0.18)]">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#A7F3D0]">Audit result</p>
            <h2 className="mt-2 text-5xl font-black">{audit.result}</h2>
            <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-white/70">{audit.actual_outcome}</p>
          </div>
          <div className="flex gap-2"><ConfidenceBadge value={audit.confidence} /><RiskBadge value={audit.risk} /></div>
        </div>
      </section>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ReviewCard label="Last GW recommendation" value={audit.last_gw_recommendation} />
        <ReviewCard label="Actual outcome" value={audit.actual_outcome} />
        <ReviewCard label="Captain result" value={audit.captain_result} />
        <ReviewCard label="Transfer result" value={audit.transfer_result} />
      </div>

      <section className="mt-6 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-5 shadow-[0_18px_45px_rgba(55,0,60,0.08)]">
        <h2 className="text-2xl font-black text-[var(--ink)]">Recommendation history</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {history.map((item) => (
            <article key={item.gw} className="rounded-xl bg-[var(--surface-2)] p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-black text-[var(--accent)]">{item.gw}</p>
                <span className={`rounded-full px-3 py-1 text-xs font-black ${item.label === "Good call" ? "bg-[var(--success)]/12 text-[var(--success)]" : item.label === "Bad call" ? "bg-[var(--danger)]/10 text-[var(--danger)]" : "bg-[var(--warning)]/12 text-[var(--warning)]"}`}>{item.label}</span>
              </div>
              <p className="mt-3 text-sm font-black text-[var(--ink)]">{item.note}</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-[var(--surface)] p-3"><p className="text-xs font-black uppercase text-[var(--muted)]">Expected</p><p className="mt-1 text-xl font-black text-[var(--accent)]">{item.expected}</p></div>
                <div className="rounded-lg bg-[var(--surface)] p-3"><p className="text-xs font-black uppercase text-[var(--muted)]">Actual</p><p className="mt-1 text-xl font-black text-[var(--success)]">{item.actual}</p></div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-[1fr_0.8fr]">
        <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-5 shadow-[0_18px_45px_rgba(55,0,60,0.08)]">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--accent)]">Model note</p>
          <p className="mt-3 text-lg font-semibold leading-8 text-[var(--ink-soft)]">{audit.model_note}</p>
        </div>
        <div className="rounded-2xl border border-[var(--warning-border)] bg-[var(--warning-soft)] p-5">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--warning)]">What could go wrong?</p>
          <ul className="mt-3 space-y-2 text-sm font-semibold text-[var(--warning)]">
            {audit.what_could_go_wrong.map((item) => <li key={item}>- {item}</li>)}
          </ul>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-5 shadow-[0_18px_45px_rgba(55,0,60,0.08)]">
        <h2 className="text-2xl font-black text-[var(--ink)]">What we learned</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {audit.lessons_for_next_gw.map((lesson) => (
            <div key={lesson} className="rounded-xl bg-[var(--surface-2)] p-4 text-sm font-black leading-6 text-[var(--ink-soft)]">- {lesson}</div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
