import type { State } from "./volei";

// Usa URL relativa em produção (mesma origem) ou localhost em dev
const API_BASE_URL = typeof window !== 'undefined' && window.location.hostname !== 'localhost'
  ? `//${window.location.host}/api`
  : (import.meta.env.VITE_API_URL || "http://localhost:3001");

export async function createRoomFn(name: string): Promise<{ id: string; code: string }> {
  const response = await fetch(`${API_BASE_URL}/api/rooms/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Erro ao criar sala");
  }

  return response.json();
}

export async function joinRoomFn(code: string): Promise<{ roomId: string }> {
  const response = await fetch(`${API_BASE_URL}/api/rooms/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Erro ao entrar na sala");
  }

  return response.json();
}

export async function loadStateFn(roomId: string): Promise<State> {
  const response = await fetch(`${API_BASE_URL}/api/state/load?roomId=${encodeURIComponent(roomId)}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Erro ao carregar estado");
  }

  return response.json();
}

export async function saveStateFn(roomId: string, state: State): Promise<{ success: true }> {
  const response = await fetch(`${API_BASE_URL}/api/state/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roomId, state }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Erro ao salvar estado");
  }

  return response.json();
}
