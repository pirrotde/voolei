import mysql from "mysql2/promise";

const pool = mysql.createPool({
  host: process.env.DB_HOST || "207.58.175.4",
  port: parseInt(process.env.DB_PORT || "3306"),
  user: process.env.DB_USER || "volei",
  password: process.env.DB_PASSWORD || "volei2025",
  database: process.env.DB_NAME || "volei",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

export default pool;

export async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log("✅ MariaDB connected successfully");
    connection.release();
    return true;
  } catch (error) {
    console.error("❌ MariaDB connection failed:", error);
    return false;
  }
}
