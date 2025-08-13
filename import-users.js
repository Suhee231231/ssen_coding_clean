require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');

async function importUsers() {
    try {
        console.log('로컬 데이터베이스 연결 중...');
        
        // 로컬 데이터베이스 연결
        const localConnection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '6305rpqkfk**',
            database: 'coding_problems',
            charset: 'utf8mb4'
        });

        console.log('로컬 데이터베이스 연결 성공!');

        // 로컬 사용자 데이터 가져오기
        const [localUsers] = await localConnection.execute('SELECT * FROM users');
        console.log(`로컬에서 ${localUsers.length}개의 사용자 발견`);

        await localConnection.end();

        // Railway 데이터베이스 연결
        console.log('\nRailway 데이터베이스 연결 중...');
        const railwayConnection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: process.env.DB_PORT,
            charset: process.env.DB_CHARSET || 'utf8mb4'
        });

        console.log('Railway 데이터베이스 연결 성공!');

        // 기존 admin 계정 삭제
        await railwayConnection.execute('DELETE FROM users WHERE username = "admin"');
        console.log('기존 admin 계정 삭제 완료');

        // 사용자 데이터 가져오기
        console.log(`\n사용자 데이터 ${localUsers.length}개 가져오는 중...`);
        for (const user of localUsers) {
            await railwayConnection.execute(
                'INSERT INTO users (id, username, email, password, is_admin, is_verified, verification_token, google_id, google_picture, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [
                    user.id,
                    user.username,
                    user.email,
                    user.password,
                    user.is_admin || 0,
                    user.is_verified || 0,
                    user.verification_token || null,
                    user.google_id || null,
                    user.google_picture || null,
                    user.created_at || new Date(),
                    user.updated_at || new Date()
                ]
            );
        }
        console.log('사용자 데이터 가져오기 완료!');

        await railwayConnection.end();
        console.log('\n사용자 데이터 마이그레이션 완료!');
        
    } catch (error) {
        console.error('사용자 데이터 마이그레이션 중 오류 발생:', error);
        process.exit(1);
    }
}

importUsers();
