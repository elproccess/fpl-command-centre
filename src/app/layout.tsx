import type { Metadata } from "next";
import Script from "next/script";
import { Inter_Tight, Sora } from "next/font/google";
import "./globals.css";

const interTight = Inter_Tight({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800", "900"],
});

const sora = Sora({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

// Every route here reads live, per-request backend state (gameweek, projections, market data) -
// without this, pages that don't explicitly opt in themselves (several were missing it) get
// statically prerendered once at build time and served from cache with a full year's
// Cache-Control, so a deploy's actual content changes never reach a browser/edge cache that
// already holds the old response until that cache independently expires or is force-cleared.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "FPL Command Centre",
  description: "Premium FPL decision assistant for your best move, captain pick, squad health, and 3-GW plan.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${interTight.variable} ${sora.variable} h-full antialiased`}
    >
      <head>
        {/* Cloudflare Web Analytics: no cookies, no persistent identifier, so no consent
            gate is needed - runs for every visitor from load. */}
        <Script
          id="cf-web-analytics"
          type="module"
          src="https://static.cloudflareinsights.com/beacon.min.js"
          data-cf-beacon='{"token": "bc4d8bfc179c48ef9c4fc7dafee7919f"}'
          strategy="beforeInteractive"
        />
        {/* Self-hosted Umami: same no-cookie, no-consent-needed design, but adds custom event
            tracking (see src/lib/umami.ts) that the Cloudflare beacon alone can't do. Its script
            auto-tracks SPA route changes itself, so no separate route-tracker component is needed. */}
        <Script
          id="umami-analytics"
          defer
          src="https://analytics.matchdayfpl.co.uk/script.js"
          data-website-id="0d55cf13-b38f-48e7-8710-62c8e61b1237"
          strategy="afterInteractive"
        />
      </head>
      <body className="min-h-full bg-[#F8F5FF] text-[#17002F]">{children}</body>
    </html>
  );
}
