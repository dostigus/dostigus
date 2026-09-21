# syntax=docker/dockerfile:1
# Day-1 Host image (ADR 0005, ADR 0007). Monorepo-aware: pnpm install → Nuxt build → slim Node runtime.

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH="${PNPM_HOME}:${PATH}"
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
ENV NUXT_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@10.33.3 --activate
WORKDIR /app

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/ui-kit/package.json packages/ui-kit/package.json
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY . .
RUN pnpm --filter @dostigus/web build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NUXT_TELEMETRY_DISABLED=1
ENV HOST=0.0.0.0
ENV PORT=3000
ENV NITRO_HOST=0.0.0.0
ENV NITRO_PORT=3000
ENV DATABASE_URL=file:/var/lib/dostigus/cluster.sqlite
RUN mkdir -p /var/lib/dostigus \
  && chown node:node /var/lib/dostigus /app
COPY --from=build --chown=node:node /app/apps/web/.output /app/.output
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", ".output/server/index.mjs"]
