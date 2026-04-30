# vagas-bot

Bot de vagas tech com scrapers, deduplicacao, webhook de eventos e envio para Discord/WhatsApp.

## Arquitetura

```text
apps/worker-scraper  ->  jobs.created webhook  ->  apps/bots  ->  Discord / WhatsApp
                                             |
                                             v
                                      MongoDB dedupe/status
```

- `apps/worker-scraper`: busca vagas nas fontes, normaliza, deduplica localmente e emite `jobs.created`.
- `apps/bots`: recebe `POST /webhooks/jobs`, salva a vaga, evita duplicidade e envia para os canais configurados.
- `apps/api`: API separada para um frontend futuro.
- `packages/core`: tipos, dedupe, normalizacao compartilhada e contrato dos eventos.
- `packages/sources`: scrapers/parsers por fonte.

## Evento `jobs.created`

O worker envia para `WEBHOOK_URL`:

```json
{
  "event": "jobs.created",
  "data": {
    "job": {
      "source": "meupadrinho",
      "externalId": "123",
      "title": "Pessoa Desenvolvedora Backend",
      "company": "Acme",
      "location": "Remoto",
      "workMode": "remote",
      "seniority": "mid",
      "url": "https://example.com/job/123",
      "description": "Node.js e TypeScript",
      "stack": ["node", "typescript"],
      "scrapedAt": "2026-04-30T12:00:00.000Z"
    }
  }
}
```

Se `WEBHOOK_SECRET` estiver definido, o worker envia o header `x-webhook-secret` e o app de bots exige o mesmo valor.

## Rodar localmente

```bash
npm install
cp .env.example .env
npm start
```

Em outro terminal, rode o worker:

```bash
npm run worker
```

Comandos uteis:

```bash
npm run dev          # bots + worker em watch mode
npm run api          # API futura para frontend
npm test
npm run typecheck
npm run audit:remotar
npm run audit:gupy
```

## Variaveis principais

- `MONGODB_URI`: string de conexao MongoDB.
- `WEBHOOK_URL`: URL do bot, normalmente `https://SEU-SERVICO.onrender.com/webhooks/jobs`.
- `WEBHOOK_SECRET`: segredo compartilhado entre worker e bot.
- `JOB_SOURCES`: fontes ativas no worker. Padrao: `meupadrinho`. Para testes amplos: `meupadrinho,remotar,gupy`.
- `MEUPADRINHO_MAX_PAGES`: quantidade de paginas da fonte Meu Padrinho por ciclo. Padrao: `3`.
- `DISCORD_ENABLED`: habilita envio Discord. Padrao: `true`.
- `WHATSAPP_ENABLED`: habilita conexao/envio WhatsApp. Padrao local recomendado: `false`.
- `MOBILE_NUMBER`: telefone usado no pareamento WhatsApp.
- `WHATSAPP_GROUP_ID`: grupo de destino.
- `DISCORD_TOKEN` e `DISCORD_CHANNEL_ID`: destino Discord.

## Fontes

- `meupadrinho`: fonte padrao e prioritaria. Usa a API publica `GET /api/vagas?page=N` e busca detalhe em `GET /api/vagas/:nano_id` para capturar descricao, requisitos, contrato, salario e link real da vaga.
- `remotar`: fonte complementar, opt-in via `JOB_SOURCES`.
- `gupy`: fonte de volume, opt-in via `JOB_SOURCES`.

## Deploy

O `Dockerfile` sobe `npm start`, que inicia `apps/bots`.

No Render, `render.yaml` define:

- `vagas-bot-bots`: web service com healthcheck em `/health`.
- `vagas-bot-worker`: cron job que executa `npm run worker`.

Depois do deploy dos bots, configure `WEBHOOK_URL` no cron com:

```text
https://SEU-SERVICO.onrender.com/webhooks/jobs
```

## WhatsApp

WhatsApp pode ficar desligado enquanto o webhook e Discord sao validados:

```text
WHATSAPP_ENABLED=false
```

Para habilitar, defina `WHATSAPP_ENABLED=true` e depois de iniciar o app de bots abra:

```text
/whatsapp/pairing
```

O alias antigo `/codigo` continua redirecionando para essa rota.
