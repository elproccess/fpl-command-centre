"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode, SVGProps } from "react";
import { PlayerDetailProvider } from "@/components/player-detail-modal";
import type { DataSourceStatus, UserGameState } from "@/lib/types";

const fallbackState: UserGameState = {
  manager_name: "Manager",
  // Deliberately blank, not a placeholder phrase - the avatar badge below runs this through
  // initials(), which reads any non-empty string as if it were a real team name (found live:
  // "Imported XI" produced the nonsensical-looking initials "IX" pre-import). Blank falls
  // through to initials()'s own "FC" default instead.
  team_name: "",
  team_id_label: "Connect team",
  gameweek: 1,
  gameweek_label: "GW1",
  deadline_label: "Next deadline",
  formation: "3-4-3",
  bank: 0,
  free_transfers: 1,
  current_tier: "Free",
};

type IconName =
  | "dashboard"
  | "team"
  | "transfers"
  | "scenarios"
  | "planner"
  | "captaincy"
  | "market"
  | "compare"
  | "watchlist"
  | "review"
  | "pricing"
  | "settings"
  | "more"
  | "search"
  | "upload";

type NavItem = {
  href: string;
  label: string;
  icon: IconName;
};

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/squad", label: "My Team", icon: "team" },
  { href: "/transfers", label: "Transfers", icon: "transfers" },
  { href: "/scenarios", label: "Scenarios", icon: "scenarios" },
  { href: "/planner", label: "Planner", icon: "planner" },
  { href: "/captaincy", label: "Captaincy", icon: "captaincy" },
  { href: "/market", label: "Market", icon: "market" },
  { href: "/compare", label: "Compare", icon: "compare" },
  { href: "/watchlist", label: "Watchlist", icon: "watchlist" },
  { href: "/review", label: "Review", icon: "review" },
  { href: "/pricing", label: "Pricing", icon: "pricing" },
  { href: "/settings", label: "Settings", icon: "settings" },
];

function initials(value: string) {
  return (
    value
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "FC"
  );
}

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Icon({ name, className = "h-5 w-5", ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  const paths: Record<IconName, ReactNode> = {
    dashboard: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.4" />
        <rect x="14" y="3" width="7" height="7" rx="1.4" />
        <rect x="3" y="14" width="7" height="7" rx="1.4" />
        <rect x="14" y="14" width="7" height="7" rx="1.4" />
      </>
    ),
    team: (
      <>
        <circle cx="9" cy="8" r="3" />
        <circle cx="17" cy="9" r="2.4" />
        <path d="M3.5 20c.6-4 2.5-6 5.5-6s4.9 2 5.5 6" />
        <path d="M14.5 15.5c3.3.2 5.2 1.7 6 4.5" />
      </>
    ),
    transfers: (
      <>
        <path d="M5 7h13" />
        <path d="m15 4 3 3-3 3" />
        <path d="M19 17H6" />
        <path d="m9 14-3 3 3 3" />
      </>
    ),
    scenarios: (
      <>
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="4" />
        <path d="M12 4v3M20 12h-3M12 20v-3M4 12h3" />
      </>
    ),
    planner: (
      <>
        <rect x="4" y="5" width="16" height="15" rx="2.5" />
        <path d="M8 3v4M16 3v4M4 10h16" />
        <path d="m9 15 2 2 4-5" />
      </>
    ),
    captaincy: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M15.5 9.2a4.2 4.2 0 1 0 0 5.6" />
      </>
    ),
    market: (
      <>
        <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" />
        <path d="m4 8 6-4 6 6 5-5" />
      </>
    ),
    compare: (
      <>
        <path d="M7 4v16M17 4v16" />
        <path d="m3 8 4-4 4 4M13 16l4 4 4-4" />
      </>
    ),
    watchlist: (
      <>
        <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2 7.5 14 3 9.6l6.2-.9L12 3Z" />
      </>
    ),
    review: (
      <>
        <path d="M6 3h9l3 3v15H6z" />
        <path d="M15 3v4h4M9 12h6M9 16h4" />
      </>
    ),
    pricing: (
      <>
        <path d="M12 2v20" />
        <path d="M17 6.5c-1-1.3-2.6-2-4.7-2-2.6 0-4.3 1.2-4.3 3s1.8 2.4 4.4 3c2.9.7 4.6 1.5 4.6 3.6 0 2.2-2 3.7-4.8 3.7-2.3 0-4.2-.8-5.4-2.3" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21h-4v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H3v-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V3h4v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9A1.7 1.7 0 0 0 21 10h.1v4H21a1.7 1.7 0 0 0-1.6 1Z" />
      </>
    ),
    more: (
      <>
        <circle cx="5" cy="12" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="19" cy="12" r="1.2" fill="currentColor" stroke="none" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    upload: (
      <>
        <path d="M12 16V4" />
        <path d="m7.5 8.5 4.5-4.5 4.5 4.5" />
        <path d="M5 14v5h14v-5" />
      </>
    ),
  };

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} {...common} {...props}>
      {paths[name]}
    </svg>
  );
}

// On mobile the page title lives here instead of in the scrollable page body - swaps the brand
// name for the current page's title (logo glyph still anchors the brand), so "where am I" costs
// zero extra width instead of a second header row squeezed onto an already-tight screen.
function BrandMark({ compact = false, title }: { compact?: boolean; title?: string }) {
  return (
    <Link href="/dashboard" className="group flex min-w-0 items-center gap-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent)]">
      {/* Brand mark gradient stays fixed purple in both themes - it's the logo, not themed UI. */}
      <span className={`grid shrink-0 place-items-center rounded-xl bg-[linear-gradient(145deg,#7C2CFF,#5A17E8)] font-black text-white shadow-[0_12px_28px_rgba(108,29,255,0.25)] transition group-hover:-translate-y-0.5 ${compact ? "h-10 w-10 text-lg" : "h-11 w-11 text-xl"}`}>
        M
      </span>
      <span className="min-w-0">
        <span className={`block truncate font-black tracking-[-0.025em] text-[var(--ink)] ${compact ? "text-base" : "text-lg"}`}>{title || "Matchday OS"}</span>
        <span className="block truncate text-[11px] font-bold text-[var(--muted)]">{title ? "Matchday OS" : "FPL command layer"}</span>
      </span>
    </Link>
  );
}

function NavLink({ href, label, icon, compact = false }: NavItem & { compact?: boolean }) {
  const pathname = usePathname();
  const active = isActive(pathname, href);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`group flex min-w-0 items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-black transition focus:outline-none focus:ring-2 focus:ring-[var(--accent)] ${
        active
          ? "border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent)] shadow-[0_10px_24px_rgba(108,29,255,0.10)]"
          : "border-transparent text-[var(--muted)] hover:border-[var(--border)] hover:bg-[var(--surface-3)] hover:text-[var(--ink)]"
      } ${compact ? "justify-center px-2" : ""}`}
    >
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg transition ${active ? "bg-[var(--accent)] text-white" : "bg-[var(--surface-3)] text-[var(--muted)] group-hover:bg-[var(--surface)]"}`}>
        <Icon name={icon} className="h-4.5 w-4.5" />
      </span>
      {!compact ? <span className="truncate">{label}</span> : null}
    </Link>
  );
}

export function DataModeBadge({ source }: { source?: DataSourceStatus }) {
  if (!source) return null;

  const tone =
    source.mode === "real"
      ? "border-[var(--success-border)] bg-[var(--success-soft)] text-[var(--success)]"
      : source.mode === "unavailable"
        ? "border-[var(--danger-border)] bg-[var(--danger-soft)] text-[var(--danger)]"
        : source.mode === "future"
          ? "border-[var(--info-border)] bg-[var(--info-soft)] text-[var(--info)]"
          : "border-[var(--warning-border)] bg-[var(--warning-soft)] text-[var(--warning)]";

  return (
    <div className={`inline-flex min-h-9 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-black ${tone}`} title={source.detail ?? source.endpoint ?? source.label}>
      <span className="h-2 w-2 rounded-full bg-current opacity-80" />
      <span className="truncate">{source.label}</span>
    </div>
  );
}

export function Sidebar({ state = fallbackState }: { state?: UserGameState }) {
  return (
    <aside className="hidden w-[276px] shrink-0 border-r border-[var(--border)] bg-[var(--surface)] px-4 py-5 shadow-[10px_0_35px_rgba(15,23,60,0.035)] lg:flex lg:flex-col">
      <BrandMark />

      <nav className="mt-7 space-y-1" aria-label="Primary navigation">
        {navItems.map((item) => (
          <NavLink key={item.href} {...item} />
        ))}
      </nav>

      <div className="mt-auto overflow-hidden rounded-2xl border border-[var(--accent-border)] bg-[linear-gradient(145deg,var(--accent-soft),var(--surface))] p-4 shadow-[0_16px_38px_rgba(108,29,255,0.08)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-[var(--ink)]">{state.gameweek_label}</p>
            <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-[var(--muted)]">{state.deadline_label}</p>
          </div>
          <span className="shrink-0 rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-[var(--accent)]">{state.current_tier}</span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3">
            <p className="text-xl font-black text-[var(--accent)]">{state.free_transfers}</p>
            <p className="mt-1 text-[9px] font-black uppercase tracking-[0.1em] text-[var(--muted)]">Free transfers</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3">
            <p className="text-xl font-black text-[var(--ink)]">£{state.bank.toFixed(1)}m</p>
            <p className="mt-1 text-[9px] font-black uppercase tracking-[0.1em] text-[var(--muted)]">Bank</p>
          </div>
        </div>

        <Link href="/planner" className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-black text-white shadow-[0_12px_24px_rgba(108,29,255,0.22)] transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2">
          <Icon name="planner" className="h-4 w-4" />
          View plan
        </Link>
      </div>
    </aside>
  );
}

function MobileTab({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const active = isActive(pathname, item.href);

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-[54px] min-w-0 flex-col items-center justify-center rounded-xl border px-1.5 py-2 text-center transition focus:outline-none focus:ring-2 focus:ring-[var(--accent)] ${
        active
          ? "border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent)] shadow-[0_8px_20px_rgba(108,29,255,0.10)]"
          : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]"
      }`}
    >
      <Icon name={item.icon} className="h-[18px] w-[18px]" />
      <span className="mt-1 max-w-full truncate text-[10px] font-black sm:text-[11px]">{item.label}</span>
    </Link>
  );
}

export function TopNav({ title, state = fallbackState }: { title?: string; state?: UserGameState; dataSource?: DataSourceStatus }) {
  const pathname = usePathname();
  const onImportPage = pathname === "/import";
  const primaryMobile = navItems.slice(0, 4);
  const moreMobile = navItems.slice(4);
  const moreActive = moreMobile.some((item) => isActive(pathname, item.href));

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--surface-translucent)] px-3 py-3 shadow-[0_8px_28px_rgba(15,23,60,0.045)] backdrop-blur-xl sm:px-4 md:px-6">
      <div className="mx-auto max-w-[1540px]">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 lg:hidden">
            <BrandMark compact title={title} />
          </div>
          <h1 className="hidden min-w-0 truncate text-lg font-black tracking-[-0.01em] text-[var(--ink)] lg:block">{title}</h1>

          <div className="flex items-center gap-2 lg:hidden">
            {!onImportPage ? (
              <Link
                href="/import"
                aria-label="Import team"
                title="Import team"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent)] transition hover:opacity-90"
              >
                <Icon name="upload" className="h-4.5 w-4.5" />
              </Link>
            ) : null}
            <span className="rounded-xl border border-[var(--accent-border)] bg-[var(--accent-soft)] px-3 py-2 text-xs font-black text-[var(--ink)]">{state.gameweek_label}</span>
            <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--accent)] text-xs font-black text-white shadow-[0_10px_22px_rgba(108,29,255,0.18)]">{initials(state.team_name)}</span>
          </div>

          <div className="hidden min-w-0 flex-1 items-center justify-end gap-3 lg:flex">
            <div className="relative w-full max-w-sm">
              <Icon name="search" className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-[var(--muted)]" />
              <input
                aria-label="Search players and teams"
                placeholder="Search players or clubs"
                className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-3)] pl-11 pr-4 text-sm font-semibold text-[var(--ink)] outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:bg-[var(--surface)] focus:ring-4 focus:ring-[var(--accent)]/8"
              />
            </div>
            {!onImportPage ? (
              <Link
                href="/import"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm font-black text-[var(--ink)] transition hover:border-[var(--accent-border)] hover:bg-[var(--accent-soft)]"
              >
                <Icon name="upload" className="h-4 w-4 text-[var(--accent)]" />
                Import
              </Link>
            ) : null}
            <span className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm font-black text-[var(--ink)]">{state.gameweek_label}</span>
            <div className="grid h-10 w-10 place-items-center rounded-full bg-[var(--accent)] text-xs font-black text-white">{initials(state.team_name)}</div>
          </div>
        </div>

        <nav className="mt-3 grid grid-cols-5 gap-2 lg:hidden" aria-label="Mobile navigation">
          {primaryMobile.map((item) => (
            <MobileTab key={item.href} item={item} />
          ))}

          <details className="group relative">
            <summary
              className={`flex min-h-[54px] cursor-pointer list-none flex-col items-center justify-center rounded-xl border px-1.5 py-2 text-center transition focus:outline-none focus:ring-2 focus:ring-[var(--accent)] ${
                moreActive
                  ? "border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent)] shadow-[0_8px_20px_rgba(108,29,255,0.10)]"
                  : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]"
              }`}
            >
              <Icon name="more" className="h-[18px] w-[18px]" />
              <span className="mt-1 text-[10px] font-black sm:text-[11px]">More</span>
            </summary>
            <div className="absolute right-0 top-[62px] z-50 w-[min(86vw,330px)] rounded-2xl border border-[var(--accent-border)] bg-[var(--surface)] p-3 shadow-[0_24px_70px_rgba(15,23,60,0.18)]">
              <div className="mb-2 flex items-center justify-between px-1">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--muted)]">More tools</p>
                <span className="rounded-full bg-[var(--accent-soft)] px-2 py-1 text-[9px] font-black text-[var(--accent)]">{moreMobile.length}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {moreMobile.map((item) => {
                  const active = isActive(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex min-w-0 items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-black transition ${
                        active ? "border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--border)] bg-[var(--surface-3)] text-[var(--ink)] hover:bg-[var(--surface)]"
                      }`}
                    >
                      <Icon name={item.icon} className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </details>
        </nav>
      </div>
    </header>
  );
}

export function AppShell({
  children,
  title,
  state = fallbackState,
  dataSource,
}: {
  children: ReactNode;
  title: string;
  eyebrow?: string;
  state?: UserGameState;
  dataSource?: DataSourceStatus;
}) {
  return (
    <PlayerDetailProvider>
      <div className="min-h-screen bg-[var(--surface-2)] text-[var(--ink)]">
        <div className="flex min-h-screen">
          <Sidebar state={state} />

          <main className="min-w-0 flex-1 overflow-x-hidden">
            <TopNav title={title} state={state} dataSource={dataSource} />

            <div className="mx-auto max-w-[1540px] px-3 py-5 sm:px-4 md:px-7 md:py-7 xl:px-9 xl:py-9">

              {children}
            </div>
          </main>
        </div>
      </div>
    </PlayerDetailProvider>
  );
}