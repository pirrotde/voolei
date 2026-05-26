// Script para adicionar campos de permanência
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

async function migrate() {
  console.log("🔧 Adicionando campos de permanência...");

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "207.58.175.4",
    port: parseInt(process.env.DB_PORT || "3306"),
    user: process.env.DB_USER || "volei",
    password: process.env.DB_PASSWORD || "volei2025",
    database: process.env.DB_NAME || "volei",
  });

  try {
    // Adiciona coluna max_consecutive_wins
    await connection.execute(`
      ALTER TABLE room_state
      ADD COLUMN IF NOT EXISTS max_consecutive_wins INT DEFAULT 3
    `);
    console.log("✅ Coluna max_consecutive_wins adicionada");

    // Adiciona coluna current_win_streak
    await connection.execute(`
      ALTER TABLE room_state
      ADD COLUMN IF NOT EXISTS current_win_streak INT DEFAULT 0
    `);
    console.log("✅ Coluna current_win_streak adicionada");

    console.log("✅ Migração concluída com sucesso!");
  } catch (error) {
    console.error("❌ Erro:", error);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

migrate();
