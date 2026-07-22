# Matches Next.js 16.2.9 / React 19.2.4's actual runtime requirements - Node 22 LTS.
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Found live: next.config.ts's rewrites() destination is resolved once when Next.js's standalone
# output is built, not re-read from the environment at container startup - setting
# BACKEND_API_BASE_URL only via docker-compose's runtime `environment:` (as this comment used to
# claim was sufficient) silently kept every request pointed at the 127.0.0.1:8000 fallback instead
# of the real backend service, even though `docker exec ... printenv` showed the right value was
# genuinely present at runtime. Must be supplied as a build ARG so it's baked in at the point
# `npm run build` actually resolves next.config.ts.
ARG BACKEND_API_BASE_URL=http://127.0.0.1:8000
ENV BACKEND_API_BASE_URL=${BACKEND_API_BASE_URL}
RUN npm run build

# output: "standalone" (see next.config.ts) produces a minimal server bundle plus only the
# node_modules it actually needs - this final image never needs the full node_modules tree.
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD wget -qO- http://127.0.0.1:3000/ || exit 1

CMD ["node", "server.js"]
