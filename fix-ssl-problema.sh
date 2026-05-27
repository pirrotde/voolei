#!/bin/bash
# Script para diagnosticar problema SSL
# Execute no servidor: bash fix-ssl-problema.sh

echo "=================================================="
echo "   DIAGNÓSTICO SSL - Vôlei"
echo "=================================================="
echo ""

cd /opt/volei 2>/dev/null || {
    echo "❌ Diretório /opt/volei não encontrado"
    exit 1
}

# Cores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 1. Verificar containers rodando
echo "1️⃣  CONTAINERS RODANDO"
echo "---"
docker ps --filter "name=volei" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""

# 2. Verificar variáveis de ambiente do frontend
echo "2️⃣  VARIÁVEIS DE AMBIENTE (FRONTEND)"
echo "---"
docker exec volei-frontend env | grep -E "VIRTUAL_HOST|LETSENCRYPT|CLOUDFLARE" | sed 's/PASSWORD=.*/PASSWORD=***/'
echo ""

# 3. Verificar rede Infra
echo "3️⃣  REDE INFRA"
echo "---"
if docker network inspect Infra >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Rede Infra existe${NC}"
    echo "Containers na rede:"
    docker network inspect Infra --format='{{range .Containers}}{{.Name}} {{end}}'
else
    echo -e "${RED}❌ Rede Infra NÃO existe!${NC}"
    echo "Solução: docker network create Infra"
fi
echo ""

# 4. Verificar nginx-proxy
echo "4️⃣  NGINX-PROXY"
echo "---"
if docker ps | grep -q nginx-proxy; then
    echo -e "${GREEN}✅ nginx-proxy está rodando${NC}"
    docker ps --filter "name=nginx-proxy" --format "table {{.Names}}\t{{.Status}}"

    # Verificar logs do nginx-proxy
    echo ""
    echo "Últimas 10 linhas do nginx-proxy:"
    docker logs nginx-proxy --tail=10 2>&1 | grep -i "volei\|error" || echo "Sem logs relevantes"
else
    echo -e "${RED}❌ nginx-proxy NÃO está rodando${NC}"
    echo "A infraestrutura nginx-proxy precisa estar ativa!"
fi
echo ""

# 5. Verificar acme-companion (Let's Encrypt)
echo "5️⃣  ACME-COMPANION (Let's Encrypt)"
echo "---"
if docker ps | grep -q acme-companion; then
    echo -e "${GREEN}✅ acme-companion está rodando${NC}"

    echo ""
    echo "Últimas 20 linhas relacionadas ao domínio:"
    docker logs nginx-proxy-acme --tail=50 2>&1 | grep -i "volei.proativeti.com.br" | tail -20 || echo "Sem logs do domínio"
else
    echo -e "${RED}❌ acme-companion NÃO está rodando${NC}"
    echo "Certificados SSL não serão gerados!"
fi
echo ""

# 6. Verificar DNS
echo "6️⃣  RESOLUÇÃO DNS"
echo "---"
DOMAIN=$(docker exec volei-frontend env 2>/dev/null | grep VIRTUAL_HOST | cut -d= -f2)
if [ -z "$DOMAIN" ]; then
    DOMAIN="volei.proativeti.com.br"
fi

echo "Domínio: $DOMAIN"
echo ""
echo "Resolvendo DNS..."
dig +short $DOMAIN || nslookup $DOMAIN | grep Address || echo "Falha ao resolver DNS"
echo ""

# 7. Testar conexão HTTP (sem SSL)
echo "7️⃣  TESTE HTTP (porta 80)"
echo "---"
HTTP_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080 2>/dev/null)
if [ "$HTTP_RESPONSE" = "200" ] || [ "$HTTP_RESPONSE" = "301" ] || [ "$HTTP_RESPONSE" = "302" ]; then
    echo -e "${GREEN}✅ Frontend responde na porta 8080: HTTP $HTTP_RESPONSE${NC}"
else
    echo -e "${RED}❌ Frontend NÃO responde na porta 8080: HTTP $HTTP_RESPONSE${NC}"
fi
echo ""

# 8. Verificar certificados existentes
echo "8️⃣  CERTIFICADOS SSL"
echo "---"
if docker exec nginx-proxy ls /etc/nginx/certs 2>/dev/null | grep -q "$DOMAIN"; then
    echo -e "${GREEN}✅ Certificados encontrados para $DOMAIN:${NC}"
    docker exec nginx-proxy ls -lh /etc/nginx/certs | grep "$DOMAIN"
else
    echo -e "${YELLOW}⚠️  Certificados ainda não foram gerados para $DOMAIN${NC}"
    echo "Aguarde 1-5 minutos ou verifique logs do acme-companion"
fi
echo ""

# 9. Verificar configuração nginx
echo "9️⃣  CONFIGURAÇÃO NGINX"
echo "---"
if docker exec nginx-proxy ls /etc/nginx/conf.d 2>/dev/null | grep -q "$DOMAIN"; then
    echo -e "${GREEN}✅ Configuração nginx existe para $DOMAIN${NC}"
    echo "Arquivo: $(docker exec nginx-proxy ls /etc/nginx/conf.d | grep $DOMAIN)"
else
    echo -e "${RED}❌ Configuração nginx NÃO foi gerada para $DOMAIN${NC}"
    echo "nginx-proxy não detectou o container!"
fi
echo ""

# 10. Labels do container
echo "🔟 LABELS DO CONTAINER FRONTEND"
echo "---"
docker inspect volei-frontend --format='{{range $key, $value := .Config.Labels}}{{$key}}={{$value}}{{println}}{{end}}' 2>/dev/null | grep -E "nginx-proxy|com.github" || echo "Sem labels nginx-proxy"
echo ""

# 11. Resumo e Recomendações
echo "=================================================="
echo "🎯 RESUMO E RECOMENDAÇÕES"
echo "=================================================="

ISSUES=0

# Verificar problemas
if ! docker network inspect Infra >/dev/null 2>&1; then
    echo -e "${RED}❌ Rede Infra não existe${NC}"
    echo "   → docker network create Infra"
    ISSUES=$((ISSUES + 1))
fi

if ! docker ps | grep -q nginx-proxy; then
    echo -e "${RED}❌ nginx-proxy não está rodando${NC}"
    echo "   → Inicie a infraestrutura nginx-proxy primeiro"
    ISSUES=$((ISSUES + 1))
fi

if ! docker ps | grep -q acme-companion; then
    echo -e "${RED}❌ acme-companion não está rodando${NC}"
    echo "   → Certificados SSL não serão gerados"
    ISSUES=$((ISSUES + 1))
fi

if ! docker exec nginx-proxy ls /etc/nginx/certs 2>/dev/null | grep -q "$DOMAIN"; then
    echo -e "${YELLOW}⚠️  Certificados SSL ainda não foram gerados${NC}"
    echo "   → Aguarde 1-5 minutos e recarregue a página"
    echo "   → Ou force renovação: docker restart nginx-proxy-acme"
fi

if [ $ISSUES -eq 0 ]; then
    echo -e "${GREEN}✅ Infraestrutura parece OK${NC}"
    echo ""
    echo "Se o SSL ainda não funciona:"
    echo "1. Aguarde 5 minutos para Let's Encrypt validar"
    echo "2. Acesse via HTTP primeiro: http://$DOMAIN"
    echo "3. Verifique logs: docker logs nginx-proxy-acme --tail=50"
    echo "4. Force renovação: docker restart nginx-proxy-acme"
else
    echo ""
    echo -e "${RED}$ISSUES problema(s) encontrado(s)${NC}"
fi

echo ""
echo "=================================================="
echo "Diagnóstico concluído em $(date)"
echo "=================================================="
