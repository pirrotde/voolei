# Setup - Vôlei dos amigos 🏐

## Pré-requisitos

- Node.js 18+ ou Bun
- MariaDB/MySQL server

## Configuração

### 1. Instalar dependências

Primeiro, você precisa corrigir o erro de permissão do npm cache:

```bash
sudo chown -R 501:20 "/Users/brunomorais/.npm"
```

Depois instale as dependências:

```bash
npm install
```

### 2. Configurar variáveis de ambiente

O arquivo `.env` já está configurado com as credenciais do banco:

```env
DB_HOST=207.58.175.4
DB_PORT=3306
DB_USER=volei
DB_PASSWORD=volei2025
DB_NAME=volei
```

### 3. Criar tabelas no banco de dados

Execute o script de setup para criar todas as tabelas necessárias:

```bash
npm run db:setup
```

Isso irá:
- Conectar ao MariaDB
- Executar o schema.sql
- Criar todas as tabelas (rooms, players, queue, teams, etc.)
- Mostrar a lista de tabelas criadas

### 4. Iniciar os servidores

Você precisa rodar **2 servidores** em terminais separados:

**Terminal 1 - API Server (Backend):**
```bash
npm run api
```
Rodará em `http://localhost:3001`

**Terminal 2 - Frontend:**
```bash
npm run dev
```
Rodará em `http://localhost:8080`

⚠️ **IMPORTANTE**: O API server precisa estar rodando ANTES do frontend, senão não conseguirá salvar no banco!

## Como Usar

### Criando uma Sala

1. Ao abrir o app, você verá uma tela para criar ou entrar em uma sala
2. Clique em "Criar" e digite um nome para a sala (ex: "Vôlei da Quinta")
3. Um código único será gerado (ex: ABC123)
4. Compartilhe esse código com outros jogadores

### Entrando em uma Sala

1. Na tela inicial, clique em "Entrar"
2. Digite o código da sala compartilhado por quem criou
3. Você entrará na mesma sala e verá os mesmos dados sincronizados

### Gerenciando Jogadores

- Adicione jogadores pelo painel lateral (Nome + Gênero)
- Jogadores são automaticamente adicionados à fila
- Use "Pra fila" / "Tirar" para gerenciar quem está na fila

### Montando Times

- Clique em "Montar times" para formar 2 times de 4 jogadores
- O algoritmo garante 1 mulher por time (quando possível)
- Os próximos 8 jogadores da fila são selecionados

### Preview do Próximo Time

- Abaixo da quadra, você verá o "Próximo Time"
- Mostra os 4 próximos jogadores que entrarão quando houver uma troca
- Atualiza automaticamente conforme a fila muda

### Durante a Partida

- Use os botões +/- para marcar pontos
- O placar vai até 12 pontos (ou 14 em caso de empate 11x11)
- Ao atingir o alvo, o vencedor é declarado automaticamente
- O time perdedor volta para a fila
- Um novo desafiante é formado automaticamente

## Sincronização Multi-Dispositivo

Todos os dispositivos que entrarem na mesma sala (usando o mesmo código) verão os mesmos dados em tempo real:

- Jogadores cadastrados
- Fila de espera
- Times na quadra
- Placar atual
- Histórico de partidas

As mudanças são salvas automaticamente no banco MariaDB a cada alteração.

## Estrutura do Banco de Dados

- **rooms**: Salas de jogo com códigos únicos
- **players**: Jogadores cadastrados em cada sala
- **queue**: Ordem da fila de espera
- **teams**: Times atualmente em quadra (A e B)
- **team_players**: Relação entre times e jogadores
- **room_state**: Placar atual de cada sala
- **match_history**: Histórico das últimas 30 partidas

## Troubleshooting

### Erro ao instalar mysql2

Se encontrar erro de permissão ao instalar o mysql2:

```bash
sudo chown -R 501:20 "/Users/brunomorais/.npm"
npm cache clean --force
npm install mysql2
```

### Erro de conexão com o banco

Verifique se:
- O IP do MariaDB está acessível (207.58.175.4)
- A porta 3306 está aberta
- As credenciais estão corretas no .env
- O banco "volei" existe no servidor

### Porta 5173 já está em uso

```bash
npm run dev -- --port 3000
```
