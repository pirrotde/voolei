// Script para executar migração no banco de dados
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { readFileSync } from "fs";

dotenv.config();

async function runMigration() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "207.58.175.4",
    port: parseInt(process.env.DB_PORT || "3306"),
    user: process.env.DB_USER || "volei",
    password: process.env.DB_PASSWORD || "volei2025",
    database: process.env.DB_NAME || "volei",
    multipleStatements: true,
  });

  try {
    console.log("🔗 Conectando ao banco de dados...");

    const sql = readFileSync("migration-add-timer.sql", "utf-8");

    console.log("🚀 Executando migração...");
    await connection.query(sql);

    console.log("✅ Migração executada com sucesso!");

    // Verificar se as colunas foram criadas
    const [columns] = await connection.query(
      "DESCRIBE room_state"
    );

    const hasEnforceGenderBalance = columns.some(col => col.Field === 'enforce_gender_balance');
    console.log("\n📋 Coluna enforce_gender_balance:", hasEnforceGenderBalance ? "✅ Criada" : "❌ Não encontrada");

    const [tables] = await connection.query(
      "SHOW TABLES LIKE 'matchup_history'"
    );

    if (tables.length > 0) {
      console.log("📋 Tabela matchup_history: ✅ Criada");
    } else {
      console.log("📋 Tabela matchup_history: ❌ Não encontrada");
    }

  } catch (error) {
    console.error("❌ Erro ao executar migração:", error);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

runMigration();
