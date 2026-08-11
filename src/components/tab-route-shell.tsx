"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { useImportedPageContext, type ImportedPageContext } from "@/lib/use-imported-page-context";

function ImportRequiredState({ route }: { route: string }) {
  return (
    <section className="overflow-hidden rounded-[24px] border border-[var(--accent-border)] bg-[var(--surface)] shadow-[0_22px_60px_rgba(15,23,60,0.07)]">
      <div className="relative overflow-hidden border-b border-[var(--border-soft)] bg-[linear-gradient(135deg,var(--accent-soft)_0%,var(--surface)_62%,var(--success-soft)_100%)] px-5 py-7 sm:px-8 sm:py-9">
        <div className="pointer-events-none absolute -right-14 -top-16 h-52 w-52 rounded-full border-[34px] border-[var(--accent-border)]/70" />
        <div className="relative max-w-2xl">
          <span className="inline-flex rounded-full border border-[var(--accent-border)] bg-[var(--accent-soft)] px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[var(--accent)]">
            Team connection required
          </span>
          <h2 className="mt-4 text-3xl font-black tracking-[-0.035em] text-[var(--ink)] sm:text-4xl">Import your FPL team first</h2>
          <p className="mt-3 max-w-xl text-sm font-semibold leading-6 text-[var(--ink-soft)] sm:text-base">
            Connect your team once to unlock live squad data, projections, recommendations and saved planning context across every tab.
          </p>
        </div>
      </div>

      <div className="grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:items-center sm:p-7">
        <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-3)] p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--muted)]">Requested page</p>
          <p className="mt-2 text-base font-black text-[var(--ink)]">{route}</p>
          <p className="mt-1 text-xs font-semibold leading-5 text-[var(--muted)]">Your team state is missing, so this page cannot safely show personalised analysis yet.</p>
        </div>

        <Link
          href="/import"
          className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[var(--accent)] px-5 py-3 text-sm font-black text-white shadow-[0_14px_28px_rgba(108,29,255,0.22)] transition hover:-translate-y-0.5 hover:bg-[var(--accent-2)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-2)] focus:ring-offset-2"
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