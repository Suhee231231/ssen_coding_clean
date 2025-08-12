const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function updateDatabase() {
    let connection;
    
    try {
        // 데이터베이스 연결
        connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '6305rpqkfk**',
            database: 'coding_problems',
            charset: 'utf8mb4'
        });

        console.log('데이터베이스에 연결되었습니다.');

        // SQL 파일 읽기
        const sqlFile = path.join(__dirname, 'database', 'remove-username-field.sql');
        const sqlContent = fs.readFileSync(sqlFile, 'utf8');

        // SQL 명령어들을 세미콜론으로 분리
        const sqlCommands = sqlContent.split(';').filter(cmd => cmd.trim());

        // 각 SQL 명령어 실행
        for (const command of sqlCommands) {
            if (command.trim()) {
                console.log('실행 중:', command.trim());
                await connection.execute(command);
                console.log('완료');
            }
        }

        console.log('데이터베이스 업데이트가 완료되었습니다.');

    } catch (error) {
        console.error('데이터베이스 업데이트 오류:', error);
    } finally {
        if (connection) {
            await connection.end();
            console.log('데이터베이스 연결이 종료되었습니다.');
        }
    }
}

updateDatabase();
