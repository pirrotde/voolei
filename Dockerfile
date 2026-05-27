# Dockerfile para Vôlei dos amigos 🏐
FROM node:22-alpine

WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./

# Remover package-lock.json para forçar resolução correta de binários Alpine
RUN rm -f package-lock.json

# Instalar dependências
RUN npm install

# Forçar instalação de binários nativos para Alpine Linux
RUN npm install --force @rollup/rollup-linux-x64-musl || true
RUN npm install --force lightningcss-linux-x64-musl || true

# Verificar se mysql2 foi instalado
RUN ls node_modules/ | grep mysql2 && echo "✅ mysql2 instalado!" || echo "❌ mysql2 NÃO instalado!"

# Copiar código fonte (node_modules já está no .dockerignore, não será copiado)
COPY . .

# Garantir que node_modules não foi sobrescrito
RUN ls node_modules/ | grep mysql2 && echo "✅ mysql2 ainda presente!" || echo "❌ mysql2 sumiu!"

# Expor portas
EXPOSE 8080 3001

# Comando padrão (será sobrescrito no docker-compose)
CMD ["npm", "run", "dev"]
