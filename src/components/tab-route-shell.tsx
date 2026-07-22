"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { useImportedPageContext, type ImportedPageContext } from "@/lib/use-imported-page-context";

function ImportRequiredState({ route }: { route: string }) {
  return (
    <section className="overflow-hidden rounded-[24px] border border-[#DDD3F5] bg-white shadow-[0_22px_60px_rgba(15,23,60,0.07)]">
      <div className="relative overflow-hidden border-b border-[#E6E9F0] bg-[linear-gradient(135deg,#F8F4FF_0%,#FFFFFF_62%,#EFFCF6_100%)] px-5 py-7 sm:px-8 sm:py-9">
        <div className="pointer-events-none absolute -right-14 -top-16 h-52 w-52 rounded-full border-[34px] border-[#EEE6FF]/70" />
        <div className="relative max-w-2xl">
          <span className="inline-flex rounded-full border border-[#D1BEFF] bg-[#F2ECFF] px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#6C1DFF]">
            Team connection required
          </span>
          <h2 className="mt-4 text-3xl font-black tracking-[-0.035em] text-[#080D2B] sm:text-4xl">Import your FPL team first</h2>
          <p className="mt-3 max-w-xl text-sm font-semibold leading-6 text-[#5D6684] sm:text-base">
            Connect your team once to unlock live squad data, projections, recommendations and saved planning context across every tab.
          </p>
        </div>
      </div>

      <div className="grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:items-center sm:p-7">
        <div className="rounded-2xl border border-[#E4E8F0] bg-[#FAFBFD] p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#858CA3]">Requested page</p>
          <p className="mt-2 text-base font-black text-[#11183C]">{route}</p>
          <p className="mt-1 text-xs font-semibold leading-5 text-[#6B7390]">Your team state is missing, so this page cannot safely show personalised analysis yet.</p>
        </div>

        <Link
          href="/import"
          className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#6C1DFF] px-5 py-3 text-sm font-black text-white shadow-[0_14px_28px_rgba(108,29,255,0.22)] transition hover:-translate-y-0.5 hover:bg-[#5D14E6] focus:outline-none focus:ring-2 focus:ring-[#8D68FF] focus:ring-offset-2"
        >
          Import team
        </Link>
      </div>
    </section>
  );
}

/**
 * Shared shell for every imported-team route. The AppShell chrome remains mounted
 * between tab changes while only the tab-specific content resolves.
 */
export function TabRouteShell({
  title,
  eyebrow,
  route,
  children,
}: {
  title: string;
  eyebrow: string;
  route: string;
  children: (context: ImportedPageContext) => ReactNode;
}) {
  const state = useImportedPageContext();

  if (state.status === "missing") {
    return (
      <AppShell title={title} eyebrow="Import required">
        <ImportRequiredState route={route} />
      </AppShell>
    );
  }

  return (
    <AppShell title={title} eyebrow={eyebrow} state={state.context.appState} dataSource={state.context.importSource}>
      {children(state.context)}
    </AppShell>
  );
}