FROM node:20-slim

# Instala o git para compatibilidade
RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends git && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copia arquivos de dependência
COPY package*.json ./
COPY tsconfig.json ./

# Instala dependências (inclui devDependencies pois usamos tsx diretamente)
RUN npm ci

# Copia o resto do código
COPY . .

# Hugging Face Spaces usa a porta 7860
ENV PORT=7860
EXPOSE 7860

# Roda o bot (Discord/WhatsApp) e o scraper juntos
CMD ["npx", "concurrently", "-n", "BOTS,SCRAPER", "-c", "blue,green", "npm run start", "npm run worker"]
