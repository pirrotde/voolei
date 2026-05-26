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
  history: { winnerNames: string[]; loserNames: string[]; at: number }[];
};

export const STORAGE_KEY = "volei-galera-state-v1";

export function loadState(): State {
  if (typeof window === "undefined")
    return { players: [], queue: [], teamA: null, teamB: null, history: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) throw new Error("empty");
    return JSON.parse(raw) as State;
  } catch {
    return { players: [], queue: [], teamA: null, teamB: null, history: [] };
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
 * Monta um time de 4 a partir da fila, garantindo (se possível) 1 mulher.
 * Retorna os ids selecionados e a fila restante (mantendo a ordem dos demais).
 */
export function pickTeam(
  queueIds: string[],
  byId: Record<string, Player>,
): { teamIds: string[]; rest: string[] } | null {
  if (queueIds.length < 4) return null;

  const picked: string[] = [];
  const remaining = [...queueIds];

  // 1) tenta pegar a primeira mulher da fila
  const firstFemaleIdx = remaining.findIndex((id) => byId[id]?.gender === "F");
  if (firstFemaleIdx !== -1) {
    picked.push(remaining.splice(firstFemaleIdx, 1)[0]);
  }

  // 2) completa com os próximos da fila na ordem
  while (picked.length < 4 && remaining.length > 0) {
    picked.push(remaining.shift()!);
  }

  if (picked.length < 4) return null;
  return { teamIds: picked, rest: remaining };
}

export function buildTeam(ids: string[], byId: Record<string, Player>): Team {
  return { id: uid(), players: ids.map((id) => byId[id]).filter(Boolean) };
}
