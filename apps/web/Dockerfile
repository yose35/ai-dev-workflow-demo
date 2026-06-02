# Multi-stage Dockerfile for @app/web (Next.js standalone output)
# Usage:
#   docker build -t ai-dev-workflow-web -f apps/web/Dockerfile .
#   docker run -p 3001:3001 --env-file apps/web/.env.local ai-dev-workflow-web

# ── 1. Deps ───────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json apps/web/
COPY packages/contract/ packages/contract/
RUN pnpm install --frozen-lockfile --filter @app/web...

# ── 2. Build ──────────────────────────────────────────────────
FROM deps AS build
COPY tsconfig.base.json ./
COPY apps/web apps/web
COPY packages/contract packages/contract
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @app/web build

# ── 3. Runtime ────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
RUN addgroup -g 1001 -S nodejs && adduser -S -u 1001 nextjs

COPY --from=build /repo/apps/web/public ./public
COPY --from=build --chown=nextjs:nodejs /repo/apps/web/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /repo/apps/web/.next/static ./apps/web/.next/static

USER nextjs
EXPOSE 3001
ENV PORT=3001 HOSTNAME=0.0.0.0
CMD ["node", "apps/web/server.js"]
