# syntax=docker/dockerfile:1
FROM oven/bun:1 AS deps
WORKDIR /app

RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json bun.lock ./
COPY packages/contracts/package.json ./packages/contracts/package.json
COPY apps/api-gateway/package.json ./apps/api-gateway/package.json
COPY apps/auth-service/package.json ./apps/auth-service/package.json
COPY apps/user-service/package.json ./apps/user-service/package.json
COPY apps/learning-service/package.json ./apps/learning-service/package.json
COPY apps/progress-service/package.json ./apps/progress-service/package.json
COPY apps/ai-service/package.json ./apps/ai-service/package.json

RUN bun install --frozen-lockfile

FROM deps AS build
WORKDIR /app
COPY packages/contracts ./packages/contracts
RUN bun run --cwd packages/contracts build

COPY apps/learning-service ./apps/learning-service
RUN bun run --cwd apps/learning-service prisma:generate
RUN bun run --cwd apps/learning-service build

FROM oven/bun:1-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/contracts/package.json ./packages/contracts/package.json
COPY --from=build /app/packages/contracts/node_modules ./packages/contracts/node_modules
COPY --from=build /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=build /app/apps/learning-service/package.json ./apps/learning-service/package.json
COPY --from=build /app/apps/learning-service/node_modules ./apps/learning-service/node_modules
COPY --from=build /app/apps/learning-service/prisma ./apps/learning-service/prisma
COPY --from=build /app/apps/learning-service/dist ./apps/learning-service/dist

RUN mkdir -p /app/apps/learning-service/.local-r2-storage \
  && chown -R bun:bun /app/apps/learning-service/.local-r2-storage

WORKDIR /app/apps/learning-service
USER bun
EXPOSE 4013
CMD ["bun", "run", "dist/main.js"]
