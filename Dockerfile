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

RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

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

# Aplica migrations antes de iniciar
CMD ["sh", "-c", "npx prisma migrate deploy && node src/server/index.js"]
