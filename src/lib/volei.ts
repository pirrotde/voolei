export type Gender = "M" | "F";

export type Player = {
  id: string;
  name: string;
  gender: Gender;
};

export type Team = {
  id: string;
  players: Player[];
};

export type State = {
  players: Player[]; // cadastro
  queue: string[]; // ids na ordem da fila
  teamA: Team | null;
  teamB: Team | null;
  scoreA: number;
  scoreB: number;
  maxConsecutiveWins: number; // quantas partidas o time atual pode jogar antes de ser forçado a sair quando perder
  currentWinStreak: number; // partidas jogadas pelo time que está vencendo atualmente
  championTeamId: string | null; // ID do time que está vencendo (permanece até perder)
  history: {
    winnerNames: string[];
    loserNames: string[];
    scoreWin: number;
    scoreLose: number;
    at: number;
  }[];
  lastState?: State; // para desfazer última ação
};

export const STORAGE_KEY = "volei-galera-state-v2";

// Regras de pontuação: vai até 12; se empatar em 11x11, vai a 3 direto (alvo 14).
export const BASE_TARGET = 12;
export const TIE_POINT = 11;
export const TIE_TARGET = TIE_POINT + 3; // 14

export function currentTarget(a: number, b: number): number {
  if (a >= TIE_POINT && b >= TIE_POINT) return TIE_TARGET;
  return BASE_TARGET;
}

function emptyState(): State {
  return {
    players: [],
    queue: [],
    teamA: null,
    teamB: null,
    scoreA: 0,
    scoreB: 0,
    maxConsecutiveWins: 3, // padrão: 3 partidas seguidas
    currentWinStreak: 0,
    championTeamId: null,
    history: [],
  };
}

export function loadState(): State {
  if (typeof window === "undefined") return emptyState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) throw new Error("empty");
    const parsed = JSON.parse(raw) as Partial<State>;
    return { ...emptyState(), ...parsed };
  } catch {
    return emptyState();
  }
}

export function saveState(s: State) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export function uid() {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Monta um time de 4 a partir da fila, com balanceamento de gênero:
 * - Se houver 1 mulher disponível: garante 1 mulher no time
 * - Se houver 2+ mulheres disponíveis: permite até 2 mulheres no time
 * - Completa o resto com os próximos da fila na ordem
 */
export function pickTeam(
  queueIds: string[],
  byId: Record<string, Player>,
): { teamIds: string[]; rest: string[] } | null {
  if (queueIds.length < 4) return null;

  const picked: string[] = [];
  const remaining = [...queueIds];

  // Conta quantas mulheres estão na fila
  const femaleCount = remaining.filter((id) => byId[id]?.gender === "F").length;

  if (femaleCount >= 2) {
    // Se tem 2 ou mais mulheres, pega até 2 mulheres
    let femalesAdded = 0;
    for (let i = 0; i < remaining.length && femalesAdded < 2; i++) {
      if (byId[remaining[i]]?.gender === "F") {
        picked.push(remaining.splice(i, 1)[0]);
        femalesAdded++;
        i--; // Ajusta índice após remoção
      }
    }
  } else if (femaleCount === 1) {
    // Se tem exatamente 1 mulher, garante ela no time
    const femaleIdx = remaining.findIndex((id) => byId[id]?.gender === "F");
    if (femaleIdx !== -1) {
      picked.push(remaining.splice(femaleIdx, 1)[0]);
    }
  }
  // Se não tem mulheres (femaleCount === 0), não faz nada e pega os próximos da fila

  // Completa com os próximos da fila na ordem até ter 4 jogadores
  while (picked.length < 4 && remaining.length > 0) {
    picked.push(remaining.shift()!);
  }

  if (picked.length < 4) return null;
  return { teamIds: picked, rest: remaining };
}

export function buildTeam(ids: string[], byId: Record<string, Player>): Team {
  return { id: uid(), players: ids.map((id) => byId[id]).filter(Boolean) };
}
