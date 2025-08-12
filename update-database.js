const mysql = require('mysql2/promise');
const config = require('./config/database');

async function updateDatabase() {
    const connection = await mysql.createConnection(config);
    
    try {
        console.log('데이터베이스 업데이트 시작...');
        
        // Google OAuth 필드 추가
        await connection.execute(`
            ALTER TABLE users 
            ADD COLUMN google_id VARCHAR(100) UNIQUE,
            ADD COLUMN google_picture VARCHAR(500)
        `);
        console.log('Google OAuth 필드 추가 완료');
        
        // password 필드를 NULL 허용으로 변경
        await connection.execute(`
            ALTER TABLE users MODIFY COLUMN password VARCHAR(255) NULL
        `);
        console.log('password 필드 NULL 허용 변경 완료');
        
        console.log('데이터베이스 업데이트 완료!');
    } catch (error) {
        if (error.code === 'ER_DUP_FIELDNAME') {
            console.log('필드가 이미 존재합니다. 건너뜁니다.');
        } else {
            console.error('데이터베이스 업데이트 오류:', error);
        }
    } finally {
        await connection.end();
    }
}

updateDatabase(); 