#!/bin/bash
# Script para configurar o banco de dados remoto
# Execute este script NO SERVIDOR DE BANCO (207.58.175.4)

echo "=================================================="
echo "   SETUP - Banco de Dados Vôlei dos amigos 🏐"
echo "=================================================="
echo ""

# Verificar se o script está sendo executado como root ou com sudo
if [ "$EUID" -ne 0 ] && ! command -v sudo &> /dev/null; then
    echo "❌ Este script precisa ser executado como root ou com sudo"
    exit 1
fi

# Cores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configurações padrão
DB_NAME="volei"
DB_USER="volei"
DB_PASSWORD="volei2025"

echo "Configurações:"
echo "  Database: $DB_NAME"
echo "  Usuário: $DB_USER"
echo "  Senha: ***"
echo ""

# 1. Verificar se MariaDB está instalado e rodando
echo "=================================================="
echo "1️⃣  VERIFICANDO MARIADB"
echo "=================================================="

if ! command -v mysql &> /dev/null; then
    echo -e "${RED}❌ MariaDB não está instalado${NC}"
    echo ""
    read -p "Deseja instalar MariaDB? (s/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Ss]$ ]]; then
        echo "Instalando MariaDB..."
        sudo apt-get update
        sudo apt-get install -y mariadb-server mariadb-client
        sudo systemctl enable mariadb
        sudo systemctl start mariadb
        echo -e "${GREEN}✅ MariaDB instalado${NC}"
    else
        echo "Abortando..."
        exit 1
    fi
else
    echo -e "${GREEN}✅ MariaDB está instalado${NC}"
fi

# Verificar se está rodando
if sudo systemctl is-active --quiet mariadb; then
    echo -e "${GREEN}✅ MariaDB está rodando${NC}"
else
    echo -e "${YELLOW}⚠️  MariaDB não está rodando. Iniciando...${NC}"
    sudo systemctl start mariadb
    sleep 2
    if sudo systemctl is-active --quiet mariadb; then
        echo -e "${GREEN}✅ MariaDB iniciado${NC}"
    else
        echo -e "${RED}❌ Falha ao iniciar MariaDB${NC}"
        exit 1
    fi
fi
echo ""

# 2. Configurar MariaDB para aceitar conexões externas
echo "=================================================="
echo "2️⃣  CONFIGURANDO CONEXÕES EXTERNAS"
echo "=================================================="

MARIADB_CNF="/etc/mysql/mariadb.conf.d/50-server.cnf"

if [ -f "$MARIADB_CNF" ]; then
    # Verificar se bind-address está configurado
    if grep -q "bind-address.*127.0.0.1" "$MARIADB_CNF"; then
        echo "Alterando bind-address para 0.0.0.0..."
        sudo sed -i 's/bind-address.*/bind-address = 0.0.0.0/' "$MARIADB_CNF"
        echo -e "${GREEN}✅ bind-address configurado para 0.0.0.0${NC}"
        RESTART_NEEDED=1
    elif grep -q "bind-address.*0.0.0.0" "$MARIADB_CNF"; then
        echo -e "${GREEN}✅ bind-address já está configurado corretamente${NC}"
    else
        echo "Adicionando bind-address = 0.0.0.0..."
        sudo sed -i '/\[mysqld\]/a bind-address = 0.0.0.0' "$MARIADB_CNF"
        RESTART_NEEDED=1
    fi
else
    echo -e "${YELLOW}⚠️  Arquivo de configuração não encontrado em $MARIADB_CNF${NC}"
fi
echo ""

# 3. Configurar Firewall
echo "=================================================="
echo "3️⃣  CONFIGURANDO FIREWALL"
echo "=================================================="

if command -v ufw &> /dev/null; then
    if sudo ufw status | grep -q "3306.*ALLOW"; then
        echo -e "${GREEN}✅ Porta 3306 já está liberada no firewall${NC}"
    else
        echo "Liberando porta 3306..."
        sudo ufw allow 3306/tcp
        echo -e "${GREEN}✅ Porta 3306 liberada${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  UFW não está instalado. Verifique o firewall manualmente.${NC}"
fi
echo ""

# Reiniciar MariaDB se necessário
if [ "$RESTART_NEEDED" = "1" ]; then
    echo "Reiniciando MariaDB..."
    sudo systemctl restart mariadb
    sleep 2
    if sudo systemctl is-active --quiet mariadb; then
        echo -e "${GREEN}✅ MariaDB reiniciado${NC}"
    else
        echo -e "${RED}❌ Falha ao reiniciar MariaDB${NC}"
        exit 1
    fi
fi
echo ""

# 4. Solicitar senha root do MySQL
echo "=================================================="
echo "4️⃣  CONFIGURANDO BANCO DE DADOS"
echo "=================================================="
echo ""
read -sp "Digite a senha ROOT do MySQL (Enter se não tiver): " MYSQL_ROOT_PASSWORD
echo ""
echo ""

# Testar conexão
if [ -z "$MYSQL_ROOT_PASSWORD" ]; then
    MYSQL_CMD="mysql"
else
    MYSQL_CMD="mysql -p$MYSQL_ROOT_PASSWORD"
fi

# 5. Criar database e usuário
echo "Criando database e usuário..."

SQL_COMMANDS="
-- Criar database
CREATE DATABASE IF NOT EXISTS $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Criar usuário (se não existir)
CREATE USER IF NOT EXISTS '$DB_USER'@'%' IDENTIFIED BY '$DB_PASSWORD';

-- Conceder permissões
GRANT ALL PRIVILEGES ON $DB_NAME.* TO '$DB_USER'@'%';

-- Aplicar mudanças
FLUSH PRIVILEGES;

-- Selecionar database
USE $DB_NAME;
"

echo "$SQL_COMMANDS" | $MYSQL_CMD 2>&1

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Database e usuário criados${NC}"
else
    echo -e "${RED}❌ Erro ao criar database/usuário${NC}"
    exit 1
fi
echo ""

# 6. Criar schema
echo "=================================================="
echo "5️⃣  CRIANDO SCHEMA (TABELAS)"
echo "=================================================="

# Verificar se schema.sql existe
if [ ! -f "schema.sql" ]; then
    echo -e "${YELLOW}⚠️  Arquivo schema.sql não encontrado no diretório atual${NC}"
    echo ""
    read -p "Digite o caminho completo do arquivo schema.sql: " SCHEMA_PATH
    if [ ! -f "$SCHEMA_PATH" ]; then
        echo -e "${RED}❌ Arquivo não encontrado: $SCHEMA_PATH${NC}"
        exit 1
    fi
else
    SCHEMA_PATH="schema.sql"
fi

echo "Executando schema.sql..."

if [ -z "$MYSQL_ROOT_PASSWORD" ]; then
    mysql $DB_NAME < "$SCHEMA_PATH" 2>&1
else
    mysql -p$MYSQL_ROOT_PASSWORD $DB_NAME < "$SCHEMA_PATH" 2>&1
fi

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Schema criado com sucesso${NC}"
else
    echo -e "${RED}❌ Erro ao criar schema${NC}"
    exit 1
fi
echo ""

# 7. Verificar tabelas criadas
echo "=================================================="
echo "6️⃣  VERIFICANDO TABELAS CRIADAS"
echo "=================================================="

TABLES=$($MYSQL_CMD -e "USE $DB_NAME; SHOW TABLES;" 2>&1)

if echo "$TABLES" | grep -q "rooms"; then
    echo -e "${GREEN}✅ Tabelas criadas com sucesso:${NC}"
    echo "$TABLES"
else
    echo -e "${RED}❌ Erro: Tabelas não foram criadas${NC}"
    echo "$TABLES"
    exit 1
fi
echo ""

# 8. Testar conexão remota
echo "=================================================="
echo "7️⃣  TESTANDO CONEXÃO REMOTA"
echo "=================================================="

SERVER_IP=$(hostname -I | awk '{print $1}')
echo "IP deste servidor: $SERVER_IP"
echo ""
echo "Teste a conexão de outro servidor com:"
echo ""
echo "  mysql -h $SERVER_IP -P 3306 -u $DB_USER -p$DB_PASSWORD $DB_NAME -e \"SHOW TABLES;\""
echo ""

# 9. Resumo
echo "=================================================="
echo "✅ SETUP CONCLUÍDO COM SUCESSO!"
echo "=================================================="
echo ""
echo "Configurações do banco:"
echo "  Host: $SERVER_IP (ou 207.58.175.4)"
echo "  Porta: 3306"
echo "  Database: $DB_NAME"
echo "  Usuário: $DB_USER"
echo "  Senha: $DB_PASSWORD"
echo ""
echo "Configure estas variáveis no arquivo .env do servidor de aplicação:"
echo ""
echo "DB_HOST=$SERVER_IP"
echo "DB_PORT=3306"
echo "DB_USER=$DB_USER"
echo "DB_PASSWORD=$DB_PASSWORD"
echo "DB_NAME=$DB_NAME"
echo ""
echo "=================================================="
