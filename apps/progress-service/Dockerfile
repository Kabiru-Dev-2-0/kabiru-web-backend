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

COPY apps/progress-service ./apps/progress-service
RUN bun run --cwd apps/progress-service prisma:generate
RUN bun run --cwd apps/progress-service build

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
COPY --from=build /app/apps/progress-service/package.json ./apps/progress-service/package.json
COPY --from=build /app/apps/progress-service/node_modules ./apps/progress-service/node_modules
COPY --from=build /app/apps/progress-service/prisma ./apps/progress-service/prisma
COPY --from=build /app/apps/progress-service/dist ./apps/progress-service/dist

WORKDIR /app/apps/progress-service
USER bun
EXPOSE 4014
CMD ["bun", "run", "dist/main.js"]
