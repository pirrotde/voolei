# Troubleshooting - Problemas de Persistência de Dados 🔍

## Problema Reportado
Sistema está rodando mas pode não estar salvando informações no banco de dados como deveria.

---

## Diagnóstico Rápido (Execute no servidor de produção)

### 1. Verificar Status dos Containers
```bash
cd /opt/volei
docker ps --filter "name=volei"
```

**Esperado**: Ambos containers `volei-api` e `volei-frontend` devem estar `Up` e `healthy`.

---

### 2. Verificar Logs da API
```bash
docker logs volei-api --tail=50
```

**O que procurar**:
- ✅ `✅ MariaDB conectado` - Conexão com banco funcionando
- ✅ `🚀 API Server rodando em http://localhost:3001`
- ❌ `❌ Erro ao conectar MariaDB` - Problema de conexão
- ❌ `Error: ER_ACCESS_DENIED_ERROR` - Credenciais incorretas
- ❌ `Error: ECONNREFUSED` - Banco inacessível
- ❌ `Erro ao salvar estado` - Falhas ao persistir dados

---

### 3. Verificar Variáveis de Ambiente da API
```bash
docker exec volei-api env | grep DB_
```

**Esperado**:
```
DB_HOST=207.58.175.4
DB_PORT=3306
DB_USER=volei
DB_PASSWORD=volei2025
DB_NAME=volei
```

**Se estiverem vazias ou erradas**: O arquivo `.env` no servidor não está configurado corretamente.

---

### 4. Testar Conexão ao Banco Remoto
Dentro do container da API, testar se consegue conectar ao MariaDB remoto:

```bash
# Instalar mysql client dentro do container (se necessário)
docker exec volei-api sh -c "apt-get update && apt-get install -y default-mysql-client"

# Testar conexão
docker exec volei-api mysql -h 207.58.175.4 -P 3306 -u volei -pvolei2025 volei -e "SHOW TABLES;"
```

**Esperado**: Lista de tabelas (rooms, players, queue, teams, team_players, room_state, match_history)

**Se falhar**:
- Firewall bloqueando conexão do container ao banco
- Credenciais incorretas
- Banco remoto não está aceitando conexões externas

---

### 5. Verificar se o Schema Existe no Banco Remoto
```bash
docker exec volei-api mysql -h 207.58.175.4 -P 3306 -u volei -pvolei2025 volei -e "SHOW TABLES;"
```

**Se NÃO retornar as tabelas**, você precisa criar o schema:

```bash
# No servidor de BANCO (207.58.175.4), conecte ao MySQL e execute:
mysql -u root -p

# Criar usuário e database (se não existir)
CREATE DATABASE IF NOT EXISTS volei;
CREATE USER IF NOT EXISTS 'volei'@'%' IDENTIFIED BY 'volei2025';
GRANT ALL PRIVILEGES ON volei.* TO 'volei'@'%';
FLUSH PRIVILEGES;
USE volei;

# Copiar e executar todo o conteúdo de schema.sql
# Ou fazer upload e executar:
mysql -u volei -pvolei2025 volei < schema.sql
```

---

### 6. Verificar Permissões do Usuário do Banco
```bash
docker exec volei-api mysql -h 207.58.175.4 -P 3306 -u volei -pvolei2025 volei -e "SHOW GRANTS;"
```

**Esperado**:
```sql
GRANT ALL PRIVILEGES ON volei.* TO 'volei'@'%'
```

**Se o usuário não tiver permissões de INSERT/UPDATE/DELETE**, executar no servidor de banco:
```sql
GRANT ALL PRIVILEGES ON volei.* TO 'volei'@'%';
FLUSH PRIVILEGES;
```

---

### 7. Testar Endpoints da API Manualmente

#### a) Verificar se a API está respondendo
```bash
docker exec volei-api curl http://localhost:3001/health
```

**Esperado**: `{"status":"ok","timestamp":...}`

#### b) Criar uma sala de teste
```bash
docker exec volei-api curl -X POST http://localhost:3001/api/rooms/create \
  -H "Content-Type: application/json" \
  -d '{"name":"Sala Teste"}'
```

**Esperado**: `{"id":"abc123","code":"XYZ789"}`

**Se falhar com erro 500**: Verificar logs da API com `docker logs volei-api --tail=20`

#### c) Verificar se a sala foi criada no banco
```bash
docker exec volei-api mysql -h 207.58.175.4 -P 3306 -u volei -pvolei2025 volei \
  -e "SELECT * FROM rooms ORDER BY created_at DESC LIMIT 1;"
```

**Se NÃO aparecer**: Problema ao inserir no banco (verificar permissões)

#### d) Testar salvar estado
```bash
docker exec volei-api curl -X POST http://localhost:3001/api/state/save \
  -H "Content-Type: application/json" \
  -d '{
    "roomId": "SEU_ROOM_ID_AQUI",
    "state": {
      "players": [{"id":"p1","name":"João","gender":"M"}],
      "queue": ["p1"],
      "teamA": null,
      "teamB": null,
      "scoreA": 0,
      "scoreB": 0,
      "maxConsecutiveWins": 3,
      "currentWinStreak": 0,
      "history": []
    }
  }'
```

**Esperado**: `{"success":true}`

**Se retornar erro**: Verificar logs da API

---

### 8. Verificar Logs em Tempo Real
Abrir logs em tempo real enquanto testa o app:

```bash
docker logs volei-api -f
```

Enquanto isso, abrir o app no navegador e tentar criar uma sala, adicionar jogadores, etc.

**O que procurar nos logs**:
- Requisições chegando: `POST /api/state/save`
- Erros SQL: `ER_*`, `ECONNREFUSED`, etc.
- Rollback de transações: `rollback`

---

## Problemas Comuns e Soluções

### ❌ Problema 1: "ER_ACCESS_DENIED_ERROR"
**Causa**: Credenciais do banco incorretas ou usuário não tem permissão

**Solução**:
```sql
-- No servidor de banco (207.58.175.4)
mysql -u root -p
GRANT ALL PRIVILEGES ON volei.* TO 'volei'@'%' IDENTIFIED BY 'volei2025';
FLUSH PRIVILEGES;
```

---

### ❌ Problema 2: "Error: connect ECONNREFUSED 207.58.175.4:3306"
**Causa**: Container não consegue conectar ao banco remoto

**Soluções possíveis**:
1. Verificar se o banco está rodando: `systemctl status mariadb` (no servidor 207.58.175.4)
2. Verificar firewall: `ufw status` (no servidor 207.58.175.4)
3. Permitir conexões externas:
   ```bash
   # No servidor de banco
   sudo ufw allow 3306/tcp
   ```
4. Verificar configuração do MariaDB para aceitar conexões externas:
   ```bash
   # Editar /etc/mysql/mariadb.conf.d/50-server.cnf
   # Trocar:
   bind-address = 127.0.0.1
   # Por:
   bind-address = 0.0.0.0

   # Reiniciar
   sudo systemctl restart mariadb
   ```

---

### ❌ Problema 3: "Table 'volei.rooms' doesn't exist"
**Causa**: Schema não foi criado no banco remoto

**Solução**:
```bash
# Copiar schema.sql para o servidor de banco
scp schema.sql user@207.58.175.4:/tmp/

# No servidor de banco
mysql -u volei -pvolei2025 volei < /tmp/schema.sql
```

---

### ❌ Problema 4: Transações fazendo rollback
**Causa**: Violação de constraint, foreign key, ou dados inválidos

**Como verificar**:
```bash
docker logs volei-api --tail=50 | grep -i "error\|rollback"
```

**Solução**: Verificar estrutura dos dados sendo enviados pelo frontend

---

### ❌ Problema 5: Frontend não está salvando
**Causa**: API pode estar salvando, mas frontend não está chamando o endpoint

**Como verificar**:
1. Abrir DevTools do navegador (F12)
2. Ir na aba "Network"
3. Adicionar jogadores, mudar times, etc.
4. Verificar se aparecem requisições para `http://localhost:3001/api/state/save`

**Se não aparecer**: Problema no código do frontend

**Se aparecer mas retorna erro**: Problema na API (ver logs)

---

## Checklist de Verificação Completa

Execute todos os comandos abaixo no **servidor de produção** (onde está o Docker):

```bash
echo "=== 1. Status dos Containers ==="
docker ps --filter "name=volei"

echo ""
echo "=== 2. Variáveis de Ambiente ==="
docker exec volei-api env | grep DB_

echo ""
echo "=== 3. Teste de Conexão ==="
docker exec volei-api mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASSWORD $DB_NAME -e "SELECT 'Conexão OK' as status;"

echo ""
echo "=== 4. Tabelas no Banco ==="
docker exec volei-api mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASSWORD $DB_NAME -e "SHOW TABLES;"

echo ""
echo "=== 5. Health Check API ==="
docker exec volei-api curl -s http://localhost:3001/health

echo ""
echo "=== 6. Últimas Salas Criadas ==="
docker exec volei-api mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASSWORD $DB_NAME -e "SELECT id, code, name, created_at FROM rooms ORDER BY created_at DESC LIMIT 5;"

echo ""
echo "=== 7. Últimas 20 linhas de log ==="
docker logs volei-api --tail=20
```

---

## Próximos Passos

1. Execute o **Checklist de Verificação Completa** acima
2. Copie a saída e compartilhe para análise
3. Se necessário, execute testes específicos baseados nos resultados

---

## Informações de Arquitetura

### Fluxo de Dados:
```
Frontend (porta 8080)
    ↓ HTTP POST/GET
API Express (porta 3001)
    ↓ MySQL Protocol
MariaDB Remoto (207.58.175.4:3306)
```

### Endpoints da API:
- `POST /api/rooms/create` - Cria sala (INSERT em rooms + room_state)
- `POST /api/rooms/join` - Entra em sala (SELECT em rooms)
- `GET /api/state/load` - Carrega estado (múltiplos SELECT)
- `POST /api/state/save` - **SALVA ESTADO** (DELETE + múltiplos INSERT + UPDATE)
  - Este é o endpoint crítico para persistência!

### Transação do /api/state/save:
```sql
BEGIN TRANSACTION
  DELETE FROM team_players WHERE team_id IN (SELECT id FROM teams WHERE room_id = ?)
  DELETE FROM teams WHERE room_id = ?
  DELETE FROM queue WHERE room_id = ?
  DELETE FROM players WHERE room_id = ?

  INSERT INTO players ...
  INSERT INTO queue ...
  INSERT INTO teams ...
  INSERT INTO team_players ...
  UPDATE room_state ...
COMMIT
```

Se **qualquer** uma dessas queries falhar, a transação toda é revertida (ROLLBACK).

---

## Contato

Se após todas as verificações o problema persistir, compartilhe:
1. Saída do checklist completo
2. Logs da API (`docker logs volei-api --tail=100`)
3. Resultado do teste de criação de sala manual
4. Screenshot do Network tab do navegador mostrando requisições
