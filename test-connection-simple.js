// Teste simples de conexão MySQL2
import mysql from 'mysql2/promise';

console.log('=== TESTE DE CONEXÃO MYSQL2 ===\n');

const config = {
  host: '207.58.175.4',
  port: 3306,
  user: 'volei',
  password: 'volei2025',
  database: 'volei',
  connectTimeout: 10000,
  ssl: false, // DESABILITAR SSL
  insecureAuth: true, // Permitir senhas inseguras
};

console.log('Config:', { ...config, password: '***' });
console.log('\nIniciando teste...\n');

async function test() {
  let conn;
  try {
    console.log('1. Criando conexão...');
    conn = await mysql.createConnection(config);
    console.log('✅ Conexão criada!\n');

    console.log('2. Executando SELECT 1...');
    const [rows] = await conn.execute('SELECT 1 as test');
    console.log('✅ Query funcionou:', rows);
    console.log('\n✅✅✅ SUCESSO! MySQL2 está funcionando! ✅✅✅\n');

  } catch (error) {
    console.error('\n❌ ERRO:', error.message);
    console.error('Code:', error.code);
    console.error('Errno:', error.errno);
    console.error('\nStack:', error.stack);
    process.exit(1);
  } finally {
    if (conn) {
      await conn.end();
      console.log('Conexão fechada.');
    }
  }
}

test();
