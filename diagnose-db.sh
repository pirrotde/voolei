#!/bin/bash
# Script de Diagnóstico - Problemas de Persistência de Dados
# Execute no servidor de produção: bash diagnose-db.sh

echo "=================================================="
echo "   DIAGNÓSTICO - Vôlei dos amigos 🏐"
echo "=================================================="
echo ""

cd /opt/volei 2>/dev/null || {
    echo "❌ ERRO: Diretório /opt/volei não encontrado"
    echo "Este script deve ser executado no servidor de produção"
    exit 1
}

echo "📍 Localização: $(pwd)"
echo "⏰ Data/Hora: $(date)"
echo ""

# Cores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Status dos Containers
echo "=================================================="
echo "1️⃣  STATUS DOS CONTAINERS"
echo "=================================================="
if docker ps --filter "name=volei" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -q volei; then
    docker ps --filter "name=volei" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    echo ""

    # Verificar se API está rodando
    if docker ps --format "{{.Names}}" | grep -q "volei-api"; then
        echo -e "${GREEN}✅ Container volei-api está rodando${NC}"
    else
        echo -e "${RED}❌ Container volei-api NÃO está rodando${NC}"
        API_DOWN=1
    fi

    # Verificar se Frontend está rodando
    if docker ps --format "{{.Names}}" | grep -q "volei-frontend"; then
        echo -e "${GREEN}✅ Container volei-frontend está rodando${NC}"
    else
        echo -e "${RED}❌ Container volei-frontend NÃO está rodando${NC}"
    fi
else
    echo -e "${RED}❌ Nenhum container do volei está rodando${NC}"
    API_DOWN=1
fi
echo ""

# Se API não está rodando, não adianta continuar
if [ "$API_DOWN" = "1" ]; then
    echo -e "${RED}❌ API não está rodando. Inicie os containers primeiro:${NC}"
    echo "   docker-compose -f docker-compose.remote-db.yml -p volei up -d"
    exit 1
fi

# 2. Variáveis de Ambiente
echo "=================================================="
echo "2️⃣  VARIÁVEIS DE AMBIENTE DA API"
echo "=================================================="
docker exec volei-api env | grep DB_ | sed 's/PASSWORD=.*/PASSWORD=***/' || {
    echo -e "${RED}❌ Não foi possível obter variáveis de ambiente${NC}"
}
echo ""

# Obter valores para usar depois
DB_HOST=$(docker exec volei-api env | grep DB_HOST | cut -d= -f2)
DB_PORT=$(docker exec volei-api env | grep DB_PORT | cut -d= -f2)
DB_USER=$(docker exec volei-api env | grep DB_USER | cut -d= -f2)
DB_PASSWORD=$(docker exec volei-api env | grep DB_PASSWORD | cut -d= -f2)
DB_NAME=$(docker exec volei-api env | grep DB_NAME | cut -d= -f2)

# Valores padrão se não estiverem definidos
DB_HOST=${DB_HOST:-207.58.175.4}
DB_PORT=${DB_PORT:-3306}
DB_USER=${DB_USER:-volei}
DB_PASSWORD=${DB_PASSWORD:-volei2025}
DB_NAME=${DB_NAME:-volei}

echo "Conectando em: $DB_USER@$DB_HOST:$DB_PORT/$DB_NAME"
echo ""

# 3. Health Check da API
echo "=================================================="
echo "3️⃣  HEALTH CHECK DA API"
echo "=================================================="
HEALTH=$(docker exec volei-api curl -s http://localhost:3001/health)
if echo "$HEALTH" | grep -q "ok"; then
    echo -e "${GREEN}✅ API está respondendo${NC}"
    echo "$HEALTH"
else
    echo -e "${RED}❌ API não está respondendo corretamente${NC}"
    echo "$HEALTH"
fi
echo ""

# 4. Teste de Conexão ao Banco
echo "=================================================="
echo "4️⃣  TESTE DE CONEXÃO AO BANCO REMOTO"
echo "=================================================="
CONNECTION_TEST=$(docker exec volei-api sh -c "apt-get update >/dev/null 2>&1 && apt-get install -y default-mysql-client >/dev/null 2>&1 && mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASSWORD $DB_NAME -e \"SELECT 'Conexão OK' as status;\" 2>&1")

if echo "$CONNECTION_TEST" | grep -q "Conexão OK"; then
    echo -e "${GREEN}✅ Conexão com banco remoto funcionando${NC}"
    echo "$CONNECTION_TEST"
else
    echo -e "${RED}❌ FALHA ao conectar no banco remoto${NC}"
    echo "$CONNECTION_TEST"
    echo ""
    echo "Possíveis causas:"
    echo "  - Firewall bloqueando porta 3306"
    echo "  - Credenciais incorretas"
    echo "  - Banco não está aceitando conexões externas"
    echo "  - MariaDB não está rodando no servidor remoto"
fi
echo ""

# 5. Verificar Tabelas
echo "=================================================="
echo "5️⃣  TABELAS NO BANCO DE DADOS"
echo "=================================================="
TABLES=$(docker exec volei-api mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASSWORD $DB_NAME -e "SHOW TABLES;" 2>&1)

if echo "$TABLES" | grep -q "rooms"; then
    echo -e "${GREEN}✅ Schema existe no banco${NC}"
    echo "$TABLES"

    # Contar registros em cada tabela
    echo ""
    echo "Contagem de registros:"
    docker exec volei-api mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASSWORD $DB_NAME -e "
        SELECT 'rooms' as tabela, COUNT(*) as total FROM rooms
        UNION ALL SELECT 'players', COUNT(*) FROM players
        UNION ALL SELECT 'queue', COUNT(*) FROM queue
        UNION ALL SELECT 'teams', COUNT(*) FROM teams
        UNION ALL SELECT 'team_players', COUNT(*) FROM team_players
        UNION ALL SELECT 'room_state', COUNT(*) FROM room_state
        UNION ALL SELECT 'match_history', COUNT(*) FROM match_history;
    " 2>/dev/null
else
    echo -e "${RED}❌ Schema NÃO existe no banco${NC}"
    echo "$TABLES"
    echo ""
    echo "SOLUÇÃO: Execute o schema.sql no banco remoto:"
    echo "  mysql -u $DB_USER -p$DB_PASSWORD $DB_NAME < schema.sql"
fi
echo ""

# 6. Permissões do Usuário
echo "=================================================="
echo "6️⃣  PERMISSÕES DO USUÁRIO DO BANCO"
echo "=================================================="
GRANTS=$(docker exec volei-api mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASSWORD $DB_NAME -e "SHOW GRANTS;" 2>&1)

if echo "$GRANTS" | grep -q "ALL PRIVILEGES"; then
    echo -e "${GREEN}✅ Usuário tem permissões adequadas${NC}"
elif echo "$GRANTS" | grep -q "GRANT"; then
    echo -e "${YELLOW}⚠️  Verificar permissões:${NC}"
    echo "$GRANTS"
else
    echo -e "${RED}❌ Não foi possível verificar permissões${NC}"
    echo "$GRANTS"
fi
echo ""

# 7. Últimas Salas Criadas
echo "=================================================="
echo "7️⃣  ÚLTIMAS 5 SALAS CRIADAS"
echo "=================================================="
RECENT_ROOMS=$(docker exec volei-api mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASSWORD $DB_NAME -e "SELECT id, code, name, created_at FROM rooms ORDER BY created_at DESC LIMIT 5;" 2>&1)

if echo "$RECENT_ROOMS" | grep -q "id"; then
    echo "$RECENT_ROOMS"
else
    echo -e "${YELLOW}⚠️  Nenhuma sala encontrada (ou erro)${NC}"
    echo "$RECENT_ROOMS"
fi
echo ""

# 8. Teste de Criação de Sala
echo "=================================================="
echo "8️⃣  TESTE: CRIAR SALA"
echo "=================================================="
CREATE_RESULT=$(docker exec volei-api curl -s -X POST http://localhost:3001/api/rooms/create \
  -H "Content-Type: application/json" \
  -d '{"name":"Teste Diagnóstico"}' 2>&1)

if echo "$CREATE_RESULT" | grep -q "\"id\""; then
    echo -e "${GREEN}✅ Sala criada com sucesso${NC}"
    echo "$CREATE_RESULT"

    # Extrair roomId
    ROOM_ID=$(echo "$CREATE_RESULT" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
    echo ""
    echo "Room ID criado: $ROOM_ID"

    # Verificar se foi realmente inserido no banco
    echo ""
    echo "Verificando no banco..."
    docker exec volei-api mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASSWORD $DB_NAME \
      -e "SELECT * FROM rooms WHERE name='Teste Diagnóstico' ORDER BY created_at DESC LIMIT 1;" 2>/dev/null
else
    echo -e "${RED}❌ FALHA ao criar sala${NC}"
    echo "$CREATE_RESULT"
fi
echo ""

# 9. Últimos Logs da API
echo "=================================================="
echo "9️⃣  ÚLTIMOS 30 LOGS DA API"
echo "=================================================="
docker logs volei-api --tail=30 2>&1 | tail -30
echo ""

# 10. Resumo e Recomendações
echo "=================================================="
echo "🎯 RESUMO E RECOMENDAÇÕES"
echo "=================================================="

# Verificar problemas comuns
ISSUES=0

if [ "$API_DOWN" = "1" ]; then
    echo -e "${RED}❌ API não está rodando${NC}"
    echo "   → Inicie os containers: docker-compose -f docker-compose.remote-db.yml -p volei up -d"
    ISSUES=$((ISSUES + 1))
fi

if ! echo "$CONNECTION_TEST" | grep -q "Conexão OK"; then
    echo -e "${RED}❌ Não consegue conectar ao banco remoto${NC}"
    echo "   → Verifique firewall, credenciais e se MariaDB está rodando"
    ISSUES=$((ISSUES + 1))
fi

if ! echo "$TABLES" | grep -q "rooms"; then
    echo -e "${RED}❌ Schema não existe no banco${NC}"
    echo "   → Execute: mysql -u $DB_USER -p$DB_PASSWORD $DB_NAME < schema.sql"
    ISSUES=$((ISSUES + 1))
fi

if ! echo "$CREATE_RESULT" | grep -q "\"id\""; then
    echo -e "${RED}❌ Não consegue criar salas${NC}"
    echo "   → Verifique logs da API e permissões do usuário do banco"
    ISSUES=$((ISSUES + 1))
fi

if [ $ISSUES -eq 0 ]; then
    echo -e "${GREEN}✅ Nenhum problema crítico encontrado!${NC}"
    echo ""
    echo "Se ainda assim os dados não estão sendo salvos:"
    echo "1. Verifique o Network tab do navegador (F12)"
    echo "2. Confirme se requisições POST /api/state/save estão sendo enviadas"
    echo "3. Verifique os logs em tempo real: docker logs volei-api -f"
else
    echo ""
    echo -e "${RED}$ISSUES problema(s) encontrado(s). Corrija-os e execute novamente.${NC}"
fi

echo ""
echo "=================================================="
echo "Diagnóstico concluído em $(date)"
echo "=================================================="
