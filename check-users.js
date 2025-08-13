require('dotenv').config();
const mysql = require('mysql2/promise');

async function checkUsers() {
    try {
        console.log('Railway 데이터베이스 연결 중...');
        
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: process.env.DB_PORT,
            charset: process.env.DB_CHARSET || 'utf8mb4'
        });

        console.log('Railway 데이터베이스 연결 성공!');

        // users 테이블 데이터 확인
        const [users] = await connection.execute('SELECT id, username, email, is_admin, is_verified FROM users');
        console.log('\n=== 사용자 데이터 ===');
        console.log(`총 ${users.length}개의 사용자가 있습니다:`);
        users.forEach(user => {
            console.log(`- ID: ${user.id}, 사용자명: ${user.username}, 이메일: ${user.email}, 관리자: ${user.is_admin}, 인증: ${user.is_verified}`);
        });

        await connection.end();
        console.log('\n사용자 데이터 확인 완료!');
        
    } catch (error) {
        console.error('사용자 데이터 확인 중 오류 발생:', error);
        process.exit(1);
    }
}

checkUsers();
