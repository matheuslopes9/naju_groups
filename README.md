# Naju Groups

Dashboard pessoal multi-workspace pra curadoria de ofertas do Mercado Livre
Afiliados e envio assistido em grupos de WhatsApp.

> **Modelo semi-automático por escolha**: bot busca, filtra e te entrega
> ofertas pendentes; **você aprova** uma a uma pelo dashboard, e só então o
> bot envia ao grupo de staging. Atende às cláusulas 1.8, 1.9 e 7.3 dos
> Termos do programa de Afiliados ML (sem distribuição automática de links,
> sem shorteners de terceiros).

## Stack

- **Backend**: Node 20 + Express + Prisma + PostgreSQL + WebSocket
- **WhatsApp**: @whiskeysockets/baileys (multi-sessão, uma por workspace)
- **Frontend**: React 18 + Vite + Tailwind + React Router
- **Auth**: senha única via env + cookie de sessão
- **OAuth ML**: authorization_code com refresh automático

## Conceito: Workspace = 1 nicho

Cada workspace tem:
- **1 número de WhatsApp** dedicado (sessão isolada do Baileys)
- **N grupos** cadastrados (staging para curadoria)
- **Filtros próprios** de busca (categoria, % desconto, frete grátis)
- **Inbox de ofertas pendentes** pra você aprovar/rejeitar

```
Workspace "Beauty"  ─►  📱 (11) 9X-X  ─►  Grupos: Skincare BR
Workspace "Tech"    ─►  📱 (11) 9Y-Y  ─►  Grupos: Gadget Deals
Workspace "Casa"    ─►  📱 (11) 9Z-Z  ─►  Grupos: Decor Brasil
```

## Endpoints

| Rota | Descrição |
|---|---|
| `GET /healthz` | Health check (público) |
| `GET /ml/callback?code=…` | OAuth callback do ML (público) |
| `POST /api/auth/login` | Login (body: `{password}`) |
| `POST /api/auth/logout` | Logout |
| `GET /api/auth/me` | Status de sessão |
| `GET /api/ml/status` | Status OAuth ML |
| `GET /ml/authorize` | Inicia autorização ML (público — redireciona pro ML) |
| `GET /ml/callback` | Callback OAuth (público) |
| `GET /api/ml/app` | Lê config do app ML (nunca retorna secret) |
| `POST /api/ml/app` | Salva config do app ML (secret criptografado) |
| `GET /api/workspaces` | Lista workspaces |
| `POST /api/workspaces` | Cria workspace |
| `GET/PATCH/DELETE /api/workspaces/:id` | CRUD |
| `POST /api/workspaces/:id/whatsapp/connect` | Inicia conexão Baileys |
| `POST /api/workspaces/:id/whatsapp/disconnect` | Logout do WA |
| `GET /api/workspaces/:id/whatsapp/groups` | Grupos no WA |
| `POST /api/workspaces/:id/groups` | Cadastra grupo |
| `POST /api/workspaces/:id/search` | Busca manual |
| `GET /api/workspaces/:id/offers?status=pending` | Inbox |
| `POST /api/workspaces/:id/offers/:oid/approve` | Aprova e envia |
| `POST /api/workspaces/:id/offers/:oid/reject` | Rejeita |
| `WS /ws` | WebSocket: updates de QR/status |

## Deploy no EasyPanel

### 1. Criar serviço Postgres
- EasyPanel → **+ Serviço** → **Postgres**
- Anote a connection string interna (vai como `DATABASE_URL`)

### 2. Criar serviço App
- **+ Serviço** → **App** → conectar ao repo GitHub `matheuslopes9/naju_groups`
- **Build**: Dockerfile (detecta automaticamente)
- **Porta**: 3000
- **Domínio**: `najubeautyclub.azespo.com.br` (já configurado)
- **Volume Mount**: `auth-state` → `/app/auth_state`

### 3. Variáveis de ambiente

```env
DATABASE_URL=postgresql://...        # do serviço Postgres
DASHBOARD_PASSWORD=sua-senha-forte
ML_CLIENT_ID=                        # após criar app ML
ML_CLIENT_SECRET=
ML_REDIRECT_URI=https://najubeautyclub.azespo.com.br/ml/callback
ML_AFFILIATE_TAG=najubeautyclub
```

### 4. Primeiro deploy
1. Implantar — Dockerfile cuida do `prisma migrate deploy` automaticamente
2. Abrir `https://najubeautyclub.azespo.com.br` → tela de login
3. Entrar com `DASHBOARD_PASSWORD`
4. **Criar app no ML Developers** (https://developers.mercadolivre.com.br/devcenter)
   - Redirect URI: `https://najubeautyclub.azespo.com.br/ml/callback`
   - Escopo: `read`
   - Cole Client ID e Secret nas envs e redeploy
5. Clicar em "Autorizar agora" no banner do dashboard
6. Criar primeiro workspace → conectar WhatsApp via QR → cadastrar grupos

## Desenvolvimento local

```powershell
Copy-Item .env.example .env   # preencha DATABASE_URL apontando pra um Postgres local
npm install
npm run prisma:migrate
npm start                     # backend em :3000
npm run frontend:dev          # frontend em :5173 (proxy → :3000)
```

## Estrutura

```
src/server/
  index.js           # entry: Express + WebSocket + worker
  db.js              # PrismaClient
  auth.js            # senha única + cookie + sessões
  worker.js          # loop de busca automática
  formatter.js       # texto de oferta (com #publi)
  ml/
    oauth.js         # OAuth ML com refresh persistido no DB
    search.js        # GET /sites/MLB/search com Bearer
    affiliate.js     # tag matt_word/matt_tool ou simples
    search-cli.js    # CLI de teste
  whatsapp/
    manager.js       # multi-sessão Baileys + EventEmitter
  routes/
    auth.js
    workspaces.js
    ml.js
frontend/
  src/
    main.jsx, App.jsx, index.css
    api.js           # cliente fetch
    pages/           # Login, Dashboard, WorkspaceDetail
    components/      # Layout, MLStatus, WhatsAppPanel, GroupsPanel, FiltersPanel, OffersPanel, WorkspaceForm
prisma/
  schema.prisma
```

## Conformidade legal (resumo)

Os Termos do programa de Afiliados ML (cláusulas relevantes):
- **1.3** — mídia deve estar cadastrada/aprovada no portal
- **1.6** — janela de atribuição de 24h
- **1.8** — proibido shortener de terceiros (só permalink/tag oficial)
- **1.9** — proibido "software client-side para distribuição de links"
- **5.1** — anúncios precisam ser identificados como publicidade (CONAR)
- **7.3** — proibido disparo massivo

**O que este sistema faz pra ficar dentro:**
- Não posta nada automaticamente — toda mensagem exige aprovação humana
- Anexa apenas `matt_word`/`matt_tool` no permalink (nunca shortener)
- Inclui `#publi` em todos os cards (CONAR)
- Envia somente a **grupos de staging seus** (não dispara em massa)
- Você assume operacionalmente o último clique → "voluntário e consciente"

Use com bom-senso. Os Termos do ML mudam, releia periodicamente.
