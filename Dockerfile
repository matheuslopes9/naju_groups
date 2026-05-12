# ---------- Estágio 1: build do frontend ----------
FROM node:20-alpine AS frontend-builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY vite.config.js ./
COPY frontend ./frontend
RUN npm run frontend:build

# ---------- Estágio 2: produção ----------
FROM node:20-alpine AS runtime
WORKDIR /app

# Deps de produção
COPY package*.json ./
RUN npm ci --omit=dev

# Código do servidor + schema + frontend buildado
COPY prisma ./prisma
COPY src ./src
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Gera Prisma client
RUN npx prisma generate

RUN mkdir -p /app/auth_state

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Aplica migrations antes de iniciar
CMD ["sh", "-c", "npx prisma migrate deploy && node src/server/index.js"]
