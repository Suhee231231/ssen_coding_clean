require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');

async function importToRailway() {
    try {
        console.log('Railway 데이터베이스 연결 중...');
        
        // Railway 데이터베이스 연결
        const railwayConnection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: process.env.DB_PORT,
            charset: process.env.DB_CHARSET || 'utf8mb4'
        });

        console.log('Railway 데이터베이스 연결 성공!');

        // 기존 데이터 삭제 (제가 임의로 만든 것들)
        await railwayConnection.execute('DELETE FROM subjects');
        await railwayConnection.execute('DELETE FROM problems');
        console.log('기존 임시 데이터 삭제 완료');

        // 내보낸 데이터 읽기
        const exportedData = JSON.parse(fs.readFileSync('exported-data.json', 'utf8'));
        
        // subjects 데이터 가져오기
        console.log(`\n과목 데이터 ${exportedData.subjects.length}개 가져오는 중...`);
        for (const subject of exportedData.subjects) {
            await railwayConnection.execute(
                'INSERT INTO subjects (id, name, description, is_public, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())',
                [
                    subject.id, 
                    subject.name, 
                    subject.description || null, 
                    subject.is_public || 1, 
                    subject.sort_order || 0
                ]
            );
        }
        console.log('과목 데이터 가져오기 완료!');

        // problems 데이터 가져오기
        console.log(`\n문제 데이터 ${exportedData.problems.length}개 가져오는 중...`);
        for (const problem of exportedData.problems) {
            await railwayConnection.execute(
                'INSERT INTO problems (id, title, content, option_a, option_b, option_c, option_d, correct_answer, explanation, difficulty, category, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())',
                [
                    problem.id,
                    problem.question || problem.title || '', // title 필드가 없으면 question 사용
                    problem.question || problem.content || '', // content 필드가 없으면 question 사용
                    problem.option_a || '',
                    problem.option_b || '',
                    problem.option_c || '',
                    problem.option_d || '',
                    problem.correct_answer || '',
                    problem.explanation || null,
                    problem.difficulty || 'medium',
                    problem.category || null
                ]
            );
        }
        console.log('문제 데이터 가져오기 완료!');

        await railwayConnection.end();
        console.log('\nRailway 데이터 가져오기 완료!');
        
    } catch (error) {
        console.error('Railway 데이터 가져오기 중 오류 발생:', error);
        process.exit(1);
    }
}

importToRailway();
