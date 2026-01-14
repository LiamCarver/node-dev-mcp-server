FROM node:20-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
       git \
       ca-certificates \
  && update-ca-certificates \
  && git config --global push.autoSetupRemote true \
  && git config --global user.name "mcp-bot" \
  && git config --global user.email "mcp-bot@ai.com" \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build /app/build ./build

ENV NODE_ENV=production

CMD ["node", "build/server.js"]
