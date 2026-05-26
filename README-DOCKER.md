# Docker Setup - Vôlei dos amigos 🏐

Este guia explica como executar a aplicação usando Docker Compose.

## Pré-requisitos

- Docker instalado
- Docker Compose instalado

## Duas Opções de Deploy

### Opção 1: Com Banco de Dados Local (docker-compose.yml)
Cria um container MariaDB local - ideal para desenvolvimento isolado ou testes.

### Opção 2: Com Banco de Dados Remoto (docker-compose.remote-db.yml)
Usa um banco de dados remoto existente - ideal para produção quando você já tem infraestrutura de banco.

---

## Como executar

### 1a. Usando BANCO LOCAL (desenvolvimento/testes)

```bash
docker-compose up -d
```

Este comando irá criar:
- Container MariaDB local (porta 3306)
- Container API Express (porta 3001)
- Container Frontend Vite (porta 8080)

### 1b. Usando BANCO REMOTO (produção - recomendado)

Se você já tem um banco MariaDB em outra máquina (ex: 207.58.175.4):

1. Certifique-se que o `.env` está configurado:
```bash
DB_HOST=207.58.175.4
DB_PORT=3306
DB_USER=volei
DB_PASSWORD=volei2025
DB_NAME=volei
```

2. Suba apenas API e Frontend:
```bash
docker-compose -f docker-compose.remote-db.yml up -d
```

Este comando irá criar apenas:
- Container API Express (porta 3001) - conecta ao banco remoto
- Container Frontend Vite (porta 8080)

### 2. Acessar a aplicação

Abra seu navegador em: http://localhost:8080

### 3. Ver logs

**Com banco local:**
```bash
docker-compose logs -f                    # todos os serviços
docker-compose logs -f api                # apenas API
docker-compose logs -f frontend           # apenas Frontend
docker-compose logs -f db                 # apenas Database
```

**Com banco remoto:**
```bash
docker-compose -f docker-compose.remote-db.yml logs -f
docker-compose -f docker-compose.remote-db.yml logs -f api
docker-compose -f docker-compose.remote-db.yml logs -f frontend
```

### 4. Parar os serviços

**Com banco local:**
```bash
docker-compose down              # para os containers
docker-compose down -v           # para e apaga o banco local
```

**Com banco remoto:**
```bash
docker-compose -f docker-compose.remote-db.yml down
```

## Qual opção usar?

| Cenário | Arquivo | Quando Usar |
|---------|---------|-------------|
| **Desenvolvimento local** | `docker-compose.yml` | Você quer testar sem afetar o banco de produção |
| **Testes isolados** | `docker-compose.yml` | Cada desenvolvedor com seu próprio banco |
| **Produção** | `docker-compose.remote-db.yml` | ✅ **RECOMENDADO** - Banco já existe em 207.58.175.4 |
| **Staging** | `docker-compose.remote-db.yml` | Usa o mesmo banco que produção |

## Estrutura dos Serviços

### Banco de Dados (MariaDB)
**Apenas em `docker-compose.yml`**
- **Container**: volei-db
- **Porta**: 3306
- **Credenciais**:
  - Usuário: volei
  - Senha: volei2025
  - Database: volei

### API (Express)
**Em ambos os arquivos**
- **Container**: volei-api
- **Porta**: 3001
- **Comando**: `npm run api`
- **Conecta em**: DB local OU remoto (depende do .env)

### Frontend (Vite)
**Em ambos os arquivos**
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
