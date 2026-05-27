// Test direct MySQL2 connection
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const config = {
  host: process.env.DB_HOST || '207.58.175.4',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'volei',
  password: process.env.DB_PASSWORD || 'volei2025',
  database: process.env.DB_NAME || 'volei',
  connectTimeout: 10000,
};

console.log('Testando conexão MySQL2...');
console.log('Config:', { ...config, password: '***' });

async function testConnection() {
  let connection;
  try {
    console.log('\n1. Criando conexão...');
    connection = await mysql.createConnection(config);
    console.log('✅ Conexão criada!');

    console.log('\n2. Testando query...');
    const [rows] = await connection.execute('SELECT "Teste OK" as status');
    console.log('✅ Query executada:', rows[0]);

    console.log('\n3. Contando tabelas...');
    const [tables] = await connection.execute('SHOW TABLES');
    console.log(`✅ ${tables.length} tabelas encontradas:`, tables.map(t => Object.values(t)[0]));

    console.log('\n4. Contando dados...');
    const [counts] = await connection.execute(`
      SELECT 'rooms' as tabela, COUNT(*) as total FROM rooms
      UNION ALL SELECT 'players', COUNT(*) FROM players
      UNION ALL SELECT 'teams', COUNT(*) FROM teams
    `);
    console.log('✅ Dados:', counts);

    console.log('\n✅ SUCESSO! Conexão MySQL2 funcionando perfeitamente.');

  } catch (error) {
    console.error('\n❌ ERRO:', error.message);
    console.error('Code:', error.code);
    console.error('Errno:', error.errno);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\nConexão fechada.');
    }
  }
}

testConnection();
