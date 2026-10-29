FROM node:24-bookworm-slim AS build
WORKDIR /app
ENV ASTRO_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci
COPY astro.config.mjs tsconfig.json ./
COPY src ./src
COPY public ./public
COPY assets/fonts ./assets/fonts
RUN npm run build && npm prune --omit=dev

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4321 FOLIOECHO_HOSTED=0 FOLIOECHO_DATA_DIR=/app/.folioecho ASTRO_TELEMETRY_DISABLED=1
LABEL org.opencontainers.image.source="https://github.com/StavrosKa/folioecho" \
      org.opencontainers.image.title="FolioEcho" \
      org.opencontainers.image.description="Bookshop catalogue intelligence and cultural event planning" \
      org.opencontainers.image.licenses="ISC"
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/assets/fonts ./assets/fonts
COPY --chown=node:node LICENSE ./LICENSE
RUN mkdir -p /app/.folioecho /app/.astro/sessions && chown -R node:node /app/.folioecho /app/.astro
USER node
VOLUME ["/app/.folioecho"]
EXPOSE 4321
CMD ["node", "dist/server/entry.mjs"]
