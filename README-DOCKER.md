# Docker Setup - Vôlei dos amigos 🏐

Este guia explica como executar a aplicação usando Docker Compose.

## Pré-requisitos

- Docker instalado
- Docker Compose instalado

## Como executar

### 1. Iniciar todos os serviços

```bash
docker-compose up -d
```

Este comando irá:
- Criar e iniciar o banco de dados MariaDB (porta 3306)
- Criar e iniciar o servidor API Express (porta 3001)
- Criar e iniciar o frontend Vite (porta 8080)

### 2. Acessar a aplicação

Abra seu navegador em: http://localhost:8080

### 3. Ver logs

Para ver os logs de todos os serviços:
```bash
docker-compose logs -f
```

Para ver logs de um serviço específico:
```bash
docker-compose logs -f api
docker-compose logs -f frontend
docker-compose logs -f db
```

### 4. Parar os serviços

```bash
docker-compose down
```

Para parar e remover os volumes (apaga o banco de dados):
```bash
docker-compose down -v
```

## Estrutura dos Serviços

### Banco de Dados (MariaDB)
- **Container**: volei-db
- **Porta**: 3306
- **Credenciais**:
  - Usuário: volei
  - Senha: volei2025
  - Database: volei

### API (Express)
- **Container**: volei-api
- **Porta**: 3001
- **Comando**: `npm run api`

### Frontend (Vite)
- **Container**: volei-frontend
- **Porta**: 8080
- **Comando**: `npm run dev`

## Troubleshooting

### Porta já em uso
Se alguma porta já estiver em uso, você pode alterar no `docker-compose.yml`:
```yaml
ports:
  - "NOVA_PORTA:PORTA_INTERNA"
```

### Reconstruir as imagens
Se você fez alterações no código e quer reconstruir:
```bash
docker-compose build
docker-compose up -d
```

### Conectar ao banco de dados
```bash
docker exec -it volei-db mysql -u volei -pvolei2025 volei
```

## Deploy Automático via GitHub Actions

Este projeto inclui uma pipeline de CI/CD que faz deploy automático para o servidor quando você faz push na branch `main`.

### Configuração

1. Configure os secrets no GitHub (veja `GITHUB-SECRETS.md`)
2. Faça push para a branch `main`
3. O deploy acontece automaticamente!

Você também pode executar manualmente:
- Vá em **Actions** > **Deploy Vôlei dos amigos** > **Run workflow**

### O que a pipeline faz

1. Empacota os arquivos necessários
2. Envia para o servidor via SSH
3. Cria o arquivo `.env` com os secrets configurados
4. Constrói as imagens Docker
5. Sobe os containers
6. Faz health check de todos os serviços

### Monitorar o deploy

Acompanhe o progresso em: **Actions** > Último workflow executado

### Mais informações

Consulte `GITHUB-SECRETS.md` para detalhes completos sobre:
- Configuração de secrets
- Troubleshooting
- Comandos úteis no servidor

## Desenvolvimento

Para desenvolvimento local sem Docker, use o arquivo `.env` com as configurações do banco de dados remoto.

Para produção com Docker, as variáveis de ambiente estão configuradas no `docker-compose.yml` ou criadas automaticamente pela pipeline de deploy.
