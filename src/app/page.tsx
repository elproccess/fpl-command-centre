"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

type IconName =
  | "arrow"
  | "captain"
  | "check"
  | "clock"
  | "compare"
  | "globe"
  | "health"
  | "import"
  | "layers"
  | "market"
  | "planner"
  | "review"
  | "scenario"
  | "shield"
  | "spark"
  | "team"
  | "transfer"
  | "trophy";

function Icon({
  name,
  className = "h-5 w-5",
}: {
  name: IconName;
  className?: string;
}) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  const paths: Record<IconName, ReactNode> = {
    arrow: (
      <>
        <path d="M5 12h14" />
        <path d="m14 7 5 5-5 5" />
      </>
    ),
    captain: (
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="M15.5 8.5a5 5 0 1 0 0 7" />
      </>
    ),
    check: <path d="m5 12 4 4 10-10" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.5V12l3 2" />
      </>
    ),
    globe: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M3.5 12h17" />
        <path d="M12 3.5c2.6 2.4 4 5.3 4 8.5s-1.4 6.1-4 8.5c-2.6-2.4-4-5.3-4-8.5s1.4-6.1 4-8.5Z" />
      </>
    ),
    layers: (
      <>
        <path d="m12 3 8 4.5-8 4.5-8-4.5L12 3Z" />
        <path d="m4 12 8 4.5 8-4.5" />
        <path d="m4 16.5 8 4.5 8-4.5" />
      </>
    ),
    trophy: (
      <>
        <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
        <path d="M7 5H4a3 3 0 0 0 3 5.5M17 5h3a3 3 0 0 1-3 5.5" />
        <path d="M12 14v3" />
        <path d="M8.5 20.5h7" />
        <path d="M9.5 17.5h5l.6 3h-6.2l.6-3Z" />
      </>
    ),
    compare: (
      <>
        <path d="M8 7H4l3-3" />
        <path d="M4 7c1.3-2.7 3.8-4 7.3-4" />
        <path d="M16 17h4l-3 3" />
        <path d="M20 17c-1.3 2.7-3.8 4-7.3 4" />
        <path d="M9 9h6v6H9z" />
      </>
    ),
    health: (
      <>
        <path d="M12 20s-7-3.9-7-9.8A4.2 4.2 0 0 1 12 7a4.2 4.2 0 0 1 7 3.2C19 16.1 12 20 12 20Z" />
        <path d="M8 12h2l1-2 2 4 1-2h2" />
      </>
    ),
    import: (
      <>
        <path d="M12 4v10" />
        <path d="m8 10 4 4 4-4" />
        <path d="M5 19h14" />
      </>
    ),
    market: (
      <>
        <path d="M4 18V9" />
        <path d="M10 18V5" />
        <path d="M16 18V12" />
        <path d="m3 7 5-4 4 3 8-4" />
      </>
    ),
    planner: (
      <>
        <rect x="4" y="5" width="16" height="15" rx="2" />
        <path d="M8 3v4M16 3v4M7.5 11h3M13.5 11h3M7.5 15h3M13.5 15h3" />
      </>
    ),
    review: (
      <>
        <path d="M5 4h14v16H5z" />
        <path d="M8 8h8M8 12h8M8 16h5" />
      </>
    ),
    scenario: (
      <>
        <circle cx="7" cy="7" r="3" />
        <circle cx="17" cy="17" r="3" />
        <path d="m9.2 9.2 5.6 5.6M15 6l3-3M6 18l-3 3" />
      </>
    ),
    shield: (
      <>
        <path d="M12 3 20 6v5c0 5.1-3.3 8.4-8 10-4.7-1.6-8-4.9-8-10V6l8-3Z" />
        <path d="m8.5 12 2.2 2.2 4.8-5" />
      </>
    ),
    spark: (
      <>
        <path d="m12 3 1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7L12 3Z" />
        <path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" />
      </>
    ),
    team: (
      <>
        <circle cx="8" cy="8" r="3" />
        <circle cx="17" cy="9" r="2.5" />
        <path d="M3 20c0-4 2-6 5-6s5 2 5 6" />
        <path d="M14 15c3.5-.5 6 1 6 5" />
      </>
    ),
    transfer: (
      <>
        <path d="M4 8h14" />
        <path d="m14 4 4 4-4 4" />
        <path d="M20 16H6" />
        <path d="m10 12-4 4 4 4" />
      </>
    ),
  };

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} {...common}>
      {paths[name]}
    </svg>
  );
}

const modules = [
  {
    icon: "team" as const,
    label: "Current squad",
    title: "My Team",
    copy: "Your actual XI, bench, captain, vice, bank, free transfers and squad health.",
    color: "bg-[#F4EEFF] text-[#6C1DFF]",
  },
  {
    icon: "transfer" as const,
    label: "Current decision",
    title: "Decision Centre",
    copy: "The strongest move now, the alternatives, and why one route wins.",
    color: "bg-[#E9FFF6] text-[#008D57]",
  },
  {
    icon: "scenario" as const,
    label: "Challenge the model",
    title: "Scenario Simulator",
    copy: "Test your own transfer or captaincy decision against the platform route.",
    color: "bg-[#FFF5DF] text-[#A46700]",
  },
  {
    icon: "planner" as const,
    label: "Future route",
    title: "Multi-GW Planner",
    copy: "See how the decision changes GW2, GW3, GW4 and GW5 before committing.",
    color: "bg-[#F4EEFF] text-[#6C1DFF]",
  },
  {
    icon: "captain" as const,
    label: "Armband decision",
    title: "Captaincy Centre",
    copy: "Projection, ceiling, safety, minutes and downside in one captaincy verdict.",
    color: "bg-[#E9FFF6] text-[#008D57]",
  },
  {
    icon: "market" as const,
    label: "Player movement",
    title: "Market",
    copy: "Track value, form, ownership, trends and squad-specific player alerts.",
    color: "bg-[#FFF0F6] text-[#C52759]",
  },
  {
    icon: "compare" as const,
    label: "Player evidence",
    title: "Compare",
    copy: "Put alternatives side by side without losing price, fixtures or projections.",
    color: "bg-[#EEF4FF] text-[#245EC7]",
  },
  {
    icon: "review" as const,
    label: "Close the loop",
    title: "Review",
    copy: "Understand what changed, what worked and what the next gameweek inherits.",
    color: "bg-[#F4EEFF] text-[#6C1DFF]",
  },
];

function Brand({ dark = true }: { dark?: boolean }) {
  return (
    <Link href="/" className="group flex min-w-0 items-center gap-3">
      <span className="relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-[14px] bg-[#6C1DFF] text-xl font-black text-white shadow-[0_14px_34px_rgba(108,29,255,0.34)]">
        <span className="absolute -right-3 -top-3 h-7 w-7 rounded-full bg-white/20" />
        <span className="relative">M</span>
      </span>
      <span className="min-w-0">
        <span className={`block truncate text-lg font-black tracking-[-0.025em] ${dark ? "text-white" : "text-[#17052D]"}`}>
          Matchday OS
        </span>
        <span className={`block truncate text-[11px] font-bold ${dark ? "text-white/45" : "text-[#81748B]"}`}>
          FPL decision operating system
        </span>
      </span>
    </Link>
  );
}

function ModuleExplorer() {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selected = modules[selectedIndex];

  return (
    <div className="mt-12 grid gap-5 lg:grid-cols-[minmax(0,.88fr)_minmax(340px,.42fr)]">
      <div className="grid gap-4 md:grid-cols-2">
        {modules.map((module, index) => {
          const active = selectedIndex === index;
          return (
            <button
              key={module.title}
              type="button"
              onClick={() => setSelectedIndex(index)}
              className={`group rounded-[22px] border bg-white p-5 text-left transition duration-300 ${
                active
                  ? "-translate-y-1 border-[#BFA8F5] shadow-[0_24px_58px_rgba(55,18,82,0.11)] ring-2 ring-[#6C1DFF]/8"
                  : "border-[#E7E0ED] shadow-[0_16px_42px_rgba(42,14,61,0.05)] hover:-translate-y-0.5 hover:border-[#CEB9FC]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <span className={`grid h-11 w-11 place-items-center rounded-[14px] ${module.color}`}>
                  <Icon name={module.icon} />
                </span>
                <span className="rounded-full bg-[#F8F5FB] px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.1em] text-[#8A7D93]">
                  {module.label}
                </span>
              </div>
              <h3 className="mt-5 text-xl font-black tracking-[-0.025em] text-[#17052D]">{module.title}</h3>
              <p className="mt-3 text-sm font-semibold leading-6 text-[#716579]">{module.copy}</p>
            </button>
          );
        })}
      </div>

      <aside className="h-fit rounded-[26px] border border-[#D7C7F5] bg-[linear-gradient(145deg,#FFFFFF_0%,#F1E8FF_100%)] p-6 shadow-[0_24px_65px_rgba(55,18,82,0.10)] lg:sticky lg:top-8">
        <span className={`grid h-12 w-12 place-items-center rounded-[16px] ${selected.color}`}>
          <Icon name={selected.icon} />
        </span>
        <p className="mt-6 text-[10px] font-black uppercase tracking-[0.15em] text-[#6C1DFF]">Selected module</p>
        <h3 className="mt-2 text-3xl font-black tracking-[-0.04em] text-[#17052D]">{selected.title}</h3>
        <p className="mt-4 text-sm font-semibold leading-7 text-[#6F6479]">{selected.copy}</p>

        <div className="mt-6 space-y-2.5">
          {[
            "Uses the same imported squad",
            "Inherits the current gameweek state",
            "Feeds the wider decision route",
          ].map((item) => (
            <div key={item} className="flex items-center gap-2.5 rounded-xl border border-[#E2D9ED] bg-white/72 px-3 py-2.5 text-xs font-black text-[#493653]">
              <span className="grid h-5 w-5 place-items-center rounded-full bg-[#E8FFF5] text-[#008D57]">
                <Icon name="check" className="h-3 w-3" />
              </span>
              {item}
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}

function OsLoopStep({
  index,
  icon,
  title,
  copy,
}: {
  index: string;
  icon: IconName;
  title: string;
  copy: string;
}) {
  return (
    <article className="relative border-l border-[#DCCFF0] pl-7">
      <span className="absolute -left-4 top-0 grid h-8 w-8 place-items-center rounded-full border-4 border-white bg-[#6C1DFF] text-[9px] font-black text-white shadow-[0_8px_18px_rgba(108,29,255,0.18)]">
        {index}
      </span>
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#F0E8FF] text-[#6C1DFF]">
        <Icon name={icon} />
      </span>
      <h3 className="mt-4 text-lg font-black text-[#17052D]">{title}</h3>
      <p className="mt-2 text-sm font-semibold leading-6 text-[#756A7D]">{copy}</p>
    </article>
  );
}

// The hero card counts down to the REAL next FPL deadline - 2026/27 GW1, confirmed against
// bootstrap-static (2026-08-21T17:30:00Z). Once that has passed the season is running weekly,
// so fall back to the next-Friday-18:30 heuristic rather than ever showing a stale or negative
// countdown between deploys.
const GW1_DEADLINE_UTC = Date.UTC(2026, 7, 21, 17, 30, 0);

function nextDeadline(): Date {
  if (Date.now() < GW1_DEADLINE_UTC) return new Date(GW1_DEADLINE_UTC);
  const now = new Date();
  const deadline = new Date(now);
  const dayOffset = (5 - now.getDay() + 7) % 7 || 7;
  deadline.setDate(now.getDate() + dayOffset);
  deadline.setHours(18, 30, 0, 0);
  return deadline;
}

function useCountdown(target: Date) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  return useMemo(() => {
    if (now === null) return { days: 0, hours: 0, minutes: 0, seconds: 0, ready: false };
    const diff = Math.max(0, target.getTime() - now);
    const days = Math.floor(diff / 86_400_000);
    const hours = Math.floor((diff % 86_400_000) / 3_600_000);
    const minutes = Math.floor((diff % 3_600_000) / 60_000);
    const seconds = Math.floor((diff % 60_000) / 1000);
    return { days, hours, minutes, seconds, ready: true };
  }, [now, target]);
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function shirtUrl(teamCode: number, isGk = false) {
  return `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${teamCode}${isGk ? "_1" : ""}-110.png`;
}

type HeroRoute = {
  label: string;
  isHold: boolean;
  outShirt: number;
  outName: string;
  outMeta: string;
  inShirt: number;
  inCode: number;
  inName: string;
  inMeta: string;
  gain: string;
  hit: number;
  conf: string;
  risk: "Low" | "Medium" | "High";
  pts: string;
  why: string;
  chipFixture: string;
  chipForm: string;
  chipMinutes: string;
};

type HeroPlay = {
  gw: string;
  capCode: number;
  capName: string;
  capMeta: string;
  capPts: string;
  vcName: string;
  vcPts: string;
  coverage: string;
  fallback: number;
  routes: HeroRoute[];
};

const heroPlays: HeroPlay[] = [
  {
    gw: "GW1",
    capCode: 223094, capName: "Haaland", capMeta: "MCI (H) - CHE", capPts: "9.8",
    vcName: "Saka", vcPts: "7.6",
    coverage: "15/15", fallback: 0,
    routes: [
      { label: "→ Watkins", isHold: false, outShirt: 43, outName: "Haaland", outMeta: "MCI - GBP15.5m", inShirt: 7, inCode: 106617, inName: "Watkins", inMeta: "AVL - GBP9.0m", gain: "+4.8", hit: 0, conf: "82%", risk: "Low", pts: "61.8", why: "Watkins has the stronger three-week fixture run while releasing GBP6.0m for GW3. Haaland remains the best captain this week.", chipFixture: "+2.1", chipForm: "+1.4", chipMinutes: "Secure" },
      { label: "Sell Saliba, buy Gvardiol", isHold: false, outShirt: 3, outName: "Saliba", outMeta: "ARS - GBP6.2m", inShirt: 43, inCode: 244723, inName: "Gvardiol", inMeta: "MCI - GBP6.0m", gain: "+2.2", hit: 0, conf: "68%", risk: "Medium", pts: "59.4", why: "Saliba's fixture is tougher than Gvardiol's this week.", chipFixture: "+1.0", chipForm: "+0.6", chipMinutes: "Secure" },
      { label: "Hold - no transfer", isHold: true, outShirt: 0, outName: "", outMeta: "", inShirt: 0, inCode: 0, inName: "", inMeta: "", gain: "+1.2", hit: 0, conf: "61%", risk: "Low", pts: "58.1", why: "No move clears the bar by enough to spend the free transfer yet.", chipFixture: "+0.3", chipForm: "+0.2", chipMinutes: "Secure" },
    ],
  },
  {
    gw: "GW2",
    capCode: 223094, capName: "Haaland", capMeta: "MCI (A) - BOU", capPts: "8.1",
    vcName: "Salah", vcPts: "6.9",
    coverage: "15/15", fallback: 0,
    routes: [
      { label: "→ Gvardiol", isHold: false, outShirt: 6, outName: "Porro", outMeta: "TOT - GBP5.5m", inShirt: 43, inCode: 244723, inName: "Gvardiol", inMeta: "MCI - GBP6.0m", gain: "+3.1", hit: 0, conf: "75%", risk: "Low", pts: "63.2", why: "Fixture swing favours clean sheets from GW2 onward.", chipFixture: "+1.8", chipForm: "+0.9", chipMinutes: "Secure" },
      { label: "Sell Saka, buy Palmer", isHold: false, outShirt: 3, outName: "Saka", outMeta: "ARS - GBP9.4m", inShirt: 8, inCode: 231747, inName: "Palmer", inMeta: "CHE - GBP10.8m", gain: "+1.8", hit: 0, conf: "70%", risk: "Medium", pts: "60.1", why: "Palmer's underlying numbers edge Saka's for this run.", chipFixture: "+0.9", chipForm: "+0.7", chipMinutes: "Secure" },
      { label: "Hold - no transfer", isHold: true, outShirt: 0, outName: "", outMeta: "", inShirt: 0, inCode: 0, inName: "", inMeta: "", gain: "+1.6", hit: 0, conf: "64%", risk: "Low", pts: "60.8", why: "Banking the transfer keeps flexibility for the bigger GW3 move.", chipFixture: "+0.4", chipForm: "+0.3", chipMinutes: "Secure" },
    ],
  },
  {
    gw: "GW3",
    capCode: 118748, capName: "Salah", capMeta: "LIV (H) - BRE", capPts: "10.4",
    vcName: "Haaland", vcPts: "8.5",
    coverage: "14/15", fallback: 1,
    routes: [
      { label: "→ Salah", isHold: false, outShirt: 8, outName: "Palmer", outMeta: "CHE - GBP10.8m", inShirt: 14, inCode: 118748, inName: "Salah", inMeta: "LIV - GBP14.5m", gain: "+2.9", hit: 4, conf: "79%", risk: "Medium", pts: "66.9", why: "Salah's ceiling overtakes Palmer's for this fixture, even after the hit.", chipFixture: "+1.6", chipForm: "+1.1", chipMinutes: "Secure" },
      { label: "Sell Fernandes, buy Palmer", isHold: false, outShirt: 1, outName: "Fernandes", outMeta: "MUN - GBP8.6m", inShirt: 8, inCode: 231747, inName: "Palmer", inMeta: "CHE - GBP10.8m", gain: "+2.1", hit: 0, conf: "73%", risk: "Low", pts: "64.0", why: "Free transfer covers this move without a hit.", chipFixture: "+0.8", chipForm: "+0.6", chipMinutes: "Secure" },
      { label: "Hold - no transfer", isHold: true, outShirt: 0, outName: "", outMeta: "", inShirt: 0, inCode: 0, inName: "", inMeta: "", gain: "+0.8", hit: 0, conf: "59%", risk: "Low", pts: "61.5", why: "Neither move clears the hit cost by a comfortable margin.", chipFixture: "+0.2", chipForm: "+0.1", chipMinutes: "Rotation risk" },
    ],
  },
];

function HeroTrendChart({ points, activeIndex }: { points: { gw: string; current: number; withMove: number }[]; activeIndex: number }) {
  const all = points.flatMap((p) => [p.current, p.withMove]);
  const min = Math.min(...all);
  const max = Math.max(...all);
  const pad = (max - min) * 0.35 || 4;
  const yMin = min - pad;
  const yMax = max + pad;
  const w = 216, h = 58, left = 10, right = 10, top = 13, bottom = 13;
  const xStep = (w - left - right) / (points.length - 1);
  const scaleY = (v: number) => top + (1 - (v - yMin) / (yMax - yMin)) * (h - top - bottom);
  const scaleX = (i: number) => left + i * xStep;
  const pathFor = (key: "current" | "withMove") => points.map((p, i) => `${i === 0 ? "M" : "L"}${scaleX(i)},${scaleY(p[key])}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h + 12}`} className="w-full" aria-hidden="true">
      <path d={pathFor("current")} fill="none" stroke="#5E7166" strokeWidth="1.75" strokeDasharray="3 3" />
      <path d={pathFor("withMove")} fill="none" stroke="#A67BFF" strokeWidth="2.25" />
      {points.map((p, i) => (
        <g key={p.gw}>
          <circle cx={scaleX(i)} cy={scaleY(p.current)} r="2" fill="#5E7166" />
          <circle cx={scaleX(i)} cy={scaleY(p.withMove)} r={i === activeIndex ? 3.2 : 2.6} fill="#A67BFF" />
          <text x={scaleX(i)} y={scaleY(p.withMove) - 5} textAnchor="middle" fontSize="6.5" fontWeight="900" fill="#A67BFF">{p.withMove.toFixed(1)}</text>
          <text x={scaleX(i)} y={h + 10} textAnchor="middle" fontSize="6" fontWeight="700" fill="#6F8175">{p.gw}</text>
        </g>
      ))}
    </svg>
  );
}

function HeroPlayerCard({ shirt, name, meta, tone }: { shirt: number; name: string; meta: string; tone: "out" | "in" }) {
  return (
    <div className={`flex-1 rounded-xl border p-2.5 text-center transition ${tone === "out" ? "border-[#3a2622]" : "border-[#1e3527]"} bg-[#1e3527]`}>
      <span className={`inline-block rounded-md px-1.5 py-0.5 text-[8px] font-black tracking-[0.08em] ${tone === "out" ? "bg-[#ff9f8f]/12 text-[#ff9f8f] border border-[#ff9f8f]/30" : "bg-[#7fe0ac]/12 text-[#7fe0ac] border border-[#7fe0ac]/30"}`}>
        {tone === "out" ? "OUT" : "IN"}
      </span>
      <span className="mx-auto mt-1.5 block h-9 w-9">
        <Image src={shirtUrl(shirt)} alt="" width={44} height={44} className="h-full w-full object-contain" style={{ filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.4))" }} />
      </span>
      <p className="mt-1.5 text-[11.5px] font-black text-[#F3EFE3]">{name}</p>
      <p className="mt-0.5 text-[9px] font-bold text-[#A9B8AB]">{meta}</p>
    </div>
  );
}

function HeroFaceArt({ code }: { code: number }) {
  const [broken, setBroken] = useState(false);
  return (
    <div className="pointer-events-none absolute -right-1 -top-9 z-[3] h-[118px] w-[92px] sm:-top-11 sm:h-[142px] sm:w-[108px]" aria-hidden="true">
      <span className="absolute bottom-3 right-1/2 h-16 w-16 translate-x-1/2 rounded-full bg-[#A67BFF]/25 blur-2xl" />
      {!broken ? (
        <Image
          src={`https://resources.premierleague.com/premierleague/photos/players/110x140/p${code}.png`}
          alt=""
          fill
          sizes="120px"
          className="object-contain object-bottom drop-shadow-[0_18px_20px_rgba(0,0,0,0.5)]"
          onError={() => setBroken(true)}
        />
      ) : null}
    </div>
  );
}

function HeroMiniPlayer({ shirt, isGk, name, proj, captain, muted }: { shirt: number; isGk?: boolean; name: string; proj: string; captain?: boolean; muted?: boolean }) {
  return (
    <div className={`relative text-center ${muted ? "opacity-60" : ""}`}>
      {captain ? (
        <span className="absolute -right-1 -top-1 z-10 grid h-[15px] w-[15px] place-items-center rounded-full border-[1.5px] border-[#16281D] bg-[#E8B23D] text-[9px] font-black text-[#1C1300]">
          C
        </span>
      ) : null}
      <span className="mx-auto block h-9 w-9" style={{ filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.4))" }}>
        <Image src={shirtUrl(shirt, isGk)} alt="" width={36} height={36} className="h-full w-full object-contain" />
      </span>
      <div className={`mx-auto mt-1 inline-block rounded-[5px] bg-[#0A140E]/72 px-1.5 py-0.5 ${muted ? "opacity-80" : ""}`}>
        <p className={`text-[8.5px] font-black leading-tight whitespace-nowrap ${muted ? "text-[#A9B8AB]" : "text-[#F3EFE3]"}`}>{name}</p>
        <p className="text-[7.5px] font-black leading-tight whitespace-nowrap text-[#7FE0AC]">{proj} pts</p>
      </div>
    </div>
  );
}

function NewHero() {
  const deadline = useMemo(() => nextDeadline(), []);
  const countdown = useCountdown(deadline);
  const [view, setView] = useState<"team" | "decision">("team");
  const [gwIndex, setGwIndex] = useState(0);
  const [altIndex, setAltIndex] = useState(0);
  const [swap, setSwap] = useState(false);
  const [confWidth, setConfWidth] = useState("0%");
  const [pillLabel, setPillLabel] = useState("Squad overview");
  const [focusStage, setFocusStage] = useState<string | null>(null);
  const autoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const carouselStepRef = useRef(0);
  const mockupRef = useRef<HTMLDivElement | null>(null);
  const outlookScrollRef = useRef<HTMLDivElement | null>(null);
  const play = heroPlays[gwIndex];
  const route = play.routes[altIndex];

  function goTo(nextView: "team" | "decision", nextGw?: number) {
    setSwap(true);
    setPillLabel(nextView === "team" ? "Squad overview" : "Live decision");
    setTimeout(() => {
      setView(nextView);
      if (typeof nextGw === "number") setGwIndex(nextGw);
      setAltIndex(0);
      setSwap(false);
    }, 220);
  }

  function handleTabClick(nextView: "team" | "decision", nextGw?: number) {
    if (autoTimerRef.current) {
      clearInterval(autoTimerRef.current);
      autoTimerRef.current = null;
    }
    goTo(nextView, nextGw);
  }

  function handleAltPick(nextAlt: number) {
    if (autoTimerRef.current) {
      clearInterval(autoTimerRef.current);
      autoTimerRef.current = null;
    }
    setAltIndex(nextAlt);
    if (window.innerWidth < 1024) {
      mockupRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  useEffect(() => {
    autoTimerRef.current = setInterval(() => {
      carouselStepRef.current = (carouselStepRef.current + 1) % (heroPlays.length + 1);
      const step = carouselStepRef.current;
      setAltIndex(0);
      if (step === 0) {
        setView("team");
        setPillLabel("Squad overview");
      } else {
        setGwIndex(step - 1);
        setView("decision");
        setPillLabel("Live decision");
      }
      setSwap(true);
      setTimeout(() => setSwap(false), 220);
    }, 4200);
    return () => {
      if (autoTimerRef.current) clearInterval(autoTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      const el = outlookScrollRef.current;
      if (!el || window.innerWidth >= 640) return;
      const cardWidth = el.firstElementChild instanceof HTMLElement ? el.firstElementChild.offsetWidth + 8 : el.clientWidth * 0.78;
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
      el.scrollTo({ left: atEnd ? 0 : el.scrollLeft + cardWidth, behavior: "smooth" });
    }, 3200);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setConfWidth("0%");
    const t = setTimeout(() => setConfWidth(route.conf), 40);
    return () => clearTimeout(t);
  }, [gwIndex, altIndex, view, route.conf]);


  return (
    <section className="relative overflow-hidden bg-[#101F17] pb-8 pt-3 text-[#F3EFE3] sm:pb-12 sm:pt-5">
      <div
        className="pointer-events-none absolute inset-0 z-0 select-none"
        aria-hidden="true"
        style={{
          backgroundImage:
            "radial-gradient(circle at 12% 15%, rgba(243,239,227,0.05), transparent 45%), radial-gradient(circle at 92% 85%, rgba(166,123,255,0.07), transparent 50%)",
        }}
      />

      <div className="relative z-[5] mx-auto w-full max-w-[1240px] px-4 sm:px-6 lg:px-8">
        <div className="relative z-[2] flex items-center justify-between border-b border-[#F3EFE3]/[0.16] pb-4">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-[9px] bg-[linear-gradient(145deg,#7A3FFF,#5417C9)] text-sm font-black text-white shadow-[0_10px_24px_rgba(122,63,255,0.35)]">
              M
            </span>
            <span className="text-[13.5px] font-black tracking-[-0.01em]">Matchday OS</span>
          </div>
          <div className="hidden items-center gap-5 sm:flex">
            <a href="#system" className="text-xs font-bold text-[#A9B8AB] hover:text-[#F3EFE3]">The system</a>
            <a href="#modules" className="text-xs font-bold text-[#A9B8AB] hover:text-[#F3EFE3]">Modules</a>
            <a href="#loop" className="text-xs font-bold text-[#A9B8AB] hover:text-[#F3EFE3]">How it works</a>
          </div>
          <Link href="/import" className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-[#7A3FFF] px-3.5 py-2 text-[11.5px] font-black text-white shadow-[0_12px_26px_rgba(122,63,255,0.3)] transition hover:-translate-y-0.5">
            Enter Beta
          </Link>
        </div>

        <div className="relative z-[2] grid gap-6 pt-6 lg:grid-cols-[0.67fr_1.5fr_0.67fr] lg:items-stretch lg:gap-4">
          <div className="flex h-full flex-col justify-start pt-1">
            <h1 className="text-[1.6rem] font-black leading-[1.06] tracking-[-0.03em] sm:text-[2rem]">
              Your squad becomes a <span className="text-[#A67BFF]">five-gameweek plan.</span>
            </h1>
            <p className="mt-2.5 max-w-[30ch] text-[12.5px] font-semibold leading-[1.55] text-[#A9B8AB]">
              Import your real XI and watch it turn into one decision &mdash; with the reasoning and the route shown, not hidden.
            </p>

            <div className="mt-5">
              <p className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.08em] text-[#5E7166]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#7FE0AC] shadow-[0_0_8px_rgba(127,224,172,0.7)]" />
                GW1 deadline in
              </p>
              <div className="flex items-baseline gap-1.5">
                <div className="text-center">
                  <span className="block text-[1.6rem] font-black tabular-nums leading-none">{countdown.ready ? countdown.days : "-"}</span>
                  <label className="mt-0.5 block text-[8.5px] font-black uppercase tracking-[0.08em] text-[#5E7166]">days</label>
                </div>
                <span className="-translate-y-1 text-[1.2rem] font-black text-[#5E7166]">:</span>
                <div className="text-center">
                  <span className="block text-[1.6rem] font-black tabular-nums leading-none">{countdown.ready ? pad2(countdown.hours) : "--"}</span>
                  <label className="mt-0.5 block text-[8.5px] font-black uppercase tracking-[0.08em] text-[#5E7166]">hours</label>
                </div>
                <span className="-translate-y-1 text-[1.2rem] font-black text-[#5E7166]">:</span>
                <div className="text-center">
                  <span className="block text-[1.6rem] font-black tabular-nums leading-none">{countdown.ready ? pad2(countdown.minutes) : "--"}</span>
                  <label className="mt-0.5 block text-[8.5px] font-black uppercase tracking-[0.08em] text-[#5E7166]">minutes</label>
                </div>
                <span className="-translate-y-1 text-[1.2rem] font-black text-[#5E7166]">:</span>
                <div className="text-center">
                  <span className="block text-[1.6rem] font-black tabular-nums leading-none text-[#7FE0AC]">{countdown.ready ? pad2(countdown.seconds) : "--"}</span>
                  <label className="mt-0.5 block text-[8.5px] font-black uppercase tracking-[0.08em] text-[#5E7166]">seconds</label>
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2.5">
              <Link href="/import" className="inline-flex items-center gap-1.5 rounded-[10px] bg-[#7A3FFF] px-4 py-2.5 text-[11.5px] font-black text-white shadow-[0_14px_30px_rgba(122,63,255,0.32)]">
                Run my squad now
              </Link>
              <a href="#system" className="inline-flex items-center gap-1.5 rounded-[10px] border border-dashed border-[#F3EFE3]/[0.16] px-3.5 py-2.5 text-[11.5px] font-black">
                See how it works
              </a>
            </div>
          </div>

          <div ref={mockupRef} className="min-w-0">
            <div className="relative rounded-2xl border border-[#F3EFE3]/10 bg-[#0A1610] p-2.5 shadow-[0_40px_100px_rgba(0,0,0,0.55)]">
              <div className="flex items-center gap-2 px-1.5 pb-2.5 pt-1">
                <span className="h-2 w-2 rounded-full bg-[#FF8A80]/80" />
                <span className="h-2 w-2 rounded-full bg-[#FFD479]/80" />
                <span className="h-2 w-2 rounded-full bg-[#8CE8AB]/80" />
                <span className="ml-1.5 h-[18px] flex-1 rounded-md bg-[#F3EFE3]/[0.06]" />
              </div>

              <div className="relative overflow-hidden rounded-xl bg-[#182B1F] p-4">
                <div className="flex flex-wrap items-start justify-between gap-2.5">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[#7FE0AC]/30 bg-[#7FE0AC]/10 px-2.5 py-1 text-[10.5px] font-black text-[#7FE0AC]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#7FE0AC]" style={{ animation: "heroPillPulse 1.8s ease-in-out infinite" }} />
                    {pillLabel}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleTabClick("team")}
                      className={`rounded-lg border px-2.5 py-1.5 text-[10.5px] font-black transition ${view === "team" ? "border-transparent bg-[#B394FF] text-[#101F17]" : "border-[#F3EFE3]/[0.14] bg-[#1E3527] text-[#F3EFE3]/70"}`}
                    >
                      My Team
                    </button>
                    {heroPlays.map((p, i) => (
                      <button
                        key={p.gw}
                        type="button"
                        onClick={() => handleTabClick("decision", i)}
                        className={`rounded-lg border px-2.5 py-1.5 text-[10.5px] font-black transition ${view === "decision" && gwIndex === i ? "border-transparent bg-[#B394FF] text-[#101F17]" : "border-[#F3EFE3]/[0.14] bg-[#1E3527] text-[#F3EFE3]/70"}`}
                      >
                        {p.gw}
                      </button>
                    ))}
                  </div>
                </div>

                <div className={`grid transition-all duration-200 ${swap ? "translate-y-1 opacity-0" : "translate-y-0 opacity-100"}`}>
                  <div className={`col-start-1 row-start-1 mt-3.5 ${view === "team" ? "visible" : "invisible"}`}>
                      <div className="flex gap-2">
                        <div className="flex-1 rounded-[10px] border border-[#F3EFE3]/[0.14] bg-[#1E3527] py-1.5 text-center">
                          <span className="block text-[13px] font-black tabular-nums">100.0m</span>
                          <span className="block text-[7.5px] font-black uppercase tracking-[0.05em] text-[#6F8175]">Squad value</span>
                        </div>
                        <div className="flex-1 rounded-[10px] border border-[#F3EFE3]/[0.14] bg-[#1E3527] py-1.5 text-center">
                          <span className="block text-[13px] font-black tabular-nums">0.4m</span>
                          <span className="block text-[7.5px] font-black uppercase tracking-[0.05em] text-[#6F8175]">Bank</span>
                        </div>
                        <div className="flex-1 rounded-[10px] border border-[#F3EFE3]/[0.14] bg-[#1E3527] py-1.5 text-center">
                          <span className="block text-[13px] font-black tabular-nums">1</span>
                          <span className="block text-[7.5px] font-black uppercase tracking-[0.05em] text-[#6F8175]">Free transfer</span>
                        </div>
                      </div>

                      <div
                        className="relative mt-2.5 flex min-h-[280px] flex-col justify-between gap-3 overflow-hidden rounded-[14px] border border-[#7FE0AC]/20 p-4 shadow-[inset_0_0_40px_rgba(0,0,0,0.35)] sm:min-h-[320px]"
                        style={{
                          backgroundImage:
                            "repeating-linear-gradient(180deg, rgba(255,255,255,0.025) 0 11%, transparent 11% 22%), linear-gradient(180deg, #1A3A24, #0E2015)",
                        }}
                      >
                        <div className="pointer-events-none absolute inset-2 rounded-md border border-[#F3EFE3]/[0.14]">
                          <span className="absolute left-0 right-0 top-1/2 h-px bg-[#F3EFE3]/[0.14]" />
                          <span className="absolute left-1/2 top-1/2 h-[70px] w-[70px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#F3EFE3]/[0.14]" />
                          <span className="absolute left-[28%] right-[28%] top-0 h-[15%] border border-t-0 border-[#F3EFE3]/[0.14]" />
                          <span className="absolute bottom-0 left-[28%] right-[28%] h-[15%] border border-b-0 border-[#F3EFE3]/[0.14]" />
                        </div>

                        <div className="relative z-[1] flex justify-evenly gap-1">
                          <HeroMiniPlayer shirt={43} name="Haaland" proj="9.8" captain />
                          <HeroMiniPlayer shirt={7} name="Watkins" proj="5.1" />
                          <HeroMiniPlayer shirt={14} name="Salah" proj="8.4" />
                        </div>
                        <div className="relative z-[1] flex justify-evenly gap-1">
                          <HeroMiniPlayer shirt={8} name="Palmer" proj="6.9" />
                          <HeroMiniPlayer shirt={3} name="Saka" proj="6.2" />
                          <HeroMiniPlayer shirt={1} name="Fernandes" proj="5.5" />
                        </div>
                        <div className="relative z-[1] flex justify-evenly gap-1">
                          <HeroMiniPlayer shirt={3} name="Saliba" proj="4.8" />
                          <HeroMiniPlayer shirt={43} name="Gvardiol" proj="5.0" />
                          <HeroMiniPlayer shirt={3} name="Gabriel" proj="4.6" />
                          <HeroMiniPlayer shirt={54} name="Robinson" proj="4.1" />
                        </div>
                        <div className="relative z-[1] flex justify-evenly gap-1">
                          <HeroMiniPlayer shirt={3} isGk name="Raya" proj="4.4" />
                        </div>
                      </div>

                      <div className="mt-2.5">
                        <p className="mb-1.5 text-[9px] font-black uppercase tracking-[0.06em] text-[#6F8175]">Bench</p>
                        <div className="flex justify-evenly gap-1 rounded-[10px] border border-dashed border-[#F3EFE3]/[0.14] bg-[#1E3527] px-1.5 py-2">
                          <HeroMiniPlayer shirt={94} isGk name="Kelleher" proj="3.8" muted />
                          <HeroMiniPlayer shirt={7} name="Mings" proj="2.1" muted />
                          <HeroMiniPlayer shirt={4} name="Barnes" proj="3.0" muted />
                          <HeroMiniPlayer shirt={6} name="Richarlison" proj="2.4" muted />
                        </div>
                      </div>
                    </div>

                  <div className={`col-start-1 row-start-1 ${view === "decision" ? "visible" : "invisible"} mt-3.5`}>
                      <div className="relative">
                        {!route.isHold ? <HeroFaceArt key={`${play.gw}-${altIndex}`} code={route.inCode} /> : null}
                        <div className="pr-[72px] sm:pr-[92px]">
                          <p className="text-[9px] font-black uppercase tracking-[0.1em] text-[#6F8175]">{play.gw} &middot; Decision Centre</p>
                          <h3 className={`mt-1 text-[17px] font-black leading-[1.08] tracking-[-0.02em] transition-colors ${focusStage === "diagnose" ? "text-[#B394FF]" : ""}`}>
                            {route.isHold ? (
                              "Bank the free transfer"
                            ) : (
                              <>
                                Replace {route.outName}
                                <span className="block text-[#A67BFF]">&rarr; {route.inName}</span>
                              </>
                            )}
                          </h3>
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <span className="rounded-full bg-[#7A3FFF] px-2 py-1 text-[8px] font-black uppercase tracking-[0.1em] text-white">{altIndex === 0 ? "Recommended" : "Alternative"}</span>
                            <span className="rounded-full border border-[#7FE0AC]/30 bg-[#7FE0AC]/10 px-2 py-1 text-[8px] font-black uppercase tracking-[0.1em] text-[#7FE0AC]">
                              {route.hit ? `-${route.hit} hit` : "No hit"}
                            </span>
                            <span
                              className={`rounded-full border px-2 py-1 text-[8px] font-black uppercase tracking-[0.1em] ${
                                route.risk === "Low"
                                  ? "border-[#7FE0AC]/30 bg-[#7FE0AC]/10 text-[#7FE0AC]"
                                  : route.risk === "Medium"
                                    ? "border-[#E8B23D]/30 bg-[#E8B23D]/10 text-[#E8B23D]"
                                    : "border-[#FF9F8F]/30 bg-[#FF9F8F]/10 text-[#FF9F8F]"
                              }`}
                            >
                              {route.risk} risk
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3.5 h-px bg-[#F3EFE3]/[0.12]" />

                      <p className="mt-3 text-[8.5px] font-black uppercase tracking-[0.1em] text-[#5E7166]">The move</p>
                      {route.isHold ? (
                        <div className={`mt-1.5 rounded-xl border border-dashed border-[#F3EFE3]/[0.16] bg-[#1E3527] p-3 text-center transition ${focusStage === "decide" ? "outline outline-2 outline-offset-4 outline-[#A67BFF]" : ""}`}>
                          <p className="text-[11px] font-black text-[#F3EFE3]">Squad stays as-is this week</p>
                          <p className="mt-0.5 text-[9px] font-bold text-[#A9B8AB]">The free transfer rolls over to next gameweek</p>
                        </div>
                      ) : (
                        <div className={`mt-1.5 flex items-center gap-2 rounded-xl p-0.5 transition ${focusStage === "decide" ? "outline outline-2 outline-offset-4 outline-[#A67BFF]" : ""}`}>
                          <HeroPlayerCard shirt={route.outShirt} name={route.outName} meta={route.outMeta} tone="out" />
                          <svg width="20" height="16" viewBox="0 0 34 16" className="shrink-0 text-[#B394FF]" aria-hidden="true">
                            <line x1="1" y1="8" x2="26" y2="8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="3 4" style={{ animation: "heroArrowCrawl 1.2s linear infinite" }} />
                            <path d="M22 3 L28 8 L22 13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          <HeroPlayerCard shirt={route.inShirt} name={route.inName} meta={route.inMeta} tone="in" />
                        </div>
                      )}

                      <p className="mt-3 text-[8.5px] font-black uppercase tracking-[0.1em] text-[#5E7166]">3-gameweek outlook</p>
                      <div ref={outlookScrollRef} className="-mx-4 mt-1.5 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 sm:pb-0">
                        <div className="w-[78%] shrink-0 snap-start rounded-xl border border-[#A67BFF]/20 bg-[#1E3527] p-2.5 sm:w-auto sm:shrink">
                          <p className="text-[7.5px] font-black uppercase tracking-[0.06em] text-[#A9B8AB]">Projection comparison</p>
                          <HeroTrendChart
                            points={heroPlays.map((p, i) => ({
                              gw: p.gw,
                              current: parseFloat(p.routes[2].pts),
                              withMove: i === gwIndex ? parseFloat(route.pts) : parseFloat(p.routes[0].pts),
                            }))}
                            activeIndex={gwIndex}
                          />
                          <div className="mt-0.5 flex items-center justify-between text-[7px] font-bold">
                            <span className="flex items-center gap-1 text-[#6F8175]">
                              <span className="h-1.5 w-1.5 rounded-full bg-[#5E7166]" />
                              Hold ({heroPlays.reduce((s, p) => s + parseFloat(p.routes[2].pts), 0).toFixed(1)})
                            </span>
                            <span className="flex items-center gap-1 text-[#A67BFF]">
                              <span className="h-1.5 w-1.5 rounded-full bg-[#A67BFF]" />
                              This route ({heroPlays.reduce((s, p, i) => s + (i === gwIndex ? parseFloat(route.pts) : parseFloat(p.routes[0].pts)), 0).toFixed(1)})
                            </span>
                          </div>
                        </div>

                        <div className="group w-[78%] shrink-0 snap-start rounded-xl border border-[#E8B23D]/25 bg-[#1E3527] p-2.5 transition duration-200 hover:-translate-y-0.5 hover:border-[#E8B23D]/50 hover:bg-[#243D2C] sm:w-auto sm:shrink">
                          <p className="text-[7.5px] font-black uppercase tracking-[0.06em] text-[#E8B23D]">Captain this week</p>
                          <div className="mt-1.5 flex items-center gap-2">
                            <div className="relative h-9 w-9 shrink-0">
                              <span className="hero-armband-ring absolute inset-0 rounded-full" />
                              <span className="relative block h-9 w-9 overflow-hidden rounded-full bg-[#0A140E]">
                                <Image key={`${play.gw}-cap`} src={`https://resources.premierleague.com/premierleague/photos/players/110x140/p${play.capCode}.png`} alt="" fill sizes="36px" className="object-cover object-top" />
                              </span>
                              <span className="absolute -right-0.5 -top-0.5 grid h-4 w-4 place-items-center rounded-full border-[1.5px] border-[#1E3527] bg-[#E8B23D] text-[8px] font-black text-[#1C1300]">C</span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[11px] font-black text-[#F3EFE3]">{play.capName}</p>
                              <p className="truncate text-[7.5px] font-bold text-[#A9B8AB]">{play.capMeta}</p>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-[13px] font-black tabular-nums text-[#E8B23D]">{play.capPts}</p>
                              <p className="text-[6.5px] font-black uppercase tracking-[0.06em] text-[#6F8175]">Proj pts</p>
                            </div>
                          </div>
                          <div className="mt-1.5 flex items-center justify-between rounded-[6px] bg-[#0A140E]/40 px-1.5 py-1">
                            <span className="text-[6.5px] font-black uppercase tracking-[0.05em] text-[#6F8175]">Vice-captain</span>
                            <span className="text-[8.5px] font-black text-[#F3EFE3]">{play.vcName} &middot; {play.vcPts}</span>
                          </div>
                        </div>

                        <div className="w-[78%] shrink-0 snap-start rounded-xl border border-[#F3EFE3]/[0.14] bg-[#1E3527] p-2.5 sm:w-auto sm:shrink">
                          <p className="text-[7.5px] font-black uppercase tracking-[0.06em] text-[#A67BFF]">Why this move</p>
                          <p className="mt-1.5 text-[9.5px] font-semibold leading-[1.4] text-[#A9B8AB]">{route.why}</p>
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            <span className="rounded-full border border-[#7FE0AC]/25 bg-[#7FE0AC]/10 px-1.5 py-0.5 text-[6.5px] font-black text-[#7FE0AC]">Fixtures {route.chipFixture}</span>
                            <span className="rounded-full border border-[#7FE0AC]/25 bg-[#7FE0AC]/10 px-1.5 py-0.5 text-[6.5px] font-black text-[#7FE0AC]">Form {route.chipForm}</span>
                            <span className="rounded-full border border-[#F3EFE3]/[0.16] bg-[#0A140E]/40 px-1.5 py-0.5 text-[6.5px] font-black text-[#A9B8AB]">{route.chipMinutes}</span>
                          </div>
                        </div>
                      </div>

                      <p className="mt-3 text-[8.5px] font-black uppercase tracking-[0.1em] text-[#5E7166]">Impact</p>
                      <div className={`mt-1.5 grid grid-cols-3 gap-2 rounded-xl p-0.5 transition ${focusStage === "project" ? "outline outline-2 outline-offset-4 outline-[#A67BFF]" : ""}`}>
                        <div className="rounded-[10px] border border-[#F3EFE3]/[0.14] bg-[#1E3527] p-2 text-center">
                          <div className="text-[14px] font-black tabular-nums text-[#7FE0AC]">{route.gain}</div>
                          <div className="mt-0.5 text-[7.5px] font-black uppercase tracking-[0.06em] text-[#6F8175]">Proj gain</div>
                        </div>
                        <div className="rounded-[10px] border border-[#F3EFE3]/[0.14] bg-[#1E3527] p-2 text-center">
                          <div className={`text-[14px] font-black tabular-nums ${route.hit ? "text-[#FF9F8F]" : ""}`}>{route.hit ? `-${route.hit}` : "0"}</div>
                          <div className="mt-0.5 text-[7.5px] font-black uppercase tracking-[0.06em] text-[#6F8175]">Cost</div>
                        </div>
                        <div className="rounded-[10px] border border-[#F3EFE3]/[0.14] bg-[#1E3527] p-2 text-center">
                          <div className="text-[14px] font-black tabular-nums">{route.conf}</div>
                          <div className="mt-0.5 text-[7.5px] font-black uppercase tracking-[0.06em] text-[#6F8175]">Confidence</div>
                          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[#F3EFE3]/10">
                            <span
                              className="block h-full rounded-full bg-[linear-gradient(90deg,#7A3FFF,#B394FF)] transition-[width] duration-700"
                              style={{ width: confWidth }}
                            />
                          </div>
                        </div>
                      </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex h-full flex-col justify-start gap-2.5 pt-1">
            <p className="text-[8.5px] font-black uppercase tracking-[0.1em] text-[#5E7166]">On this screen</p>

            {view === "team" ? (
              <>
                <div className="rounded-[12px] border border-[#7FE0AC]/25 bg-[#1E3527] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-[7.5px] font-black uppercase tracking-[0.08em] text-[#B394FF]">Team health</p>
                      <p className="mt-0.5 text-[12px] font-black text-[#F3EFE3]">Squad availability</p>
                    </div>
                    <span className="shrink-0 rounded-full border border-[#7FE0AC]/30 bg-[#7FE0AC]/10 px-2 py-0.5 text-[8px] font-black text-[#7FE0AC]">A-</span>
                  </div>

                  <div className="mt-2.5 grid grid-cols-[52px_minmax(0,1fr)] items-center gap-2.5">
                    <div className="relative grid h-[52px] w-[52px] place-items-center rounded-full" style={{ background: "conic-gradient(#7FE0AC 310deg, rgba(243,239,227,0.1) 310deg)" }}>
                      <div className="grid h-9 w-9 place-items-center rounded-full bg-[#16281D]">
                        <div className="text-center">
                          <p className="text-[12px] font-black leading-none text-[#F3EFE3]">86</p>
                          <p className="text-[5px] font-black uppercase tracking-[0.06em] text-[#6F8175]">Health</p>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1">
                      {[
                        { label: "Players flagged", value: 6, tone: "bg-[#7FE0AC]/15 text-[#7FE0AC]" },
                        { label: "Status risks", value: 0, tone: "bg-[#FF9F8F]/15 text-[#FF9F8F]" },
                        { label: "Rotation risks", value: 4, tone: "bg-[#E8B23D]/15 text-[#E8B23D]" },
                      ].map((item) => (
                        <div key={item.label} className="flex items-center gap-1.5">
                          <span className={`grid h-4 w-4 shrink-0 place-items-center rounded-full text-[7.5px] font-black ${item.tone}`}>{item.value}</span>
                          <p className="text-[7.5px] font-bold text-[#A9B8AB]">{item.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-2.5 space-y-1.5">
                    <div>
                      <div className="flex items-center justify-between text-[7px] font-black">
                        <span className="text-[#A9B8AB]">Minutes risk</span>
                        <span className="text-[#E8B23D]">22%</span>
                      </div>
                      <div className="mt-1 h-1 overflow-hidden rounded-full bg-[#0A140E]/50">
                        <div className="h-full rounded-full bg-[#E8B23D]" style={{ width: "22%" }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-[7px] font-black">
                        <span className="text-[#A9B8AB]">Status risk</span>
                        <span className="text-[#FF9F8F]">18%</span>
                      </div>
                      <div className="mt-1 h-1 overflow-hidden rounded-full bg-[#0A140E]/50">
                        <div className="h-full rounded-full bg-[#FF9F8F]" style={{ width: "18%" }} />
                      </div>
                    </div>
                  </div>

                  <div className="mt-2.5 flex items-center justify-center gap-1 rounded-[8px] border border-[#A67BFF]/30 bg-[#A67BFF]/10 py-1.5 text-[8.5px] font-black text-[#B394FF]">
                    View full squad health <span aria-hidden="true">&rarr;</span>
                  </div>
                </div>

                <div className="rounded-[12px] border border-[#F3EFE3]/[0.14] bg-[#1E3527] p-3">
                  <p className="text-[9px] font-black uppercase tracking-[0.08em] text-[#A9B8AB]">Chips available</p>
                  <div className="mt-2 grid grid-cols-4 gap-1">
                    {[
                      { tag: "WC", ready: true },
                      { tag: "FH", ready: true },
                      { tag: "BB", ready: true },
                      { tag: "TC", ready: false },
                    ].map((chip) => (
                      <div key={chip.tag} className={`rounded-[8px] border py-1.5 text-center ${chip.ready ? "border-[#7FE0AC]/25 bg-[#7FE0AC]/[0.06]" : "border-[#F3EFE3]/10 opacity-45"}`}>
                        <span className="block text-[10px] font-black text-[#F3EFE3]">{chip.tag}</span>
                        <span className={`block text-[6.5px] font-black uppercase tracking-[0.05em] ${chip.ready ? "text-[#7FE0AC]" : "text-[#6F8175]"}`}>{chip.ready ? "Ready" : "Used"}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[12px] border border-[#E8B23D]/25 bg-[#1E3527] p-3">
                  <p className="text-[9px] font-black uppercase tracking-[0.08em] text-[#E8B23D]">This week&apos;s captain</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-[#0A140E]">
                      <Image src={shirtUrl(43)} alt="" width={28} height={28} className="h-7 w-7 object-contain" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-black text-[#F3EFE3]">Haaland (C)</p>
                      <p className="truncate text-[8.5px] font-bold text-[#A9B8AB]">9.8 pts projected</p>
                    </div>
                  </div>
                  <p className="mt-2 text-[8.5px] font-bold text-[#6F8175]">Open GW1 for the full reasoning &rarr;</p>
                </div>
              </>
            ) : (
              <>
                <div
                  onMouseEnter={() => setFocusStage("project")}
                  onMouseLeave={() => setFocusStage(null)}
                  className={`rounded-[12px] border p-3 transition ${focusStage === "project" ? "border-[#A67BFF]/50 bg-[#A67BFF]/[0.08]" : "border-[#F3EFE3]/[0.14] bg-[#1E3527]"}`}
                >
                  <p className="text-[9px] font-black uppercase tracking-[0.08em] text-[#A9B8AB]">Alternatives ranked</p>
                  <p className="mt-0.5 text-[7.5px] font-bold text-[#6F8175]">Pick one to preview it in the move card</p>
                  <ol className="mt-2 space-y-1">
                    {play.routes.map((r, i) => (
                      <li key={r.label}>
                        <button
                          type="button"
                          onClick={() => handleAltPick(i)}
                          className={`flex w-full items-center justify-between gap-2 rounded-[8px] px-1.5 py-1 text-left text-[10px] transition ${
                            i === altIndex ? "bg-[#A67BFF]/[0.14] font-black text-[#F3EFE3]" : "font-bold text-[#A9B8AB] hover:bg-[#F3EFE3]/[0.06] hover:text-[#F3EFE3]"
                          }`}
                        >
                          <span className="truncate">{i + 1}. {r.label}</span>
                          <span className={`shrink-0 ${i === altIndex ? "text-[#7FE0AC]" : ""}`}>{r.gain}</span>
                        </button>
                      </li>
                    ))}
                  </ol>
                </div>

                <div
                  onMouseEnter={() => setFocusStage("decide")}
                  onMouseLeave={() => setFocusStage(null)}
                  className={`rounded-[12px] border p-3 transition ${focusStage === "decide" ? "border-[#A67BFF]/50 bg-[#A67BFF]/[0.08]" : "border-[#F3EFE3]/[0.14] bg-[#1E3527]"}`}
                >
                  <p className="text-[9px] font-black uppercase tracking-[0.08em] text-[#A9B8AB]">Data coverage</p>
                  <div className="mt-1.5 flex items-end justify-between gap-2">
                    <span className="text-[17px] font-black tabular-nums text-[#F3EFE3]">{play.coverage}</span>
                    <span className="shrink-0 rounded-md bg-[#F3EFE3]/[0.08] px-1.5 py-0.5 text-[8px] font-black text-[#A9B8AB]">{play.fallback} fallback</span>
                  </div>
                  <p className="mt-0.5 text-[8.5px] font-bold text-[#6F8175]">players with live fixture data</p>
                </div>

                <div
                  onMouseEnter={() => setFocusStage("diagnose")}
                  onMouseLeave={() => setFocusStage(null)}
                  className={`rounded-[12px] border p-3 transition ${focusStage === "diagnose" ? "border-[#A67BFF]/50 bg-[#A67BFF]/[0.08]" : "border-[#F3EFE3]/[0.14] bg-[#1E3527]"}`}
                >
                  <p className="text-[9px] font-black uppercase tracking-[0.08em] text-[#A9B8AB]">{gwIndex === 0 ? "Next deadline" : "Planning window"}</p>
                  {gwIndex === 0 ? (
                    <p className="mt-1.5 text-[12px] font-black tabular-nums text-[#F3EFE3]">
                      {countdown.ready ? `${countdown.days}d ${pad2(countdown.hours)}h ${pad2(countdown.minutes)}m ${pad2(countdown.seconds)}s` : "-"}
                    </p>
                  ) : (
                    <p className="mt-1.5 text-[12px] font-black text-[#F3EFE3]">Opens after {heroPlays[gwIndex - 1].gw}</p>
                  )}
                  <p className="mt-0.5 text-[8.5px] font-bold text-[#6F8175]">Route re-ranks automatically once locked</p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes heroPillPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
        @keyframes heroArrowCrawl {
          from { stroke-dashoffset: 0; }
          to { stroke-dashoffset: -14; }
        }
        .hero-armband-ring {
          animation: heroArmbandPulse 2.2s ease-in-out infinite;
        }
        @keyframes heroArmbandPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(232,178,61,0.45); }
          50% { box-shadow: 0 0 0 5px rgba(232,178,61,0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .hero-armband-ring { animation: none; }
        }
      `}</style>
    </section>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#F7F4FB] text-[#17052D]">
      <NewHero />

      <section id="system" className="relative mx-auto max-w-[1480px] px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,.72fr)_minmax(620px,1.28fr)] lg:items-start">
          <div className="lg:sticky lg:top-10">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#6C1DFF]">The Matchday loop</p>
            <h2 className="mt-4 text-4xl font-black leading-[1] tracking-[-0.048em] text-[#17052D] sm:text-5xl">
              Built around how an FPL decision actually happens.
            </h2>
            <p className="mt-5 max-w-xl text-base font-semibold leading-7 text-[#74687D]">
              Every module inherits the same squad, gameweek, bank, free transfers and route context. The manager moves through one connected decision loop.
            </p>

            <div className="mt-7 rounded-[22px] border border-[#D9C9F4] bg-[linear-gradient(135deg,#FFFFFF_0%,#F2E9FF_100%)] p-5 shadow-[0_18px_50px_rgba(55,18,82,0.08)]">
              <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#6C1DFF]">The core principle</p>
              <p className="mt-2 text-xl font-black leading-7 text-[#17052D]">
                One imported squad should produce one coherent decision state across the entire product.
              </p>
            </div>
          </div>

          <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2">
            <OsLoopStep index="01" icon="import" title="Import the real squad" copy="Load the current 15, captain, vice, formation, bank and available transfers." />
            <OsLoopStep index="02" icon="health" title="Diagnose the XI" copy="Surface availability, minutes, structural and fixture pressure before making a move." />
            <OsLoopStep index="03" icon="transfer" title="Choose the current action" copy="Recommend transfer, roll or hold with expected gain, confidence and failure cases." />
            <OsLoopStep index="04" icon="scenario" title="Test the alternative" copy="Let the manager challenge the recommendation without losing squad context." />
            <OsLoopStep index="05" icon="planner" title="Connect the next five GWs" copy="Show the route consequences of the current action gameweek by gameweek." />
            <OsLoopStep index="06" icon="review" title="Review and carry forward" copy="Explain what happened and what the next gameweek inherits from the last decision." />
          </div>
        </div>
      </section>

      <section id="modules" className="border-y border-[#E6DFEA] bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-[1480px] px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#6C1DFF]">Explore the operating layer</p>
            <h2 className="mt-4 text-4xl font-black leading-[1] tracking-[-0.047em] text-[#17052D] sm:text-5xl">
              Click through every module in the same decision system.
            </h2>
            <p className="mt-5 text-base font-semibold leading-7 text-[#74687D]">
              Eight views into one imported team and one live gameweek state.
            </p>
          </div>

          <ModuleExplorer />
        </div>
      </section>

      <section className="relative overflow-hidden bg-[#100C18] py-20 text-white sm:py-24">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-32 top-[-80px] h-[420px] w-[420px] rounded-full bg-[#6C1DFF]/18 blur-[120px]" />
          <div className="absolute bottom-[-180px] right-[-60px] h-[420px] w-[420px] rounded-full bg-[#00A86B]/12 blur-[120px]" />
        </div>

        <div className="relative mx-auto max-w-[1480px] px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,.86fr)_minmax(560px,1.14fr)] lg:items-center">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#BFAAFF]">Why it feels different</p>
              <h2 className="mt-4 text-4xl font-black leading-[1] tracking-[-0.047em] text-white sm:text-5xl">
                The product does not end at “buy this player.”
              </h2>
              <p className="mt-5 max-w-xl text-base font-semibold leading-7 text-white/55">
                Every recommendation is placed inside the real squad, the deadline decision and the route after it.
              </p>

              <div className="mt-7 space-y-3">
                {[
                  "Current squad and recommended squad stay clearly separated.",
                  "Captaincy, transfers and planner inherit the same gameweek state.",
                  "Alternative decisions can be tested before the deadline.",
                  "The next gameweek inherits the consequences of this one.",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3 rounded-[16px] border border-white/9 bg-white/[0.05] p-4">
                    <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#8CFFD5] text-[#063D2A]">
                      <Icon name="check" className="h-3.5 w-3.5" />
                    </span>
                    <p className="text-sm font-semibold leading-6 text-white/72">{item}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[30px] border border-white/12 bg-white/[0.055] p-4 shadow-[0_28px_80px_rgba(0,0,0,0.24)] backdrop-blur sm:p-6">
              <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                <div className="rounded-[20px] border border-white/10 bg-white/[0.06] p-5">
                  <p className="text-[9px] font-black uppercase tracking-[0.13em] text-white/42">Generic FPL output</p>
                  <p className="mt-3 text-2xl font-black text-white">“Buy Watkins”</p>
                  <div className="mt-5 space-y-2">
                    {["Single projection", "No squad route", "No consequence map"].map((item) => (
                      <p key={item} className="rounded-xl bg-black/16 px-3 py-2 text-xs font-bold text-white/45">{item}</p>
                    ))}
                  </div>
                </div>

                <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-[#6C1DFF] text-white shadow-[0_14px_34px_rgba(108,29,255,0.30)]">
                  <Icon name="arrow" />
                </span>

                <div className="rounded-[20px] border border-[#7D5CC7] bg-[linear-gradient(145deg,rgba(108,29,255,.22),rgba(0,168,107,.10))] p-5">
                  <p className="text-[9px] font-black uppercase tracking-[0.13em] text-[#CBB9FF]">Matchday OS</p>
                  <p className="mt-3 text-2xl font-black text-white">“Watkins now, because the route still wins by GW5.”</p>
                  <div className="mt-5 space-y-2">
                    {["Current XI context", "Alternative route", "Five-GW consequence map"].map((item) => (
                      <p key={item} className="rounded-xl bg-white/[0.08] px-3 py-2 text-xs font-black text-[#A7F3D0]">{item}</p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="beta" className="relative overflow-hidden bg-[#6C1DFF] px-4 py-16 text-white sm:px-6 sm:py-20">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-20 -top-32 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-44 right-0 h-96 w-96 rounded-full bg-[#00D998]/20 blur-3xl" />
          <div className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(rgba(255,255,255,.15)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.15)_1px,transparent_1px)] [background-size:44px_44px]" />
        </div>

        <div className="relative mx-auto flex max-w-5xl flex-col items-center text-center">
          <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em]">
            Matchday OS Beta
          </span>
          <span className="mt-6 grid h-14 w-14 place-items-center rounded-[18px] bg-white text-[#6C1DFF] shadow-[0_18px_42px_rgba(28,6,68,0.22)]">
            <Icon name="spark" className="h-7 w-7" />
          </span>
          <h2 className="mt-7 text-4xl font-black leading-[1] tracking-[-0.047em] sm:text-5xl">
            Import the squad.
            <span className="block text-[#BAFFE8]">Explore the entire decision state.</span>
          </h2>
          <p className="mt-5 max-w-2xl text-base font-semibold leading-7 text-white/72">
            Current XI. This gameweek. The five after it. Beta users help test the model against real FPL squads and real deadline decisions.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/import" className="inline-flex min-h-13 items-center justify-center gap-2 rounded-[14px] bg-white px-7 py-3.5 text-sm font-black text-[#17052D] shadow-[0_18px_40px_rgba(30,7,71,0.22)] transition hover:-translate-y-0.5 hover:bg-[#F3EEFF]">
              Enter the beta with my team <Icon name="arrow" className="h-4 w-4" />
            </Link>
            <Link href="/dashboard" className="inline-flex min-h-13 items-center justify-center rounded-[14px] border border-white/22 bg-white/[0.08] px-7 py-3.5 text-sm font-black text-white transition hover:bg-white/[0.14]">
              Open Matchday OS
            </Link>
          </div>
        </div>
      </section>


      <style jsx global>{`
        @keyframes landingSwap {
          from {
            opacity: 0;
            transform: translateY(7px) scale(0.992);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .landing-swap {
          animation: landingSwap 260ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        @media (prefers-reduced-motion: reduce) {
          .landing-swap {
            animation: none;
          }
        }
      `}</style>

      <footer className="bg-[#090711] text-white">
        <div className="mx-auto flex max-w-[1480px] flex-col gap-6 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <div className="flex items-center gap-3">
            <Brand />
            <span className="rounded-full border border-white/12 bg-white/[0.06] px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.12em] text-white/50">
              Beta
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-bold text-white/42">
            <a href="#system" className="transition hover:text-white">The system</a>
            <a href="#modules" className="transition hover:text-white">Modules</a>
            <Link href="/trust" className="transition hover:text-white">Model trust</Link>
            <Link href="/import" className="transition hover:text-white">Import team</Link>
          </div>
          <p className="text-xs font-bold text-white/28">Beta decision support, not certainty.</p>
        </div>
      </footer>
    </main>
  );
}