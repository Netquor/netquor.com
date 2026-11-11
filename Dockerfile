# netquor.com web image. ONE image, run twice:
#   web    (default command)           SvelteKit pages + the Elysia API on port 3000, the single writer of the data volume
#   worker (bun server/src/worker.ts)  the backup price poll; it delivers to web over HTTP and writes nothing
# Build from the repository root: docker build -t ghcr.io/netquor/netquor-com-web:main .
# server/ and web/ keep the same absolute paths (/app/server, /app/web) in the build and run stages: the bundle finds the
# baked-in seed relative to server/.
ARG BUN_TAG=1.4.2-alpine

# The build, deps and legacy stages run on the BUILD machine's own architecture (Bun crashes under qemu emulation on Apple
# silicon, and nothing they produce is architecture specific: bundled JavaScript, pure-JavaScript production dependencies,
# static files). Only the runtime stage is the target platform (linux/amd64), where it only installs tini and copies files.

# ---- build: install everything, build the SvelteKit app ----
FROM --platform=$BUILDPLATFORM oven/bun:${BUN_TAG} AS build
WORKDIR /app
COPY server/package.json server/bun.lock server/
COPY web/package.json web/bun.lock web/
RUN cd server && bun install --frozen-lockfile && cd ../web && bun install --frozen-lockfile
COPY server/tsconfig.json server/
COPY server/src server/src
COPY server/data/prices.seed.json server/data/catalog-map.json server/data/
COPY web/tsconfig.json web/vite.config.ts web/
COPY web/src web/src
# readiness.html imports the checklist data from the repository root at build time
COPY readiness-data.json ./
RUN cd web && bun run build

# ---- production dependencies only ----
FROM --platform=$BUILDPLATFORM oven/bun:${BUN_TAG} AS deps
WORKDIR /app
COPY server/package.json server/bun.lock server/
COPY web/package.json web/bun.lock web/
RUN cd server && bun install --frozen-lockfile --production && cd ../web && bun install --frozen-lockfile --production

# ---- legacy: the hand-written pages and assets (the .dockerignore already limits the context to them) ----
FROM --platform=$BUILDPLATFORM alpine:3.22 AS legacy
WORKDIR /ctx
COPY . /ctx
RUN mkdir /legacy \
 && find . -maxdepth 1 -type f \( -name '*.html' -o -name '*.css' -o -name '*.js' -o -name '*.svg' -o -name '*.png' -o -name '*.jpg' -o -name '*.jpeg' -o -name '*.gif' -o -name '*.webp' -o -name '*.avif' -o -name '*.ico' -o -name '*.webmanifest' -o -name 'readiness-data.json' -o -name 'llms.template.txt' \) -exec cp {} /legacy/ \; \
 && cp -r brand fleet /legacy/

# ---- runtime ----
FROM oven/bun:${BUN_TAG} AS runtime
RUN apk add --no-cache tini
ENV NODE_ENV=production \
    HOST=0.0.0.0 PORT=3000 \
    ORIGIN=https://www.netquor.com SITE_ORIGIN=https://www.netquor.com \
    ADDRESS_HEADER=X-Real-IP \
    LEGACY_DIR=/app/legacy \
    PRICES_DIR=/data PRICES_SEED_FILE=/app/server/data/prices.seed.json LEAD_FILE=/data/leads.jsonl
WORKDIR /app
COPY --from=deps /app/server/node_modules server/node_modules
COPY --from=deps /app/web/node_modules web/node_modules
COPY server/package.json server/
COPY server/src server/src
COPY server/scripts server/scripts
COPY server/data/prices.seed.json server/data/catalog-map.json server/data/
COPY web/package.json web/
COPY --from=build /app/web/build web/build
COPY --from=legacy /legacy legacy
COPY deploy/entrypoint.sh /app/entrypoint.sh
# /data is created owned by the unprivileged user so a fresh named volume mounted there inherits that ownership.
RUN mkdir /data && chown bun:bun /data && chmod 0750 /data
USER bun
VOLUME ["/data"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=4s --start-period=20s --start-interval=2s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1:3000/health || exit 1
ENTRYPOINT ["/sbin/tini", "--", "/app/entrypoint.sh"]
CMD ["bun", "web/build/index.js"]
