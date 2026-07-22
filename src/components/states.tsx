export function LoadingSpinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function LoadingState({ label = "Loading your FPL command centre" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[#E8DEF8] bg-white p-6 text-sm font-semibold text-[#5D4A70] shadow-[0_18px_45px_rgba(55,0,60,0.08)]">
      <LoadingSpinner className="h-5 w-5 shrink-0 text-[#6C1DFF]" />
      {label}
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#D8C9ED] bg-white p-6">
      <h3 className="text-lg font-black text-[#17002F]">{title}</h3>
      <p className="mt-2 text-sm font-semibold text-[#5D4A70]">{body}</p>
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-[#E90052]/25 bg-[#E90052]/10 p-4 text-sm font-bold text-[#B70042]">
      {message}
    </div>
  );
}

export function TrustWarning({ show, reason }: { show?: boolean; reason?: string | null }) {
  if (!show) return null;
  return (
    <div className="rounded-xl border border-[#FFB800]/35 bg-[#FFB800]/10 p-3 text-xs font-bold leading-5 text-[#7A5200]">
      Using safer fallback estimate because some live features are missing.
      {reason ? <span className="block text-[#7A5200]/70">{reason}</span> : null}
    </div>
  );
}
