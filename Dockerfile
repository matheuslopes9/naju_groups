FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

COPY . .

# auth_state guarda credenciais do WhatsApp e token OAuth do ML.
# Em produção monte um volume persistente em /app/auth_state.
RUN mkdir -p /app/auth_state

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", "src/index.js"]
