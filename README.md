# 🚀 Vagas Bot - Juninhos

Um bot e scraper criado com carinho para a comunidade **Juninhos**.  
O objetivo desse projeto é capturar automaticamente vagas da área de tecnologia de diversas fontes e enviar notificações fresquinhas direto no nosso grupo do WhatsApp e Discord.

## 🛠️ Stack Principal

- **Node.js & TypeScript:** O coração de tudo.
- **MongoDB (Mongoose):** Banco de dados para salvar as vagas, evitar envios duplicados e gerenciar sessões do bot.
- **Baileys:** Biblioteca usada para conectar e interagir com o WhatsApp via Web Socket.
- **Discord.js:** Integração opcional para enviar as vagas também em um servidor do Discord.
- **Express:** Servidor web simples para receber webhooks do scraper e servir as rotas de status/pareamento do WhatsApp.
- **Render:** Projeto já configurado (via `render.yaml`) para deploy fácil usando Web Services e Cron Jobs.

## 🏗️ Como Funciona?

1. **Worker Scraper:** Um processo isolado que varre portais de emprego (MeuPadrinho, Remotar, Gupy) buscando vagas de tecnologia.
2. **Deduplicação:** As vagas encontradas são processadas, formatadas e salvas no MongoDB para garantir que a mesma vaga não seja enviada duas vezes.
3. **Webhook:** O scraper dispara um evento (via requisição POST) para o nosso Bot.
4. **Entrega:** O Bot recebe a vaga e dispara as mensagens formatadas nos canais configurados (WhatsApp e/ou Discord).

## 💻 Como Rodar Localmente

### 1. Preparando o ambiente

Clone o repositório, instale as dependências e configure suas variáveis de ambiente:

```bash
npm install
cp .env.example .env
```

Abra o arquivo `.env` e preencha com as suas informações (Principalmente a sua URL do MongoDB e credenciais do Discord/WhatsApp).

### 2. Pareando o WhatsApp (Opcional)

Se você for usar o bot no WhatsApp, certifique-se de que o `.env` tem:

```env
WHATSAPP_ENABLED=true
AUTH_METHOD=code
MOBILE_NUMBER=5511999999999 # Seu número de telefone com DDD
```

Inicie o bot:

```bash
npm start
```

Acesse `http://localhost:3000/codigo` no seu navegador para pegar o código e vincule no seu WhatsApp (Aparelhos Conectados > Conectar com número de telefone).

Após conectar, pegue o ID do grupo na rota `http://localhost:3000/whatsapp/groups` e coloque no seu `.env` na variável `WHATSAPP_GROUP_ID`. Depois disso pode reiniciar o bot.

### 3. Rodando o Projeto Completo

Para o desenvolvimento, você pode rodar tanto o Bot quanto o Scraper ao mesmo tempo em modo de observação (watch):

```bash
npm run dev
```

Se quiser rodar o scraper apenas uma vez para testar a busca e disparo:

```bash
npm run worker:once
```

## ☁️ Deploy

O projeto já contém um arquivo `render.yaml` otimizado. No painel do Render.com, basta conectar seu repositório que ele vai criar:

- Um **Web Service** para a API e o Bot do WhatsApp/Discord.
- Um **Cron Job** que roda o Scraper automaticamente a cada 2 horas buscando novas vagas.

## 👥 Contribuições

Projeto desenvolvido em colaboração com divisão de responsabilidades:

- Tayron Silva — Bots  
  - Integração com WhatsApp (Baileys) e Discord  
  - Distribuição automatizada de vagas  
  - Desenvolvimento direto do bot

- danitsdev — Scraping e deduplicação  
  - Coleta de vagas de múltiplas fontes  
  - Processamento e filtragem de dados duplicados  

- YuukoDev — Backend e camada de dados  
  - Modelagem do banco de dados (MongoDB)  
  - Desenvolvimento da API REST
