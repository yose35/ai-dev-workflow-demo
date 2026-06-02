# Multi-stage Dockerfile for @app/api
# Usage:
#   docker build -t ai-dev-workflow-api -f apps/api/Dockerfile .
#   docker run -p 3000:3000 --env-file .env ai-dev-workflow-api

# ── 1. Deps stage ─────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
# Prisma 需要 openssl
RUN apk add --no-cache openssl
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/db/package.json packages/db/
COPY packages/contract/ packages/contract/
RUN pnpm install --frozen-lockfile --filter @app/api... --filter @pkg/db

# ── 2. Build stage ───────────────────────────────────────────
FROM deps AS build
COPY tsconfig.base.json ./
COPY apps/api apps/api
COPY packages/db packages/db
RUN pnpm --filter @pkg/db generate
RUN pnpm --filter @app/api build

# ── 3. Runtime stage ─────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /repo
RUN apk add --no-cache openssl tini
ENV NODE_ENV=production

COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/apps/api/dist ./apps/api/dist
COPY --from=build /repo/apps/api/package.json ./apps/api/
COPY --from=build /repo/packages ./packages

EXPOSE 3000
USER node
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/api/dist/server.js"]
