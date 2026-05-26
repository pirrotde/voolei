import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import pool from "./db";
import { uid, type Player, type State, type Team } from "./volei";

// Tipos do banco
interface RoomRow extends RowDataPacket {
  id: string;
  code: string;
  name: string;
}

interface PlayerRow extends RowDataPacket {
  id: string;
  room_id: string;
  name: string;
  gender: "M" | "F";
}

interface QueueRow extends RowDataPacket {
  player_id: string;
  position: number;
}

interface TeamRow extends RowDataPacket {
  id: string;
  team_label: "A" | "B";
}

interface TeamPlayerRow extends RowDataPacket {
  player_id: string;
}

interface RoomStateRow extends RowDataPacket {
  score_a: number;
  score_b: number;
}

interface HistoryRow extends RowDataPacket {
  winner_names: string;
  loser_names: string;
  score_win: number;
  score_lose: number;
  played_at: Date;
}

// Gera um código único de sala (6 dígitos)
function generateRoomCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Cria uma nova sala
export async function createRoom(name: string): Promise<{ id: string; code: string }> {
  const roomId = uid();
  const code = generateRoomCode();

  await pool.execute(
    "INSERT INTO rooms (id, code, name) VALUES (?, ?, ?)",
    [roomId, code, name]
  );

  await pool.execute(
    "INSERT INTO room_state (room_id, score_a, score_b) VALUES (?, 0, 0)",
    [roomId]
  );

  return { id: roomId, code };
}

// Busca sala por código
export async function getRoomByCode(code: string): Promise<string | null> {
  const [rows] = await pool.execute<RoomRow[]>(
    "SELECT id FROM rooms WHERE code = ?",
    [code]
  );

  return rows.length > 0 ? rows[0].id : null;
}

// Carrega o estado completo da sala
export async function loadRoomState(roomId: string): Promise<State> {
  // Busca players
  const [playerRows] = await pool.execute<PlayerRow[]>(
    "SELECT id, name, gender FROM players WHERE room_id = ? ORDER BY created_at",
    [roomId]
  );

  const players: Player[] = playerRows.map((row) => ({
    id: row.id,
    name: row.name,
    gender: row.gender,
  }));

  // Busca queue
  const [queueRows] = await pool.execute<QueueRow[]>(
    "SELECT player_id FROM queue WHERE room_id = ? ORDER BY position",
    [roomId]
  );

  const queue = queueRows.map((row) => row.player_id);

  // Busca teams
  const [teamRows] = await pool.execute<TeamRow[]>(
    "SELECT id, team_label FROM teams WHERE room_id = ?",
    [roomId]
  );

  let teamA: Team | null = null;
  let teamB: Team | null = null;

  for (const teamRow of teamRows) {
    const [playerIds] = await pool.execute<TeamPlayerRow[]>(
      "SELECT player_id FROM team_players WHERE team_id = ?",
      [teamRow.id]
    );

    const teamPlayers = playerIds
      .map((p) => players.find((pl) => pl.id === p.player_id))
      .filter(Boolean) as Player[];

    const team: Team = {
      id: teamRow.id,
      players: teamPlayers,
    };

    if (teamRow.team_label === "A") teamA = team;
    else teamB = team;
  }

  // Busca scores
  const [stateRows] = await pool.execute<RoomStateRow[]>(
    "SELECT score_a, score_b FROM room_state WHERE room_id = ?",
    [roomId]
  );

  const scoreA = stateRows.length > 0 ? stateRows[0].score_a : 0;
  const scoreB = stateRows.length > 0 ? stateRows[0].score_b : 0;

  // Busca histórico
  const [historyRows] = await pool.execute<HistoryRow[]>(
    "SELECT winner_names, loser_names, score_win, score_lose, played_at FROM match_history WHERE room_id = ? ORDER BY played_at DESC LIMIT 30",
    [roomId]
  );

  const history = historyRows.map((row) => ({
    winnerNames: JSON.parse(row.winner_names) as string[],
    loserNames: JSON.parse(row.loser_names) as string[],
    scoreWin: row.score_win,
    scoreLose: row.score_lose,
    at: row.played_at.getTime(),
  }));

  return {
    players,
    queue,
    teamA,
    teamB,
    scoreA,
    scoreB,
    history,
  };
}

// Salva o estado completo da sala
export async function saveRoomState(roomId: string, state: State): Promise<void> {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // Limpa dados antigos da sala (exceto histórico)
    await conn.execute("DELETE FROM team_players WHERE team_id IN (SELECT id FROM teams WHERE room_id = ?)", [roomId]);
    await conn.execute("DELETE FROM teams WHERE room_id = ?", [roomId]);
    await conn.execute("DELETE FROM queue WHERE room_id = ?", [roomId]);
    await conn.execute("DELETE FROM players WHERE room_id = ?", [roomId]);

    // Insere players
    for (const player of state.players) {
      await conn.execute(
        "INSERT INTO players (id, room_id, name, gender) VALUES (?, ?, ?, ?)",
        [player.id, roomId, player.name, player.gender]
      );
    }

    // Insere queue
    for (let i = 0; i < state.queue.length; i++) {
      await conn.execute(
        "INSERT INTO queue (room_id, player_id, position) VALUES (?, ?, ?)",
        [roomId, state.queue[i], i]
      );
    }

    // Insere teams
    if (state.teamA) {
      await conn.execute(
        "INSERT INTO teams (id, room_id, team_label) VALUES (?, ?, 'A')",
        [state.teamA.id, roomId]
      );

      for (const player of state.teamA.players) {
        await conn.execute(
          "INSERT INTO team_players (team_id, player_id) VALUES (?, ?)",
          [state.teamA.id, player.id]
        );
      }
    }

    if (state.teamB) {
      await conn.execute(
        "INSERT INTO teams (id, room_id, team_label) VALUES (?, ?, 'B')",
        [state.teamB.id, roomId]
      );

      for (const player of state.teamB.players) {
        await conn.execute(
          "INSERT INTO team_players (team_id, player_id) VALUES (?, ?)",
          [state.teamB.id, player.id]
        );
      }
    }

    // Atualiza scores
    await conn.execute(
      "UPDATE room_state SET score_a = ?, score_b = ? WHERE room_id = ?",
      [state.scoreA, state.scoreB, roomId]
    );

    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

// Adiciona uma partida ao histórico
export async function addMatchHistory(
  roomId: string,
  winnerNames: string[],
  loserNames: string[],
  scoreWin: number,
  scoreLose: number
): Promise<void> {
  await pool.execute(
    "INSERT INTO match_history (room_id, winner_names, loser_names, score_win, score_lose) VALUES (?, ?, ?, ?, ?)",
    [roomId, JSON.stringify(winnerNames), JSON.stringify(loserNames), scoreWin, scoreLose]
  );
}
