// Script para criar a sala padrão
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

async function createDefaultRoom() {
  console.log("🔧 Criando sala padrão...");

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "207.58.175.4",
    port: parseInt(process.env.DB_PORT || "3306"),
    user: process.env.DB_USER || "volei",
    password: process.env.DB_PASSWORD || "volei2025",
    database: process.env.DB_NAME || "volei",
  });

  try {
    // Insere sala padrão
    await connection.execute(
      "INSERT IGNORE INTO rooms (id, code, name) VALUES ('default-room', 'DEFAULT', 'Sala Principal')"
    );

    // Insere estado inicial
    await connection.execute(
      "INSERT IGNORE INTO room_state (room_id, score_a, score_b, max_consecutive_wins, current_win_streak) VALUES ('default-room', 0, 0, 3, 0)"
    );

    console.log("✅ Sala padrão criada com sucesso!");
    console.log("   ID: default-room");
    console.log("   Code: DEFAULT");
    console.log("   Name: Sala Principal");
  } catch (error) {
    console.error("❌ Erro:", error);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

createDefaultRoom();
