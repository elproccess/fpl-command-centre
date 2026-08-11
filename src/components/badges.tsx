import type { ConfidenceBand, RiskLevel } from "@/lib/types";

const confidenceClass: Record<ConfidenceBand, string> = {
  High: "bg-[var(--success)]/12 text-[var(--success)] ring-[var(--success)]/25",
  Medium: "bg-[var(--warning)]/14 text-[var(--warning)] ring-[var(--warning)]/30",
  Low: "bg-[var(--danger)]/10 text-[var(--danger)] ring-[var(--danger)]/25",
};

const riskClass: Record<RiskLevel, string> = {
  Low: "bg-[var(--success)]/12 text-[var(--success)] ring-[var(--success)]/25",
  Medium: "bg-[var(--warning)]/14 text-[var(--warning)] ring-[var(--warning)]/30",
  High: "bg-[var(--danger)]/10 text-[var(--danger)] ring-[var(--danger)]/25",
};

export function ConfidenceBadge({ value }: { value: ConfidenceBand }) {
  return <span className={`rounded-lg px-3 py-1 text-xs font-black ring-1 ${confidenceClass[value]}`}>{value}</span>;
}

export function RiskBadge({ value }: { value: RiskLevel }) {
  return <span className={`rounded-lg px-3 py-1 text-xs font-black ring-1 ${riskClass[value]}`}>{value}</span>;
}

export function SignalBadge({ value }: { value: string }) {
  const tone =
    value === "Buy"
      ? "bg-[var(--success)]/12 text-[var(--success)] ring-[var(--success)]/25"
      : value === "Sell" || value === "Avoid"
        ? "bg-[var(--danger)]/10 text-[var(--danger)] ring-[var(--danger)]/25"
        : value === "Watch"
          ? "bg-[var(--accent)]/10 text-[var(--accent)] ring-[var(--accent)]/20"
          : value === "Bench"
            // Deliberately flatter/greyer than every other badge - "no real claim on minutes"
            // reads as a lower tier than Watch's genuine "no strong call on a real player",
            // not just a different color for its own sake.
            ? "bg-[var(--muted)]/12 text-[var(--muted)] ring-[var(--muted)]/25"
            : "bg-[var(--info)]/10 text-[var(--info)] ring-[var(--info)]/25";
  return <span className={`rounded-lg px-3 py-1 text-xs font-black ring-1 ${tone}`}>{value}</span>;
}
