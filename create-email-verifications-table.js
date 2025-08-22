require('dotenv').config();
const mysql = require('mysql2/promise');

const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    charset: 'utf8mb4'
};

async function createEmailVerificationsTable() {
    const connection = await mysql.createConnection(dbConfig);
    
    try {
        console.log('🚀 Railway 데이터베이스 연결 성공!');
        
        // 이메일 인증 테이블 생성
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS email_verifications (
                id INT AUTO_INCREMENT PRIMARY KEY,
                email VARCHAR(255) NOT NULL,
                token VARCHAR(255) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL 24 HOUR),
                is_verified BOOLEAN DEFAULT FALSE
            )
        `);
        console.log('✅ email_verifications 테이블 생성 완료');
        
        // 테이블 구조 확인
        const [rows] = await connection.execute('DESCRIBE email_verifications');
        console.log('📋 테이블 구조:', rows);
        
        console.log('🎉 Railway 데이터베이스 업데이트 완료!');
        
    } catch (error) {
        console.error('❌ 데이터베이스 업데이트 오류:', error);
        throw error;
    } finally {
        await connection.end();
    }
}

createEmailVerificationsTable();
