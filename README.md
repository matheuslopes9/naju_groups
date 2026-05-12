# Naju Groups Bot

Bot semi-automático que coleta ofertas do Mercado Livre via API oficial,
anexa sua tag de afiliado e entrega num **grupo de staging** do WhatsApp
para curadoria manual antes de você postar no grupo de divulgação.

> Por que semi-auto? Os Termos do programa de Afiliados ML (cláusulas 1.8,
> 1.9 e 7.3) proíbem distribuição automática de links e shorteners de
> terceiros. O bot busca, filtra e te entrega — você revisa, gera o link
> oficial no portal e posta com #publi.

## Arquitetura

```
[ML API /sites/MLB/search] ─► filtros ─► anexa tag ─► [WhatsApp staging] ─► VOCÊ posta
        ▲                                                    ▲
        │ OAuth Bearer                                        │ Baileys (QR via /qr)
        │ (refresh automático)                                │
```

Endpoints HTTP do bot (porta `3000`):

- `GET /qr` — exibe QR code do WhatsApp pra escanear
- `GET /ml/authorize` — inicia OAuth do Mercado Livre
- `GET /ml/callback` — recebe code e salva token
- `GET /healthz` — health check

## Stack

- Node.js 20+ (ESM)
- Express (servidor HTTP)
- @whiskeysockets/baileys (WhatsApp)
- API oficial do Mercado Livre com OAuth `authorization_code`

## Pré-requisitos

1. **Tag de afiliado** — pegue em https://afiliados.mercadolivre.com.br (campo "Etiqueta em uso")
2. **App no ML Developers** — crie em https://developers.mercadolivre.com.br/devcenter
   - Redirect URI: `https://SEU_DOMINIO/ml/callback`
   - Escopo: `read`
3. **Chip de WhatsApp separado** — não use seu pessoal
4. **VPS com EasyPanel** + domínio público (necessário pro OAuth do ML)

## Deploy no EasyPanel

1. **Faça push deste repo para o GitHub.**

2. **No EasyPanel**, crie um novo serviço a partir do GitHub apontando pra branch `main`.

3. **Configure as variáveis de ambiente** (copie do `.env.example`):
   ```
   ML_CLIENT_ID=...
   ML_CLIENT_SECRET=...
   ML_REDIRECT_URI=https://SEU_DOMINIO/ml/callback
   ML_AFFILIATE_TAG=najubeautyclub
   WA_STAGING_GROUP_JID=
   MIN_DISCOUNT_PERCENT=20
   ```

4. **Monte volume persistente** em `/app/auth_state` (essencial — guarda sessão
   do WhatsApp e tokens OAuth do ML; sem isso você reescaneia QR a cada deploy).

5. **Exponha porta 3000** e habilite o domínio.

6. **Primeira inicialização** — em ordem:
   - Acesse `https://SEU_DOMINIO/qr` no navegador → escaneie com WhatsApp do bot
   - Crie um grupo de staging no WhatsApp, adicione o bot, e descubra o JID:
     ```
     # nos logs do EasyPanel, conecte por shell e rode:
     npm run wa:list-groups
     ```
     Cole o JID em `WA_STAGING_GROUP_JID` e reinicie o serviço.
   - Acesse `https://SEU_DOMINIO/ml/authorize` → login ML → autoriza app
   - Token fica salvo em `/app/auth_state/ml-token.json` e renova sozinho

7. **Teste fim-a-fim**:
   ```
   npm run test:post
   ```

## Desenvolvimento local

```powershell
Copy-Item .env.example .env   # preencha as variáveis
npm install
npm start                     # sobe HTTP + WhatsApp
```

Pra OAuth local, mantenha `ML_REDIRECT_URI=http://localhost:3000/ml/callback`
e cadastre **exatamente essa URL** no app do ML Developers (você pode ter
mais de uma redirect URI no mesmo app — adicione a local e a de produção).

## Scripts

| Comando | O que faz |
|---|---|
| `npm start` | Sobe servidor HTTP + WhatsApp (modo produção) |
| `npm run wa:list-groups` | Lista grupos do bot com JIDs |
| `npm run search -- "termo"` | Busca ofertas no terminal (não envia) |
| `npm run test:post` | Busca e envia top-N ofertas no grupo de staging |

## Estrutura

```
src/
  ml/
    oauth.js          # fluxo OAuth + refresh automático
    search.js         # busca produtos com Bearer token
    search-cli.js     # CLI standalone pra testar busca
    affiliate.js      # anexa matt_word/matt_tool ou tag na URL
  whatsapp/
    client.js         # Baileys + expõe QR pro servidor HTTP
    list-groups.js    # CLI lista grupos
  formatter.js        # monta cartão de revisão (com #publi)
  server.js           # Express: /qr, /ml/authorize, /ml/callback
  test-post.js        # CLI: busca + envia ao staging
  index.js            # entrypoint (servidor + WhatsApp)
auth_state/           # NÃO COMMITAR — credenciais persistidas
```

## Roadmap

- [x] Esqueleto + Baileys + QR remoto
- [x] OAuth ML com refresh automático
- [x] Coletor de ofertas com filtros
- [x] Cartão de revisão pro staging
- [x] Dockerfile pra EasyPanel
- [ ] Cache anti-duplicata (SQLite)
- [ ] Agendador interno (rodar a cada N horas)
- [ ] Comandos no WhatsApp ("/buscar fone", "/desconto 30")
