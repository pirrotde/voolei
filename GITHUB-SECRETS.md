# GitHub Secrets - Vôlei dos amigos 🏐

Este documento lista todos os secrets necessários para configurar o deploy automático via GitHub Actions.

## Como configurar os Secrets

1. Acesse seu repositório no GitHub
2. Vá em **Settings** > **Secrets and variables** > **Actions**
3. Clique em **New repository secret**
4. Adicione cada secret listado abaixo

## Secrets Obrigatórios

### Servidor SSH
| Nome | Descrição | Exemplo |
|------|-----------|---------|
| `SSH_HOST` | IP ou hostname do servidor | `207.58.175.4` |
| `SSH_USER` | Usuário SSH | `root` ou `ubuntu` |
| `SSH_PASSWORD` | Senha SSH | `sua_senha_segura` |
| `SSH_PORT` | Porta SSH (opcional, padrão: 22) | `22` |

### Domínio e SSL
| Nome | Descrição | Exemplo |
|------|-----------|---------|
| `VOLEI_DOMAIN` | Domínio da aplicação | `volei.example.com` |
| `DEFAULT_EMAIL` | Email para certificado SSL | `admin@example.com` |

### Banco de Dados
| Nome | Descrição | Exemplo |
|------|-----------|---------|
| `MYSQL_ROOT_PASSWORD` | Senha root do MariaDB | `rootpassword_123` |
| `MYSQL_DATABASE` | Nome do banco de dados | `volei` |
| `MYSQL_USER` | Usuário do banco | `volei` |
| `MYSQL_PASSWORD` | Senha do usuário | `volei2025` |

### Configurações Opcionais
| Nome | Descrição | Padrão |
|------|-----------|--------|
| `DB_HOST` | Host do banco (dentro do Docker) | `db` |
| `DB_PORT` | Porta do banco | `3306` |

## Exemplo de Configuração

```bash
# Servidor SSH
SSH_HOST=207.58.175.4
SSH_USER=root
SSH_PASSWORD=SenhaSegura123!
SSH_PORT=22

# Domínio
VOLEI_DOMAIN=volei.proativeinfra.com.br
DEFAULT_EMAIL=admin@proativeinfra.com.br

# Database
MYSQL_ROOT_PASSWORD=root_password_super_secret
MYSQL_DATABASE=volei
MYSQL_USER=volei
MYSQL_PASSWORD=volei2025

# Opcional (use os padrões se não configurar)
DB_HOST=db
DB_PORT=3306
```

## Workflow do Deploy

O deploy é acionado automaticamente quando você:
- Faz push na branch `main`
- Ou executa manualmente em: **Actions** > **Deploy Vôlei dos amigos** > **Run workflow**

## Passo a Passo do Deploy

1. **Checkout do código** - Baixa o código do repositório
2. **Cria pacote de deploy** - Empacota arquivos necessários
3. **Envia via SSH** - Transfere arquivos para o servidor
4. **Cria arquivo .env** - Configura variáveis de ambiente
5. **Build das imagens** - Constrói containers Docker
6. **Sobe os serviços** - Inicia Database, API e Frontend
7. **Health check** - Verifica se tudo está funcionando

## Estrutura no Servidor

Após o deploy, a aplicação estará em:
```
/opt/volei/
├── docker-compose.yml
├── Dockerfile
├── .dockerignore
├── schema.sql
├── package.json
├── package-lock.json
├── .env (criado automaticamente)
└── (outros arquivos do projeto)
```

## Portas Expostas

| Serviço | Porta | Descrição |
|---------|-------|-----------|
| MariaDB | 3306 | Banco de dados |
| API | 3001 | Backend Express |
| Frontend | 8080 | Interface Vite |

## Comandos Úteis no Servidor

```bash
# Ver status dos containers
cd /opt/volei
docker ps --filter "name=volei"

# Ver logs
docker logs volei-db
docker logs volei-api
docker logs volei-frontend

# Parar todos os serviços
docker-compose -p volei down

# Reiniciar serviços
docker-compose -p volei restart

# Ver logs em tempo real
docker-compose -p volei logs -f
```

## Troubleshooting

### Deploy falhou
1. Verifique se todos os secrets estão configurados
2. Confira os logs em: **Actions** > Último workflow executado
3. Teste a conexão SSH manualmente

### Database não inicia
```bash
# Ver logs detalhados
docker logs volei-db --tail=100

# Verificar health check
docker inspect volei-db | grep -A 10 Health
```

### API não conecta ao banco
```bash
# Verificar variáveis de ambiente da API
docker exec volei-api env | grep DB_

# Testar conexão ao banco
docker exec volei-db mysqladmin ping -h localhost
```

### Frontend não carrega
```bash
# Verificar se o Vite está rodando
docker logs volei-frontend --tail=50

# Verificar se a porta 8080 está acessível
curl http://localhost:8080
```

## Segurança

- NUNCA commite o arquivo `.env` com senhas reais
- Use senhas fortes para `MYSQL_ROOT_PASSWORD` e `MYSQL_PASSWORD`
- Configure firewall no servidor para permitir apenas portas necessárias
- Considere usar chaves SSH ao invés de senha (adicione suporte no workflow)

## Proxy Reverso (Opcional)

Se você tem um proxy reverso (Nginx/Traefik) com SSL, configure-o para:

```nginx
# Exemplo Nginx
server {
    listen 443 ssl;
    server_name volei.example.com;

    # SSL config...

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
```

## DNS Manager Integration

Se você usa o `cloudflare-dns-manager` (como na pipeline original), o DNS será criado automaticamente. Caso contrário, configure manualmente:

1. Acesse seu provedor DNS (Cloudflare, Route53, etc.)
2. Crie um registro A apontando para o IP do servidor
3. Aguarde propagação (1-5 minutos)
