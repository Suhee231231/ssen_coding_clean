const { pool } = require('./config/database');

async function createPasswordResetTokensTable() {
    try {
        const connection = await pool.getConnection();
        
        // 비밀번호 재설정 토큰 테이블 생성
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS password_reset_tokens (
                id INT AUTO_INCREMENT PRIMARY KEY,
                email VARCHAR(255) NOT NULL,
                token VARCHAR(255) NOT NULL UNIQUE,
                expires_at DATETIME NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_email (email),
                INDEX idx_token (token),
                INDEX idx_expires_at (expires_at)
            )
        `);
        
        console.log('✅ 비밀번호 재설정 토큰 테이블이 성공적으로 생성되었습니다.');
        
        connection.release();
        process.exit(0);
        
    } catch (error) {
        console.error('❌ 테이블 생성 중 오류 발생:', error);
        process.exit(1);
    }
}

createPasswordResetTokensTable();
