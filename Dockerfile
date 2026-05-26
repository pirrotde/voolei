# Dockerfile para Vôlei dos amigos 🏐
FROM node:20-alpine

# Instalar dependências do sistema
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./

# Instalar dependências
RUN npm install

# Copiar código fonte
COPY . .

# Build da aplicação
RUN npm run build

# Expor portas
EXPOSE 8080 3001

# Comando padrão (será sobrescrito no docker-compose)
CMD ["npm", "run", "dev"]
