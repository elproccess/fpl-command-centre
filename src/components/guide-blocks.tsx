import Link from "next/link";
import type { ReactNode } from "react";

export function GuideHero({ eyebrow, title, dek }: { eyebrow: string; title: string; dek: string }) {
  return (
    <section className="rounded-2xl border border-[#111827] bg-[#070912] p-5 text-white shadow-[0_24px_60px_rgba(0,0,0,0.18)]">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#A7F3D0]">{eyebrow}</p>
      <h1 className="mt-2 text-4xl font-black leading-tight text-wrap-balance">{title}</h1>
      <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-white/72">{dek}</p>
    </section>
  );
}

export function GuideSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-5 shadow-[0_18px_45px_rgba(55,0,60,0.08)]">
      <h2 className="text-xl font-black text-[var(--ink)]">{title}</h2>
      <div className="mt-3 space-y-3 text-sm font-semibold leading-6 text-[var(--muted)]">{children}</div>
    </section>
  );
}

export function GuideCallout({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--accent-border)] bg-[var(--accent-soft)] p-4">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--accent)]">{label}</p>
      <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ink-soft)]">{children}</p>
    </div>
  );
}

export function GuideFAQ({ items }: { items: { q: string; a: string }[] }) {
  return (
    <section className="mt-6 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-5 shadow-[0_18px_45px_rgba(55,0,60,0.08)]">
      <h2 className="text-xl font-black text-[var(--ink)]">Quick answers</h2>
      <div className="mt-4 space-y-4">
        {items.map((item) => (
          <div key={item.q} className="border-t border-[var(--border-soft)] pt-4 first:border-t-0 first:pt-0">
            <p className="text-sm font-black text-[var(--ink)]">{item.q}</p>
            <p className="mt-1.5 text-sm font-semibold leading-6 text-[var(--muted)]">{item.a}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function GuideCTA({ heading, body, href, label }: { heading: string; body: string; href: string; label: string }) {
  return (
    <section className="mt-6 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-5 shadow-[0_18px_45px_rgba(55,0,60,0.08)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-black text-[var(--ink)]">{heading}</h2>
          <p className="mt-2 max-w-2xl text-sm font-semibold text-[var(--muted)]">{body}</p>
        </div>
        <Link
          href={href}
          className="w-fit shrink-0 rounded-full bg-[var(--ink)] px-5 py-3 text-sm font-black text-[var(--surface)] transition hover:opacity-90"
        >
          {label} &rarr;
        </Link>
      </div>
    </section>
  );
}

const ALL_GUIDES = [
  { href: "/guides/beginners", label: "FPL for Beginners" },
  { href: "/guides/chips", label: "Chips Explained" },
  { href: "/guides/captaincy", label: "Captaincy Explained" },
  { href: "/guides/mistakes", label: "Common Mistakes" },
];

export function GuideRelated({ current }: { current: string }) {
  const others = ALL_GUIDES.filter((guide) => guide.href !== current);
  return (
    <section className="mt-6">
      <p className="mb-3 text-xs font-black uppercase tracking-[0.14em] text-[var(--muted-2)]">More guides</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {others.map((guide) => (
          <Link
            key={guide.href}
            href={guide.href}
            className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-4 text-sm font-black text-[var(--ink)] transition hover:border-[var(--accent-border)] hover:bg-[var(--accent-soft)]"
          >
            {guide.label} &rarr;
          </Link>
        ))}
      </div>
    </section>
  );
}

export function GuideList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}
