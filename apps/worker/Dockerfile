FROM node:20-slim AS base
RUN corepack enable

FROM base AS builder
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @aivs/worker... build

FROM base AS runner
WORKDIR /app
COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=builder /app/apps ./apps
COPY --from=builder /app/packages ./packages
RUN pnpm install --prod --frozen-lockfile
WORKDIR /app/apps/worker

CMD ["node", "dist/index.js"]
