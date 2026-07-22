import type { ConfidenceBand, RiskLevel } from "@/lib/types";

const confidenceClass: Record<ConfidenceBand, string> = {
  High: "bg-[#00C853]/12 text-[#008B3A] ring-[#00C853]/25",
  Medium: "bg-[#FFB800]/14 text-[#A66F00] ring-[#FFB800]/30",
  Low: "bg-[#E90052]/10 text-[#C80046] ring-[#E90052]/25",
};

const riskClass: Record<RiskLevel, string> = {
  Low: "bg-[#00C853]/12 text-[#008B3A] ring-[#00C853]/25",
  Medium: "bg-[#FFB800]/14 text-[#A66F00] ring-[#FFB800]/30",
  High: "bg-[#E90052]/10 text-[#C80046] ring-[#E90052]/25",
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
      ? "bg-[#00C853]/12 text-[#008B3A] ring-[#00C853]/25"
      : value === "Sell" || value === "Avoid"
        ? "bg-[#E90052]/10 text-[#C80046] ring-[#E90052]/25"
        : value === "Watch"
          ? "bg-[#6C1DFF]/10 text-[#6C1DFF] ring-[#6C1DFF]/20"
          : "bg-[#00B8FF]/10 text-[#007AA8] ring-[#00B8FF]/25";
  return <span className={`rounded-lg px-3 py-1 text-xs font-black ring-1 ${tone}`}>{value}</span>;
}
