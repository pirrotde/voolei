# 🔍 Problema de Persistência - IDENTIFICADO

## ❌ PROBLEMA CONFIRMADO

**O sistema NÃO está salvando jogadores no banco de dados!**

### Evidências:
```sql
SELECT 'rooms' as tabela, COUNT(*) FROM rooms    -- 3 salas ✅
SELECT 'players' as tabela, COUNT(*) FROM players  -- 0 jogadores ❌
SELECT 'teams' as tabela, COUNT(*) FROM teams     -- 2 times
```

**Conclusão**: Salas estão sendo criadas, mas **NENHUM jogador está sendo salvo**.

---

## 🔍 Causa Raiz

### 1. **Problema de Autenticação MySQL/MariaDB**
O Node.js (mysql2) está falhando ao conectar com erro `EPIPE` durante o handshake de autenticação.

**Erro observado:**
```
❌ Erro ao conectar MariaDB: Error: write EPIPE
    at ClientHandshake.sendCredentials
```

### 2. **Incompatibilidade de Plugin**
- O MariaDB client (linha de comando) funciona perfeitamente ✅
- O mysql2 (Node.js) trava durante a autenticação ❌

Isso indica que o plugin de autenticação do usuário `volei` não é compatível com o mysql2.

---

## ✅ SOLUÇÃO

### Passo 1: Verificar Plugin de Autenticação Atual

**No servidor de banco (207.58.175.4)**, executar como root:

```sql
SELECT user, host, plugin, authentication_string
FROM mysql.user
WHERE user='volei';
```

**Plugins problemáticos**:
- `caching_sha2_password` - Não compatível com mysql2 antigo
- `mysql_old_password` - Depreciado
- `ed25519` - Pode causar problemas

**Plugin recomendado**:
- `mysql_native_password` - Totalmente compatível ✅

---

### Passo 2: Recriar Usuário (JÁ FEITO ✅)

Você já executou:
```sql
DROP USER IF EXISTS 'volei'@'%';
CREATE USER 'volei'@'%' IDENTIFIED BY 'volei2025';
GRANT ALL PRIVILEGES ON volei.* TO 'volei'@'%';
FLUSH PRIVILEGES;
```

---

### Passo 3: Verificar Configuração do MariaDB

Verifique se o MariaDB está aceitando conexões externas corretamente.

**No servidor 207.58.175.4:**

```bash
# 1. Verificar bind-address
cat /etc/mysql/mariadb.conf.d/50-server.cnf | grep bind-address

# Deve estar: bind-address = 0.0.0.0
# Se estiver 127.0.0.1, trocar para 0.0.0.0 e reiniciar MariaDB
```

```bash
# 2. Verificar max_connections
mysql -u root -p -e "SHOW VARIABLES LIKE 'max_connections';"

# Recomendado: pelo menos 150
# Se estiver muito baixo:
mysql -u root -p -e "SET GLOBAL max_connections = 200;"
```

```bash
# 3. Verificar timeout de conexão
mysql -u root -p -e "SHOW VARIABLES LIKE '%timeout%';"

# Se connect_timeout for muito baixo (< 10), aumentar:
mysql -u root -p -e "SET GLOBAL connect_timeout = 30;"
```

---

### Passo 4: Testar Conexão do Servidor de Aplicação

**No servidor onde roda o Docker (containers da aplicação):**

```bash
# Testar com MariaDB client
docker run --rm mariadb:11 mariadb \
  -h 207.58.175.4 \
  -P 3306 \
  -u volei \
  -pvolei2025 \
  volei \
  -e "SELECT 'Conexão OK' as status;"
```

**Esperado**: `Conexão OK`

Se funcionar, o problema está especificamente no mysql2 do Node.js.

---

## 🚀 Teste em Produção

Depois de aplicar as correções, execute o diagnóstico no servidor:

```bash
cd /opt/volei
bash diagnose-db.sh
```

O script irá:
1. ✅ Verificar containers rodando
2. ✅ Testar conexão ao banco
3. ✅ Criar sala de teste
4. ✅ Verificar se sala foi salva

---

## 🔧 Soluções Alternativas (se o problema persistir)

### Opção A: Forçar Plugin na Conexão

Se o problema continuar, adicione ao `api-server.js` e `src/lib/db.ts`:

```javascript
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || "3306"),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  authPlugins: {
    mysql_native_password: () => () => {
      const crypto = require('crypto');
      const password = process.env.DB_PASSWORD || '';
      if (!password) return Buffer.from([]);
      const hash1 = crypto.createHash('sha1').update(password).digest();
      const hash2 = crypto.createHash('sha1').update(hash1).digest();
      return hash2;
    }
  }
});
```

### Opção B: Atualizar mysql2

No `package.json`, atualizar para versão mais recente:

```json
"mysql2": "^3.11.5"
```

Depois executar:
```bash
npm install
```

### Opção C: Usar Banco Local (Desenvolvimento)

Para desenvolvimento/testes, usar `docker-compose.yml` que cria banco local:

```bash
docker-compose up -d
```

Isso cria um MariaDB local dentro do Docker que sempre funciona.

---

## 📊 Arquitetura do Problema

```
Frontend (localhost:8080)
    ↓ HTTP POST /api/state/save
API Node.js (localhost:3001)
    ↓ mysql2.createPool().execute()
    ↓ Handshake MySQL Protocol
    ❌ FALHA AQUI (EPIPE during sendCredentials)
MariaDB (207.58.175.4:3306)
```

O erro acontece **durante o handshake de autenticação**, antes mesmo de enviar a query.

---

## ✅ Checklist de Verificação

Execute no servidor de banco:

- [ ] Usuário recriado com `mysql_native_password`
- [ ] `bind-address = 0.0.0.0` no my.cnf
- [ ] `max_connections >= 150`
- [ ] Porta 3306 aberta no firewall (`ufw allow 3306/tcp`)
- [ ] MariaDB rodando (`systemctl status mariadb`)
- [ ] Teste com MariaDB client funciona ✅
- [ ] Teste com Node.js mysql2 funciona

Se TODOS os itens estiverem marcados e o problema persistir, considere:
- Verificar logs do MariaDB: `tail -f /var/log/mysql/error.log`
- Verificar se há rate limiting ou fail2ban bloqueando
- Testar de outro servidor para isolar problema de rede

---

## 📝 Notas Adicionais

### Por que o MariaDB client funciona mas o mysql2 não?

O cliente MariaDB usa protocolo mais tolerante e faz retry automático. O mysql2 é mais estrito e falha imediatamente se encontrar problemas no handshake.

### Dados já existentes

```sql
-- 3 salas criadas mas SEM jogadores
SELECT * FROM rooms;
-- Código da sala pode ser usado para entrar, mas fila estará vazia
```

Para limpar dados de teste:
```sql
TRUNCATE TABLE team_players;
TRUNCATE TABLE teams;
TRUNCATE TABLE queue;
TRUNCATE TABLE players;
TRUNCATE TABLE match_history;
TRUNCATE TABLE room_state;
DELETE FROM rooms;
```

---

## 🎯 Próxima Etapa

1. **Execute as verificações do Passo 3** no servidor de banco
2. **Reinicie o MariaDB** se fez alterações: `sudo systemctl restart mariadb`
3. **Reinicie os containers** da aplicação: `docker-compose -f docker-compose.remote-db.yml -p volei restart`
4. **Execute o diagnóstico**: `bash diagnose-db.sh`
5. **Teste no navegador**: Criar sala, adicionar jogadores, verificar se persiste

Se continuar falhando, compartilhe:
- Output do diagnóstico
- Logs do MariaDB (`tail -100 /var/log/mysql/error.log`)
- Output de `SHOW VARIABLES LIKE '%plugin%';` no MariaDB
