# syntax=docker/dockerfile:1
FROM --platform=$BUILDPLATFORM node:22-bookworm-slim AS build
ARG TARGETPLATFORM
ARG BUILDPLATFORM

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY astro.config.mjs tsconfig.json tailwind.config.mjs ./
COPY src/ ./src/
COPY public/ ./public/

RUN npm run build \
  && npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime
ARG TARGETPLATFORM

WORKDIR /app
ENV NODE_ENV=production \
    PORT=4340 \
    HOST=0.0.0.0 \
    TZ=America/Sao_Paulo \
    DATA_DIR=/app/data

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    tzdata \
  && ln -fs /usr/share/zoneinfo/America/Sao_Paulo /etc/localtime \
  && dpkg-reconfigure --frontend noninteractive tzdata \
  && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /app/data

COPY package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

EXPOSE 4340

VOLUME ["/app/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:' + (process.env.PORT || 4340) + '/api/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "./dist/server/entry.mjs"]
