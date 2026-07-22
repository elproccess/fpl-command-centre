import type { Player, RiskLevel, UserGameState } from "@/lib/types";

export function teamColor(team: string) {
  if (team === "ARS") return "bg-red-600";
  if (team === "MCI") return "bg-sky-300";
  if (team === "CHE") return "bg-blue-700";
  if (team === "NEW") return "bg-zinc-900";
  if (team === "AVL") return "bg-[#7A1F4D]";
  if (team === "BRE") return "bg-red-500";
  if (team === "CRY") return "bg-blue-600";
  if (team === "FUL") return "bg-zinc-100";
  return "bg-[#6C1DFF]";
}

export function KitDot({ player, size = "md" }: { player: Pick<Player, "team">; size?: "sm" | "md" | "lg" }) {
  const sizes = {
    sm: "h-8 w-8 rounded-t-lg",
    md: "h-11 w-11 rounded-t-xl",
    lg: "h-16 w-16 rounded-t-2xl",
  };
  return <span className={`block shrink-0 rounded-b-md border border-white/70 shadow-md ${sizes[size]} ${teamColor(player.team)}`} />;
}

export function FixturePill({ fixture, difficulty = 3 }: { fixture?: string; difficulty?: number }) {
  const tone =
    difficulty <= 2
      ? "border-[#00C853]/30 bg-[#00C853]/12 text-[#008B3A]"
      : difficulty === 3
        ? "border-[#FFB800]/35 bg-[#FFB800]/14 text-[#9A6900]"
        : "border-[#E90052]/25 bg-[#E90052]/10 text-[#C80046]";

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-black ${tone}`}>
      {fixture ?? "TBC"}
    </span>
  );
}

export function Armband({ label }: { label: "C" | "V" }) {
  return (
    <span className={`${label === "C" ? "bg-[#17002F] text-white" : "bg-[#FFB800] text-[#17002F]"} grid h-6 w-6 place-items-center rounded-full text-xs font-black shadow`}>
      {label}
    </span>
  );
}

export function formatPrice(price: number) {
  return `\u00a3${price.toFixed(1)}m`;
}

export function DeadlineStrip({ state }: { state: UserGameState }) {
  return (
    <section className="mb-5 grid gap-3 rounded-2xl border border-[#E8DEF8] bg-white p-3 shadow-[0_14px_35px_rgba(55,0,60,0.06)] md:grid-cols-[1fr_auto_auto] md:items-center">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#37003C] text-xs font-black text-white">{state.gameweek_label}</span>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#6C1DFF]">Deadline clock</p>
          <p className="text-lg font-black text-[#17002F]">{state.deadline_label}</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          [String(state.free_transfers), "FT"],
          [`\u00a3${state.bank.toFixed(1)}`, "Bank"],
          [state.current_tier, "Tier"],
        ].map(([value, label]) => (
          <div key={label} className="rounded-xl bg-[#F8F5FF] px-4 py-2">
            <p className="text-2xl font-black text-[#6C1DFF]">{value}</p>
            <p className="text-[10px] font-bold uppercase text-[#5D4A70]">{label}</p>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-[#E8DEF8] px-4 py-3 text-sm font-black text-[#17002F]">
        {state.team_name} / {state.formation}
      </div>
    </section>
  );
}

export function NativeMetric({ label, value, tone = "purple" }: { label: string; value: string; tone?: "purple" | "green" | "pink" | "amber" | "cyan" }) {
  const tones = {
    purple: "text-[#6C1DFF]",
    green: "text-[#00A844]",
    pink: "text-[#E90052]",
    amber: "text-[#B97800]",
    cyan: "text-[#0087B8]",
  };
  return (
    <div className="rounded-xl border border-[#E8DEF8] bg-white/78 p-4">
      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#7B688E]">{label}</p>
      <p className={`mt-2 whitespace-nowrap text-2xl font-black ${tones[tone]}`}>{value}</p>
    </div>
  );
}

export function RiskText({ value }: { value: RiskLevel }) {
  const tone = value === "Low" ? "text-[#00A844]" : value === "Medium" ? "text-[#B97800]" : "text-[#E90052]";
  return <span className={`font-black ${tone}`}>{value}</span>;
}

export function MiniTrend({ trend = "flat" }: { trend?: Player["trend"] }) {
  const arrow = trend === "up" ? "up" : trend === "down" ? "down" : "flat";
  const tone = trend === "up" ? "text-[#00A844]" : trend === "down" ? "text-[#E90052]" : "text-[#5D4A70]";
  return <span className={`text-xs font-black ${tone}`}>{arrow}</span>;
}
