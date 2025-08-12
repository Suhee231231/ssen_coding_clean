const mysql = require('mysql2/promise');

const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '6305rpqkfk**',
    database: 'coding_problems',
    charset: 'utf8mb4'
};

async function updateDatabase() {
    const connection = await mysql.createConnection(dbConfig);
    
    try {
        console.log('데이터베이스 연결 성공!');
        
        // 이메일 인증 테이블 생성
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS email_verifications (
                id INT AUTO_INCREMENT PRIMARY KEY,
                email VARCHAR(255) NOT NULL,
                token VARCHAR(255) NOT NULL UNIQUE,
                username VARCHAR(255) NOT NULL,
                password VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL 24 HOUR),
                is_verified BOOLEAN DEFAULT FALSE
            )
        `);
        console.log('✅ email_verifications 테이블 생성 완료');
        
        // users 테이블에 email_verified 컬럼 추가
        try {
            await connection.execute(`
                ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT FALSE
            `);
            console.log('✅ users 테이블에 email_verified 컬럼 추가 완료');
        } catch (error) {
            if (error.code === 'ER_DUP_FIELDNAME') {
                console.log('ℹ️ email_verified 컬럼이 이미 존재합니다.');
            } else {
                throw error;
            }
        }
        
        // 기존 사용자들의 email_verified를 TRUE로 설정 (Google OAuth 사용자들)
        await connection.execute(`
            UPDATE users SET email_verified = TRUE WHERE google_id IS NOT NULL
        `);
        console.log('✅ 기존 Google OAuth 사용자들의 이메일 인증 상태 업데이트 완료');
        
        console.log('🎉 데이터베이스 업데이트 완료!');
        
    } catch (error) {
        console.error('데이터베이스 업데이트 오류:', error);
    } finally {
        await connection.end();
    }
}

updateDatabase(); 