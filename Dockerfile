# ---------- Estágio 1: build do frontend ----------
FROM node:20-bookworm-slim AS frontend-builder
WORKDIR /app

# OpenSSL pro Prisma engine
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY vite.config.js postcss.config.js tailwind.config.js ./
COPY frontend ./frontend
COPY prisma ./prisma
RUN npx prisma generate && npm run frontend:build

# ---------- Estágio 2: produção ----------
FROM node:20-bookworm-slim AS runtime
WORKDIR /app

# OpenSSL pro Prisma + Chromium pro Playwright (headless gera shortlinks ML)
RUN apt-get update -y && apt-get install -y \
    openssl ca-certificates \
    chromium fonts-liberation libnss3 libatk1.0-0 libatk-bridge2.0-0 \
    libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 \
    libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2 \
    && rm -rf /var/lib/apt/lists/*

ENV CHROMIUM_PATH=/usr/bin/chromium

# Deps de produção
COPY package*.json ./
RUN npm ci --omit=dev

# Schema, código do servidor e frontend buildado
COPY prisma ./prisma
COPY src ./src
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist
COPY --from=frontend-builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=frontend-builder /app/node_modules/@prisma ./node_modules/@prisma

# Regenera client com os engines corretos pro target final
RUN npx prisma generate

RUN mkdir -p /app/auth_state

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Healthcheck: bate em /healthz a cada 5min. 503 = sistema travado (varredura
# parou ha mais de 12h, scheduler quebrou, etc) → Docker reinicia o container.
# start-period=180s da tempo do servidor subir + primeira varredura rodar
# (caso seja primeira execucao sem lastSweepAt).
HEALTHCHECK --interval=5m --timeout=10s --start-period=180s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/healthz').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# Aplica migrations antes de iniciar
CMD ["sh", "-c", "npx prisma migrate deploy && node src/server/index.js"]
