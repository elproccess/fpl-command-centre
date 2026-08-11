import Image from "next/image";
import { DEMO_ENTRY_ID } from "@/lib/imported-team";

function HashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 9h14M5 15h14M10 4 8 20M16 4l-2 16" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M6 4.5v15l13-7.5-13-7.5Z" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function ImportTeamForm() {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] shadow-[0_18px_45px_rgba(55,0,60,0.08)]">
      <div className="relative overflow-hidden border-b border-[var(--border-soft)] bg-[linear-gradient(160deg,var(--accent-soft)_0%,var(--surface)_65%)] p-5">
        <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-[var(--accent)]/10 blur-2xl" aria-hidden="true" />
        <div className="relative flex items-center gap-3">
          {/* Deliberately fixed brand-mark gradient, matching BrandMark in app-shell.tsx - not theme-driven. */}
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[11px] bg-[linear-gradient(145deg,#7A3FFF,#5417C9)] text-[17px] font-black text-white shadow-[0_10px_22px_rgba(122,63,255,0.32)]">
            M
          </span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--accent)]">Step 1</p>
            <h2 className="text-[15px] font-black leading-tight text-[var(--ink)]">Connect your squad</h2>
          </div>
        </div>

        <div className="pointer-events-none absolute bottom-0 right-2 z-0 flex items-end gap-1 sm:right-4 sm:gap-1.5 lg:hidden" aria-hidden="true">
          <span className="relative h-11 w-8 sm:h-16 sm:w-11">
            <Image src="/players/amad.png" alt="" fill sizes="44px" className="object-contain object-bottom" />
          </span>
          <span className="relative h-11 w-8 sm:h-16 sm:w-11">
            <Image src="/players/reece-james.png" alt="" fill sizes="44px" className="object-contain object-bottom" />
          </span>
          <span className="relative h-11 w-8 sm:h-16 sm:w-11">
            <Image src="/players/martinelli.png" alt="" fill sizes="44px" className="object-contain object-bottom" style={{ transform: "scaleX(-1)" }} />
          </span>
        </div>
      </div>

      <div className="p-5">
        <form action="/api/import-team" method="post">
          <label htmlFor="team-id" className="text-sm font-black text-[var(--ink)]">
            FPL Team ID
          </label>

          <div className="relative mt-3">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]">
              <HashIcon />
            </span>
            <input
              id="team-id"
              name="team_id"
              inputMode="numeric"
              required
              placeholder="Enter your FPL Team ID"
              className="w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] py-3 pl-11 pr-4 font-semibold text-[var(--ink)] outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent)]/10"
            />
          </div>

          <button
            type="submit"
            className="group mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[linear-gradient(145deg,var(--accent),var(--accent-2))] px-4 py-3.5 font-black text-white shadow-[0_14px_30px_rgba(122,63,255,0.32)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(122,63,255,0.4)]"
          >
            Import team
            <span className="transition group-hover:translate-x-0.5">
              <ArrowIcon />
            </span>
          </button>
        </form>

        <div className="mt-5 rounded-xl border-2 border-dashed border-[var(--accent-border)] bg-[var(--accent-soft)] p-4">
          <form action="/api/import-team" method="post">
            <input type="hidden" name="team_id" value={DEMO_ENTRY_ID} />
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-[var(--accent)] bg-[var(--surface)] px-4 py-3 font-black text-[var(--accent)] transition hover:bg-[var(--accent-soft)]"
            >
              <PlayIcon />
              Try the demo squad
            </button>
          </form>
          <p className="mt-3 text-xs font-semibold leading-relaxed text-[var(--muted)]">
            No team ID needed — explores the full platform with a sample squad on real 2026/27
            fixtures and projections. Importing your own team opens once the Gameweek 1 deadline
            passes, because FPL keeps everyone&apos;s picks private until then.
          </p>
        </div>
      </div>
    </div>
  );
}
