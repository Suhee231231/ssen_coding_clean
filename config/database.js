const mysql = require('mysql2/promise');

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '6305rpqkfk**',
    database: process.env.DB_NAME || 'coding_problems',
    port: process.env.DB_PORT || 3306,
    charset: process.env.DB_CHARSET || 'utf8mb4'
};

// 연결 풀 생성
const pool = mysql.createPool({
    ...dbConfig,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// 연결 테스트
async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('데이터베이스 연결 성공!');
        connection.release();
    } catch (error) {
        console.error('데이터베이스 연결 실패:', error.message);
        process.exit(1);
    }
}

module.exports = {
    pool,
    testConnection
}; 