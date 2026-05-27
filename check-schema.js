// Script para verificar schema do banco de dados
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

async function checkSchema() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "207.58.175.4",
    port: parseInt(process.env.DB_PORT || "3306"),
    user: process.env.DB_USER || "volei",
    password: process.env.DB_PASSWORD || "volei2025",
    database: process.env.DB_NAME || "volei",
  });

  try {
    console.log("🔗 Conectando ao banco de dados...\n");

    // Verificar estrutura da tabela room_state
    const [columns] = await connection.query("DESCRIBE room_state");

    console.log("📋 Estrutura da tabela room_state:");
    columns.forEach(col => {
      console.log(`  - ${col.Field} (${col.Type}) ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Default !== null ? `DEFAULT ${col.Default}` : ''}`);
    });

    console.log("\n📋 Verificando coluna enforce_gender_balance...");
    const hasEnforceGenderBalance = columns.some(col => col.Field === 'enforce_gender_balance');
    console.log(hasEnforceGenderBalance ? "  ✅ Coluna ENCONTRADA" : "  ❌ Coluna NÃO encontrada");

    console.log("\n📋 Verificando coluna game_timer...");
    const hasGameTimer = columns.some(col => col.Field === 'game_timer');
    console.log(hasGameTimer ? "  ✅ Coluna ENCONTRADA" : "  ❌ Coluna NÃO encontrada");

    // Verificar se a tabela matchup_history existe
    console.log("\n📋 Verificando tabela matchup_history...");
    const [tables] = await connection.query("SHOW TABLES LIKE 'matchup_history'");
    console.log(tables.length > 0 ? "  ✅ Tabela ENCONTRADA" : "  ❌ Tabela NÃO encontrada");

  } catch (error) {
    console.error("❌ Erro:", error);
  } finally {
    await connection.end();
  }
}

checkSchema();
