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
    <div className="flex items-center gap-3 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-6 text-sm font-semibold text-[var(--ink-soft)] shadow-[0_18px_45px_var(--shadow-color)]">
      <LoadingSpinner className="h-5 w-5 shrink-0 text-[var(--accent)]" />
      {label}
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--accent-border)] bg-[var(--surface)] p-6">
      <h3 className="text-lg font-black text-[var(--ink)]">{title}</h3>
      <p className="mt-2 text-sm font-semibold text-[var(--ink-soft)]">{body}</p>
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-[var(--danger)]/25 bg-[var(--danger)]/10 p-4 text-sm font-bold text-[var(--danger)]">
      {message}
    </div>
  );
}

export function TrustWarning({ show, reason }: { show?: boolean; reason?: string | null }) {
  if (!show) return null;
  return (
    <div className="rounded-xl border border-[var(--warning)]/35 bg-[var(--warning)]/10 p-3 text-xs font-bold leading-5 text-[var(--warning)]">
      Using safer fallback estimate because some live features are missing.
      {reason ? <span className="block text-[var(--warning)]/70">{reason}</span> : null}
    </div>
  );
}
