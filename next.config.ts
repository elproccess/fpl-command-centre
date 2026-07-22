import type { NextConfig } from "next";

function splitOrigins(value: string | undefined) {
  return value ? value.split(",").map((origin) => origin.trim()).filter(Boolean) : [];
}

function originHost(value: string | undefined) {
  if (!value) return [];
  try {
    return [new URL(value).host];
  } catch {
    return [value.trim()].filter(Boolean);
  }
}

const allowedDevOrigins = Array.from(new Set([
  ...splitOrigins(process.env.NEXT_ALLOWED_DEV_ORIGINS),
  ...originHost(process.env.NEXT_TUNNEL_ORIGIN),
  "*.trycloudflare.com",
  "*.lhr.life",
  "*.ngrok-free.app",
  "*.ngrok.io",
  "*.loca.lt",
]));

const backendApiBaseUrl =
  process.env.BACKEND_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  allowedDevOrigins,
  // Next.js's own rewrite proxy (used for /api/backend/* below) kills any proxied request after
  // 30s by default (node_modules/next/dist/server/lib/router-utils/proxy-request.js:
  // `proxyTimeout || 30000`) - found live: this is the actual root cause of the "socket hang up"
  // errors that were intermittently killing the multi-GW planner's /plan and /preview requests,
  // which routinely run 30-120+s. The backend itself never saw an error when this happened - the
  // proxy just silently dropped a perfectly healthy in-flight request out from under it. 180s
  // covers the planner's real worst case with margin; nothing else on this proxy path needs a
  // long timeout, so this is safe to raise globally.
  experimental: {
    proxyTimeout: 180000,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "resources.premierleague.com",
        pathname: "/premierleague/photos/players/110x140/**",
      },
      {
        protocol: "https",
        hostname: "fantasy.premierleague.com",
        pathname: "/dist/img/shirts/standard/**",
      },
    ],
  },
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/api/backend/:path*",
          destination: `${backendApiBaseUrl.replace(/\/+$/, "")}/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;
