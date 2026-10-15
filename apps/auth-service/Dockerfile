FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json ./
RUN bun install
COPY tsconfig.json nest-cli.json ./
COPY src ./src
RUN bunx nest build

FROM oven/bun:1 AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY package.json ./package.json
CMD ["bun", "run", "start:prod"]
