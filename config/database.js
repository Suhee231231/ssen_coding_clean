const mysql = require('mysql2/promise');

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '6305rpqkfk**',
    database: process.env.DB_NAME || 'coding_problems',
    port: process.env.DB_PORT || 3306,
    charset: process.env.DB_CHARSET || 'utf8mb4'
};

// 연결 풀 생성 (최적화된 설정)
const pool = mysql.createPool({
    ...dbConfig,
    waitForConnections: true,
    connectionLimit: 20, // Railway 환경에 맞게 증가
    queueLimit: 0,
    acquireTimeout: 60000, // 연결 획득 타임아웃 60초
    timeout: 60000, // 쿼리 타임아웃 60초
    reconnect: true, // 자동 재연결
    charset: 'utf8mb4'
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