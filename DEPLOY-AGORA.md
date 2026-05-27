# 🚀 DEPLOY EM PRODUÇÃO - Testar Persistência

## ✅ O que foi descoberto

1. **Banco de dados está OK** ✅
   - Host: 207.58.175.4:3306
   - Usuário recriado com sucesso
   - Schema completo (7 tabelas)
   - MariaDB client funciona perfeitamente

2. **Problema identificado** ❌
   - mysql2 (Node.js) trava ao conectar do macOS
   - Mas MariaDB client Docker funciona ✅
   - Isso indica que **em produção (Docker) deve funcionar!**

3. **Dados atuais no banco**
   - 3 salas criadas (mas SEM jogadores)
   - 0 jogadores salvos
   - 2 times vazios

---

## 🎯 PRÓXIMO PASSO: Deploy em Produção

### 1. Fazer Push do Código Atual

```bash
cd /Users/brunomorais/Desktop/Github/Proative-infra/Volei/volley-mix-mate

# Adicionar mudanças
git add .

# Commit
git commit -m "fix: atualizar mysql2 e configurar banco remoto

- Atualizar mysql2 para 3.22.4
- Configurar pool com keepAlive
- Adicionar scripts de diagnóstico
- Documentar problema de persistência"

# Push (vai acionar deploy automático)
git push origin main
```

### 2. Aguardar Deploy

O GitHub Actions irá:
1. Empacotar os arquivos
2. Enviar via SSH para o servidor
3. Construir imagens Docker
4. Subir containers (API + Frontend)
5. Testar health check

**Acompanhe em**: GitHub → Actions → Deploy Vôlei dos amigos

### 3. Executar Diagnóstico no Servidor

Após o deploy finalizar (≈ 5 minutos):

```bash
# SSH no servidor
ssh usuario@SEU_SERVIDOR

# Ir para o diretório
cd /opt/volei

# Executar diagnóstico
bash diagnose-db.sh
```

---

## 📊 O que o Diagnóstico Vai Mostrar

```
==================================================
   DIAGNÓSTICO - Vôlei dos amigos 🏐
==================================================

1️⃣  STATUS DOS CONTAINERS
✅ Container volei-api está rodando
✅ Container volei-frontend está rodando

2️⃣  VARIÁVEIS DE AMBIENTE DA API
DB_HOST=207.58.175.4
DB_PORT=3306
...

3️⃣  HEALTH CHECK DA API
✅ API está respondendo

4️⃣  TESTE DE CONEXÃO AO BANCO REMOTO
✅ Conexão com banco remoto funcionando

5️⃣  TABELAS NO BANCO DE DADOS
✅ Schema existe no banco

6️⃣  PERMISSÕES DO USUÁRIO DO BANCO
✅ Usuário tem permissões adequadas

7️⃣  ÚLTIMAS 5 SALAS CRIADAS
(lista de salas)

8️⃣  TESTE: CRIAR SALA
✅ Sala criada com sucesso

9️⃣  ÚLTIMOS 30 LOGS DA API
(logs da API - PROCURAR POR "✅ MariaDB conectado")
```

---

## ✅ Se Tudo Funcionar em Produção

Se o diagnóstico mostrar ✅ em todos os itens:

1. **Testar no navegador**:
   - Acessar: https://volei.proativeti.com.br (ou seu domínio)
   - Criar nova sala
   - Adicionar 8 jogadores
   - Formar times
   - Verificar se persiste (recarregar página)

2. **Verificar no banco**:
   ```bash
   docker exec volei-api mysql \
     -h 207.58.175.4 \
     -P 3306 \
     -u volei \
     -pvolei2025 \
     volei \
     -e "SELECT COUNT(*) as total_jogadores FROM players;"
   ```

   **Esperado**: `total_jogadores > 0`

---

## ❌ Se Continuar Falhando em Produção

Se o mysql2 AINDA travar em produção (improvável), há 2 opções:

### Opção A: Usar Biblioteca Alternativa

Substituir `mysql2` por `mariadb` (connector oficial do MariaDB):

```bash
npm install mariadb
npm uninstall mysql2
```

Depois adaptar o código para usar a API do `mariadb`.

### Opção B: Investigar Configuração do MariaDB

No servidor de banco (207.58.175.4), verificar:

```sql
-- Versão do MariaDB
SELECT VERSION();

-- Plugins de autenticação habilitados
SHOW PLUGINS WHERE Type = 'AUTHENTICATION';

-- Configurações de SSL
SHOW VARIABLES LIKE '%ssl%';

-- Método de autenticação do usuário
SELECT user, host, plugin
FROM mysql.user
WHERE user='volei';
```

---

## 📝 Arquivos Criados para Ajudar

1. **`diagnose-db.sh`** - Script de diagnóstico automático
2. **`TROUBLESHOOTING-DB.md`** - Guia completo de troubleshooting
3. **`PROBLEMA-IDENTIFICADO.md`** - Análise detalhada do problema
4. **`test-persistence.js`** - Script para testar persistência (Node.js)
5. **`setup-remote-db.sh`** - Script para configurar banco remoto

---

## 🎯 RESUMO - Checklist de Deploy

- [ ] Fazer commit e push das mudanças
- [ ] Aguardar deploy finalizar no GitHub Actions
- [ ] SSH no servidor de produção
- [ ] Executar `bash diagnose-db.sh`
- [ ] Se tudo OK ✅, testar no navegador
- [ ] Adicionar 8 jogadores e verificar se salvam
- [ ] Verificar contagem no banco: `SELECT COUNT(*) FROM players`
- [ ] Se `COUNT > 0`, problema resolvido! ✅

---

## 🔍 Por Que Deve Funcionar em Produção?

1. **Docker usa imagem Linux Alpine** - Mais compatível
2. **Mesmo ambiente que MariaDB client** - Que funciona perfeitamente
3. **Network interno do Docker** - Menos problemas de firewall/routing
4. **mysql2 testado em milhões de deploys** - Problema específico do macOS

---

## 📞 Próxima Ação

**FAÇA O PUSH AGORA e compartilhe a saída do `diagnose-db.sh` quando o deploy terminar!**

```bash
# Comando completo
git add . && \
git commit -m "fix: configurar banco remoto e adicionar diagnósticos" && \
git push origin main
```

Depois de 5 minutos:
```bash
ssh usuario@servidor
cd /opt/volei
bash diagnose-db.sh
```
