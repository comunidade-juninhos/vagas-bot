RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends git && \
    rm -rf /var/lib/apt/lists/*FROM node:20-slim

# Instala o git para compatibilidade
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copia arquivos de dependência
COPY package*.json ./
COPY tsconfig.json ./

# Instala dependências de produção e desenvolvimento
RUN npm ci

# Copia o resto do código
COPY . .

# Hugging Face Spaces usa a porta 7860 por padrão, mas aceita customização via env PORT
ENV PORT=7860
EXPOSE 7860

# Comando para rodar o bot e o scraper juntos
CMD ["npx", "concurrently", "-n", "BOTS,SCRAPER", "-c", "blue,green", "npm run start", "npm run worker"]
