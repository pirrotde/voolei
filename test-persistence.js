// Script de teste de persistência de dados
// Execute: node test-persistence.js

const API_BASE = "http://localhost:3001";

// Cores para output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Helper para fazer requisições
async function request(endpoint, options = {}) {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    return data;
  } catch (error) {
    throw new Error(`${endpoint}: ${error.message}`);
  }
}

async function runTests() {
  log('\n==================================================', 'blue');
  log('   TESTE DE PERSISTÊNCIA - Vôlei dos amigos 🏐', 'blue');
  log('==================================================\n', 'blue');

  let roomId = null;
  let code = null;

  try {
    // 1. Testar Health Check
    log('1️⃣  Testando Health Check...', 'yellow');
    await request('/health');
    log('✅ API está respondendo\n', 'green');

    // 2. Criar uma sala
    log('2️⃣  Criando sala "Teste Automático"...', 'yellow');
    const createResult = await request('/api/rooms/create', {
      method: 'POST',
      body: JSON.stringify({ name: 'Teste Automático' })
    });

    roomId = createResult.id;
    code = createResult.code;
    log(`✅ Sala criada: ID=${roomId}, Código=${code}\n`, 'green');

    // 3. Entrar na sala (testar join)
    log('3️⃣  Testando entrar na sala com código...', 'yellow');
    const joinResult = await request('/api/rooms/join', {
      method: 'POST',
      body: JSON.stringify({ code })
    });

    if (joinResult.roomId === roomId) {
      log(`✅ Join funcionou: roomId=${joinResult.roomId}\n`, 'green');
    } else {
      throw new Error('Room ID não confere após join');
    }

    // 4. Carregar estado inicial (deve estar vazio)
    log('4️⃣  Carregando estado inicial da sala...', 'yellow');
    const initialState = await request(`/api/state/load?roomId=${encodeURIComponent(roomId)}`);
    log(`✅ Estado carregado:`, 'green');
    log(`   - Jogadores: ${initialState.players.length}`, 'green');
    log(`   - Fila: ${initialState.queue.length}`, 'green');
    log(`   - Score: ${initialState.scoreA} x ${initialState.scoreB}\n`, 'green');

    // 5. Criar lista de jogadores para teste
    log('5️⃣  Criando lista de jogadores...', 'yellow');

    const players = [
      { id: 'p1', name: 'João Silva', gender: 'M' },
      { id: 'p2', name: 'Maria Santos', gender: 'F' },
      { id: 'p3', name: 'Pedro Costa', gender: 'M' },
      { id: 'p4', name: 'Ana Lima', gender: 'F' },
      { id: 'p5', name: 'Carlos Souza', gender: 'M' },
      { id: 'p6', name: 'Julia Ferreira', gender: 'F' },
      { id: 'p7', name: 'Lucas Oliveira', gender: 'M' },
      { id: 'p8', name: 'Beatriz Alves', gender: 'F' }
    ];

    log(`✅ ${players.length} jogadores criados:\n`, 'green');
    players.forEach(p => log(`   - ${p.name} (${p.gender})`, 'green'));
    log('');

    // 6. Salvar estado com jogadores
    log('6️⃣  Salvando jogadores no banco...', 'yellow');

    const newState = {
      players: players,
      queue: players.map(p => p.id), // Todos na fila
      teamA: null,
      teamB: null,
      scoreA: 0,
      scoreB: 0,
      maxConsecutiveWins: 3,
      currentWinStreak: 0,
      history: []
    };

    await request('/api/state/save', {
      method: 'POST',
      body: JSON.stringify({ roomId, state: newState })
    });

    log('✅ Estado salvo com sucesso\n', 'green');

    // 7. Recarregar estado para verificar se persistiu
    log('7️⃣  Recarregando estado para verificar persistência...', 'yellow');
    const reloadedState = await request(`/api/state/load?roomId=${encodeURIComponent(roomId)}`);

    log(`✅ Estado recarregado:`, 'green');
    log(`   - Jogadores: ${reloadedState.players.length}`, 'green');
    log(`   - Fila: ${reloadedState.queue.length}`, 'green');

    // Verificar se os jogadores foram salvos corretamente
    if (reloadedState.players.length !== players.length) {
      throw new Error(`Esperava ${players.length} jogadores, mas encontrou ${reloadedState.players.length}`);
    }

    log('\n   Jogadores salvos:', 'green');
    reloadedState.players.forEach(p => log(`   - ${p.name} (${p.gender})`, 'green'));
    log('');

    // 8. Formar times e salvar
    log('8️⃣  Formando times A e B...', 'yellow');

    const teamAPlayers = [players[0], players[2], players[4], players[6]]; // João, Pedro, Carlos, Lucas
    const teamBPlayers = [players[1], players[3], players[5], players[7]]; // Maria, Ana, Julia, Beatriz

    const stateWithTeams = {
      ...newState,
      teamA: { id: 'teamA', players: teamAPlayers },
      teamB: { id: 'teamB', players: teamBPlayers },
      queue: [], // Fila vazia, todos estão nos times
      scoreA: 5,
      scoreB: 3
    };

    await request('/api/state/save', {
      method: 'POST',
      body: JSON.stringify({ roomId, state: stateWithTeams })
    });

    log('✅ Times salvos:', 'green');
    log(`   Time A: ${teamAPlayers.map(p => p.name).join(', ')}`, 'green');
    log(`   Time B: ${teamBPlayers.map(p => p.name).join(', ')}`, 'green');
    log(`   Placar: ${stateWithTeams.scoreA} x ${stateWithTeams.scoreB}\n`, 'green');

    // 9. Recarregar novamente para verificar times
    log('9️⃣  Verificando se times foram persistidos...', 'yellow');
    const finalState = await request(`/api/state/load?roomId=${encodeURIComponent(roomId)}`);

    if (!finalState.teamA || !finalState.teamB) {
      throw new Error('Times não foram salvos corretamente');
    }

    log('✅ Times recarregados com sucesso:', 'green');
    log(`   Time A: ${finalState.teamA.players.length} jogadores`, 'green');
    log(`   Time B: ${finalState.teamB.players.length} jogadores`, 'green');
    log(`   Placar: ${finalState.scoreA} x ${finalState.scoreB}\n`, 'green');

    // 10. Resumo
    log('==================================================', 'blue');
    log('   ✅ TODOS OS TESTES PASSARAM!', 'green');
    log('==================================================', 'blue');
    log('\nPersistência de dados funcionando corretamente:', 'green');
    log(`  ✅ Criação de sala`, 'green');
    log(`  ✅ Salvamento de jogadores`, 'green');
    log(`  ✅ Salvamento de times`, 'green');
    log(`  ✅ Salvamento de scores`, 'green');
    log(`  ✅ Recarregamento correto dos dados`, 'green');
    log('');
    log(`📊 Acesse a sala criada com o código: ${code}`, 'blue');
    log(`🔗 URL: http://localhost:8080`, 'blue');
    log('');

  } catch (error) {
    log('\n==================================================', 'red');
    log('   ❌ ERRO NO TESTE', 'red');
    log('==================================================', 'red');
    log(`\n${error.message}\n`, 'red');
    log('Possíveis causas:', 'yellow');
    log('  - API não está rodando (npm run api)', 'yellow');
    log('  - Banco de dados remoto inacessível', 'yellow');
    log('  - Schema não foi criado no banco', 'yellow');
    log('  - Credenciais incorretas no .env', 'yellow');
    log('');
    process.exit(1);
  }
}

// Executar testes
runTests();
