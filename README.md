# vagas-bot

Scraper inicial de vagas com foco em tecnologia, usando Remotar e Gupy como primeiras fontes.

## Rodar

```bash
npm install
npm run scrape
```

Por padrão o worker busca 1 página da API pública da Remotar e 1 página por palavra-chave na API pública da Gupy. Depois filtra vagas de tecnologia, deduplica e salva o JSON normalizado em `output/scraper/jobs.json`.

No JSON normalizado, `url` é o link direto de candidatura quando a fonte fornece esse dado. O worker exporta `JobDTO` limpo, sem `raw`, `applyUrl` duplicado, `categories` ou salário bruto. As auditorias ainda salvam o bruto separado para revisão de filtros.

Filtro atual:

- Remotar: já chama a API com categorias tech (`Data Science / Analytics`, `UX/UI`, `DevOps`, `QA`, `SysAdmin`, `Programação`, `Programação Mobile`) e ainda valida o título para evitar falsos positivos em categorias amplas.
- Gupy: busca por palavras-chave tech, ignora vagas com `applicationDeadline` vencido e classifica principalmente pelo título da vaga. Descrição não aprova vaga sozinha para evitar RH, marketing, marketplace e vendas com termos digitais.

Auditorias:

```bash
npm run audit:remotar
npm run audit:gupy
```

Elas salvam bruto, filtrado, removidos suspeitos e resumo em `output/scraper/audit-remotar/` e `output/scraper/audit-gupy/`.

## Verificação

```bash
npm test
npm run typecheck
```
