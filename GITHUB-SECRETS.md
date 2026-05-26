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

### Banco de Dados REMOTO
| Nome | Descrição | Exemplo |
|------|-----------|---------|
| `DB_HOST` | Host/IP do banco remoto | `207.58.175.4` |
| `DB_PORT` | Porta do banco remoto | `3306` |
| `DB_USER` | Usuário do banco | `volei` |
| `DB_PASSWORD` | Senha do usuário | `volei2025` |
| `DB_NAME` | Nome do banco de dados | `volei` |

**⚠️ IMPORTANTE**: Esta pipeline usa um banco de dados REMOTO existente.
Não é criado nenhum container de banco no servidor.

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

# Database Remoto (OBRIGATÓRIO)
DB_HOST=207.58.175.4
DB_PORT=3306
DB_USER=volei
DB_PASSWORD=volei2025
DB_NAME=volei
```

## Workflow do Deploy

O deploy é acionado automaticamente quando você:
- Faz push na branch `main`
- Ou executa manualmente em: **Actions** > **Deploy Vôlei dos amigos** > **Run workflow**

## Passo a Passo do Deploy

1. **Checkout do código** - Baixa o código do repositório
2. **Cria pacote de deploy** - Empacota `docker-compose.remote-db.yml`, Dockerfile, etc
3. **Envia via SSH** - Transfere arquivos para o servidor
4. **Cria arquivo .env** - Configura variáveis de ambiente com credenciais do banco remoto
5. **Build das imagens** - Constrói containers Docker (apenas API e Frontend)
6. **Sobe os serviços** - Inicia API e Frontend (conectam ao banco remoto)
7. **Health check** - Verifica se API e Frontend estão funcionando

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

## Arquitetura do Deploy

```
┌─────────────────────────────────────────┐
│  Servidor de Deploy                     │
│  ┌──────────────┐   ┌──────────────┐   │
│  │   Frontend   │   │     API      │───┼─┐
│  │  (Vite)      │   │  (Express)   │   │ │
│  │  Porta 8080  │   │  Porta 3001  │   │ │
│  └──────────────┘   └──────────────┘   │ │
└─────────────────────────────────────────┘ │
                                            │
                                            │ Conexão TCP
                                            ▼
                    ┌────────────────────────────────┐
                    │  Servidor de Banco (Remoto)    │
                    │  ┌─────────────────────────┐   │
                    │  │  MariaDB 11             │   │
                    │  │  207.58.175.4:3306      │   │
                    │  └─────────────────────────┘   │
                    └────────────────────────────────┘
```

## Portas Expostas no Servidor de Deploy

| Serviço | Porta | Descrição |
|---------|-------|-----------|
| API | 3001 | Backend Express (conecta ao banco remoto) |
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

### API não conecta ao banco remoto
```bash
# Verificar variáveis de ambiente da API
docker exec volei-api env | grep DB_

# Testar conexão ao banco remoto do servidor
ping 207.58.175.4
telnet 207.58.175.4 3306

# Verificar logs da API
docker logs volei-api --tail=50
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
