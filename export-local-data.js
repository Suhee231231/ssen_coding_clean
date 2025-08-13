require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');

async function exportLocalData() {
    try {
        console.log('로컬 데이터베이스 연결 중...');
        
        // 로컬 데이터베이스 연결 (기존 설정 사용)
        const localConnection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '6305rpqkfk**',
            database: 'coding_problems',
            charset: 'utf8mb4'
        });

        console.log('로컬 데이터베이스 연결 성공!');

        // subjects 데이터 내보내기
        const [subjects] = await localConnection.execute('SELECT * FROM subjects');
        console.log(`\n과목 데이터 ${subjects.length}개 발견`);

        // problems 데이터 내보내기
        const [problems] = await localConnection.execute('SELECT * FROM problems');
        console.log(`문제 데이터 ${problems.length}개 발견`);

        // 데이터를 JSON 파일로 저장
        const exportData = {
            subjects: subjects,
            problems: problems,
            exportDate: new Date().toISOString()
        };

        fs.writeFileSync('exported-data.json', JSON.stringify(exportData, null, 2));
        console.log('\n데이터가 exported-data.json 파일로 저장되었습니다.');

        await localConnection.end();
        console.log('로컬 데이터 내보내기 완료!');
        
    } catch (error) {
        console.error('로컬 데이터 내보내기 중 오류 발생:', error);
        process.exit(1);
    }
}

exportLocalData();
