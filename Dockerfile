# Dockerfile para Vôlei dos amigos 🏐
FROM node:22-alpine

WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./

# Instalar dependências
RUN npm install

# Forçar instalação do Rollup para Alpine Linux
RUN npm install --force @rollup/rollup-linux-x64-musl || true

# Copiar código fonte
COPY . .

# Expor portas
EXPOSE 8080 3001

# Comando padrão (será sobrescrito no docker-compose)
CMD ["npm", "run", "dev"]
