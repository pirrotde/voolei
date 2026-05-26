// Servidor Express para API REST com MariaDB
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mysql from "mysql2/promise";

dotenv.config();

const app = express();
const PORT = process.env.API_PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json());

// Pool de conexões MariaDB
const pool = mysql.createPool({
  host: process.env.DB_HOST || "207.58.175.4",
  port: parseInt(process.env.DB_PORT || "3306"),
  user: process.env.DB_USER || "volei",
  password: process.env.DB_PASSWORD || "volei2025",
  database: process.env.DB_NAME || "volei",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Teste de conexão
pool.getConnection()
  .then((conn) => {
    console.log("✅ MariaDB conectado");
    conn.release();
  })
  .catch((err) => {
    console.error("❌ Erro ao conectar MariaDB:", err);
  });

// Utilitários
function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

// ==================== ROTAS ====================

// POST /api/rooms/create - Cria nova sala
app.post("/api/rooms/create", async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || typeof name !== "string") {
      return res.status(400).json({ error: "Nome da sala é obrigatório" });
    }

    const roomId = generateId();
    const code = generateRoomCode();

    await pool.execute(
      "INSERT INTO rooms (id, code, name) VALUES (?, ?, ?)",
      [roomId, code, name]
    );

    await pool.execute(
      "INSERT INTO room_state (room_id, score_a, score_b, max_consecutive_wins, current_win_streak) VALUES (?, 0, 0, 3, 0)",
      [roomId]
    );

    res.json({ id: roomId, code });
  } catch (error) {
    console.error("Erro ao criar sala:", error);
    res.status(500).json({ error: "Erro ao criar sala" });
  }
});

// POST /api/rooms/join - Entra em uma sala
app.post("/api/rooms/join", async (req, res) => {
  try {
    const { code } = req.body;

    if (!code || typeof code !== "string") {
      return res.status(400).json({ error: "Código da sala é obrigatório" });
    }

    const [rows] = await pool.execute(
      "SELECT id FROM rooms WHERE code = ?",
      [code]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Sala não encontrada" });
    }

    res.json({ roomId: rows[0].id });
  } catch (error) {
    console.error("Erro ao entrar na sala:", error);
    res.status(500).json({ error: "Erro ao entrar na sala" });
  }
});

// GET /api/state/load - Carrega estado da sala
app.get("/api/state/load", async (req, res) => {
  try {
    const { roomId } = req.query;

    if (!roomId) {
      return res.status(400).json({ error: "roomId é obrigatório" });
    }

    // Busca players
    const [playerRows] = await pool.execute(
      "SELECT id, name, gender FROM players WHERE room_id = ? ORDER BY created_at",
      [roomId]
    );

    const players = playerRows.map((row) => ({
      id: row.id,
      name: row.name,
      gender: row.gender,
    }));

    // Busca queue
    const [queueRows] = await pool.execute(
      "SELECT player_id FROM queue WHERE room_id = ? ORDER BY position",
      [roomId]
    );

    const queue = queueRows.map((row) => row.player_id);

    // Busca teams
    const [teamRows] = await pool.execute(
      "SELECT id, team_label FROM teams WHERE room_id = ?",
      [roomId]
    );

    let teamA = null;
    let teamB = null;

    for (const teamRow of teamRows) {
      const [playerIds] = await pool.execute(
        "SELECT player_id FROM team_players WHERE team_id = ?",
        [teamRow.id]
      );

      const teamPlayers = playerIds
        .map((p) => players.find((pl) => pl.id === p.player_id))
        .filter(Boolean);

      const team = {
        id: teamRow.id,
        players: teamPlayers,
      };

      if (teamRow.team_label === "A") teamA = team;
      else teamB = team;
    }

    // Busca scores e permanência
    const [stateRows] = await pool.execute(
      "SELECT score_a, score_b, max_consecutive_wins, current_win_streak FROM room_state WHERE room_id = ?",
      [roomId]
    );

    const scoreA = stateRows.length > 0 ? stateRows[0].score_a : 0;
    const scoreB = stateRows.length > 0 ? stateRows[0].score_b : 0;
    const maxConsecutiveWins = stateRows.length > 0 ? stateRows[0].max_consecutive_wins : 3;
    const currentWinStreak = stateRows.length > 0 ? stateRows[0].current_win_streak : 0;

    // Busca histórico
    const [historyRows] = await pool.execute(
      "SELECT winner_names, loser_names, score_win, score_lose, played_at FROM match_history WHERE room_id = ? ORDER BY played_at DESC LIMIT 30",
      [roomId]
    );

    const history = historyRows.map((row) => ({
      winnerNames: JSON.parse(row.winner_names),
      loserNames: JSON.parse(row.loser_names),
      scoreWin: row.score_win,
      scoreLose: row.score_lose,
      at: new Date(row.played_at).getTime(),
    }));

    res.json({
      players,
      queue,
      teamA,
      teamB,
      scoreA,
      scoreB,
      maxConsecutiveWins,
      currentWinStreak,
      history,
    });
  } catch (error) {
    console.error("Erro ao carregar estado:", error);
    res.status(500).json({ error: "Erro ao carregar estado" });
  }
});

// POST /api/state/save - Salva estado da sala
app.post("/api/state/save", async (req, res) => {
  const conn = await pool.getConnection();

  try {
    const { roomId, state } = req.body;

    if (!roomId || !state) {
      return res.status(400).json({ error: "roomId e state são obrigatórios" });
    }

    await conn.beginTransaction();

    // Limpa dados antigos da sala (exceto histórico)
    await conn.execute(
      "DELETE FROM team_players WHERE team_id IN (SELECT id FROM teams WHERE room_id = ?)",
      [roomId]
    );
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

    // Atualiza scores e permanência
    await conn.execute(
      "UPDATE room_state SET score_a = ?, score_b = ?, max_consecutive_wins = ?, current_win_streak = ? WHERE room_id = ?",
      [state.scoreA, state.scoreB, state.maxConsecutiveWins || 3, state.currentWinStreak || 0, roomId]
    );

    await conn.commit();
    res.json({ success: true });
  } catch (error) {
    await conn.rollback();
    console.error("Erro ao salvar estado:", error);
    res.status(500).json({ error: "Erro ao salvar estado" });
  } finally {
    conn.release();
  }
});

// Rota de health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

// Inicia servidor
app.listen(PORT, () => {
  console.log(`🚀 API Server rodando em http://localhost:${PORT}`);
  console.log(`📊 Database: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
});
