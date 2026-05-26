// Script para criar as tabelas no MariaDB
import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function setupDatabase() {
  console.log("🔧 Conectando ao MariaDB...");

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "207.58.175.4",
    port: parseInt(process.env.DB_PORT || "3306"),
    user: process.env.DB_USER || "volei",
    password: process.env.DB_PASSWORD || "volei2025",
    database: process.env.DB_NAME || "volei",
    multipleStatements: true,
  });

  try {
    console.log("✅ Conexão estabelecida!");

    console.log("📋 Lendo schema.sql...");
    const schemaPath = path.join(__dirname, "schema.sql");
    const schema = fs.readFileSync(schemaPath, "utf8");

    console.log("🚀 Executando migrations...");
    await connection.query(schema);

    console.log("✅ Tabelas criadas com sucesso!");
    console.log("\n📊 Estrutura do banco:");
    const [tables] = await connection.query("SHOW TABLES");
    tables.forEach((table) => {
      console.log(`  - ${Object.values(table)[0]}`);
    });
  } catch (error) {
    console.error("❌ Erro ao configurar banco de dados:", error);
    process.exit(1);
  } finally {
    await connection.end();
    console.log("\n🏁 Setup concluído!");
  }
}

setupDatabase();
