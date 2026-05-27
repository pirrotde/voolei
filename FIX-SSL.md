# 🔒 FIX SSL - ERR_SSL_UNRECOGNIZED_NAME_ALERT

## ❌ Erro Atual
```
ERR_SSL_UNRECOGNIZED_NAME_ALERT
https://volei.proativeti.com.br/
```

**Causa**: Certificado SSL não foi gerado ou nginx-proxy não detectou o container.

---

## 🚀 SOLUÇÃO RÁPIDA (Execute no servidor)

### 1. SSH no Servidor
```bash
ssh usuario@SEU_SERVIDOR
cd /opt/volei
```

### 2. Executar Diagnóstico
```bash
bash fix-ssl-problema.sh
```

Isso vai mostrar EXATAMENTE qual é o problema.

---

## 🔧 SOLUÇÕES COMUNS

### Problema A: Rede "Infra" não existe

**Sintoma**: Script mostra "❌ Rede Infra NÃO existe"

**Solução**:
```bash
docker network create Infra
docker-compose -f docker-compose.remote-db.yml -p volei down
docker-compose -f docker-compose.remote-db.yml -p volei up -d
```

---

### Problema B: nginx-proxy não está rodando

**Sintoma**: Script mostra "❌ nginx-proxy NÃO está rodando"

**Solução**: A infraestrutura nginx-proxy precisa estar ativa!

Verifique se você tem o nginx-proxy-automation rodando:
```bash
docker ps | grep nginx-proxy
```

Se NÃO estiver rodando, inicie a infraestrutura:
```bash
cd /caminho/para/nginx-proxy-automation
docker-compose up -d
```

---

### Problema C: Certificado ainda não foi gerado

**Sintoma**: Script mostra "⚠️ Certificados SSL ainda não foram gerados"

**Solução 1 - Aguardar**:
- Aguarde 5 minutos
- O Let's Encrypt precisa validar o domínio
- Recarregue a página depois

**Solução 2 - Forçar renovação**:
```bash
# Reiniciar acme-companion
docker restart nginx-proxy-acme

# Aguardar 2 minutos
sleep 120

# Verificar logs
docker logs nginx-proxy-acme --tail=30 | grep volei.proativeti.com.br
```

**Solução 3 - Recriar containers**:
```bash
cd /opt/volei
docker-compose -f docker-compose.remote-db.yml -p volei down
docker-compose -f docker-compose.remote-db.yml -p volei up -d

# Aguardar 3 minutos para SSL ser gerado
sleep 180
```

---

### Problema D: DNS não está resolvendo

**Sintoma**: Script mostra erro ao resolver DNS

**Solução**: Verificar DNS no Cloudflare

1. Acesse Cloudflare Dashboard
2. Vá em DNS
3. Verifique se existe registro A para `volei.proativeti.com.br`
4. Deve apontar para o IP do servidor
5. **Proxy status**: Pode estar ON (laranja) ou OFF (cinza)

Se não existir, criar:
```
Type: A
Name: volei
Content: IP_DO_SERVIDOR
Proxy: OFF (para testar)
TTL: Auto
```

Aguarde 1-5 minutos para propagação.

---

## 🔍 VERIFICAÇÕES MANUAIS

### 1. Testar HTTP (sem SSL) primeiro
```bash
curl -v http://volei.proativeti.com.br
```

Se funcionar, o problema é só o SSL.

### 2. Verificar se container está na rede Infra
```bash
docker network inspect Infra | grep volei-frontend
```

Deve aparecer `volei-frontend` na lista.

### 3. Verificar labels do container
```bash
docker inspect volei-frontend | grep -A 5 Labels
```

Deve ter:
```
"com.github.nginx-proxy.nginx-proxy.enable": "true"
```

### 4. Verificar logs do nginx-proxy
```bash
docker logs nginx-proxy --tail=50 | grep volei
```

Procurar por:
- ✅ `volei.proativeti.com.br` sendo detectado
- ❌ Erros de certificado

### 5. Verificar logs do acme-companion
```bash
docker logs nginx-proxy-acme --tail=100 | grep volei
```

Procurar por:
- ✅ `Creating/renewal certificate for volei.proativeti.com.br`
- ❌ `Challenge failed` ou erros de validação

---

## 🎯 TESTE RÁPIDO

Depois de aplicar correções, teste:

```bash
# 1. HTTP deve funcionar
curl -I http://volei.proativeti.com.br

# 2. HTTPS pode redirecionar ou funcionar
curl -I https://volei.proativeti.com.br

# 3. Verificar certificado
echo | openssl s_client -servername volei.proativeti.com.br -connect volei.proativeti.com.br:443 2>/dev/null | grep -A 2 "Verify return code"
```

---

## ✅ SOLUÇÃO DEFINITIVA (se nada funcionar)

Se NADA acima resolver, recrie tudo do zero:

```bash
cd /opt/volei

# 1. Parar tudo
docker-compose -f docker-compose.remote-db.yml -p volei down

# 2. Limpar volumes (cuidado - apaga dados locais, mas banco é remoto então OK)
docker volume prune -f

# 3. Garantir que rede Infra existe
docker network create Infra 2>/dev/null || true

# 4. Subir novamente
docker-compose -f docker-compose.remote-db.yml -p volei up -d

# 5. Verificar logs em tempo real
docker logs volei-frontend -f
```

Aguarde 5 minutos e teste novamente.

---

## 🆘 SE CONTINUAR COM PROBLEMA

Compartilhe:
1. Saída completa do `bash fix-ssl-problema.sh`
2. Resultado de `docker ps | grep nginx-proxy`
3. Últimas 50 linhas: `docker logs nginx-proxy-acme --tail=50`

---

## 📝 CHECKLIST FINAL

Execute no servidor:

- [ ] `docker network ls | grep Infra` → Rede existe
- [ ] `docker ps | grep nginx-proxy` → nginx-proxy rodando
- [ ] `docker ps | grep acme` → acme-companion rodando
- [ ] `docker ps | grep volei` → volei-api e volei-frontend rodando
- [ ] `docker network inspect Infra | grep volei` → containers na rede
- [ ] `curl http://localhost:8080` → Frontend responde localmente
- [ ] `dig +short volei.proativeti.com.br` → DNS resolve
- [ ] Aguardar 5 minutos após restart
- [ ] Testar: `https://volei.proativeti.com.br`

Se TODOS os itens estiverem OK, o SSL deve funcionar em até 5 minutos!
