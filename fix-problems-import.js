require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');

async function fixProblemsImport() {
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

        // 기존 문제 데이터 삭제
        await railwayConnection.execute('DELETE FROM problems');
        console.log('기존 문제 데이터 삭제 완료');

        // 내보낸 데이터 읽기
        const exportedData = JSON.parse(fs.readFileSync('exported-data.json', 'utf8'));
        
        // problems 테이블에 subject_id 컬럼 추가 (없다면)
        try {
            await railwayConnection.execute('ALTER TABLE problems ADD COLUMN subject_id INT');
            console.log('subject_id 컬럼 추가 완료');
        } catch (error) {
            console.log('subject_id 컬럼이 이미 존재합니다.');
        }

        // problems 데이터 가져오기 (subject_id 포함)
        console.log(`\n문제 데이터 ${exportedData.problems.length}개 가져오는 중...`);
        for (const problem of exportedData.problems) {
            await railwayConnection.execute(
                'INSERT INTO problems (id, subject_id, title, content, option_a, option_b, option_c, option_d, correct_answer, explanation, difficulty, category, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())',
                [
                    problem.id,
                    problem.subject_id || null,
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

        // 과목별 문제 수 업데이트
        console.log('\n과목별 문제 수 업데이트 중...');
        const [subjects] = await railwayConnection.execute('SELECT * FROM subjects');
        for (const subject of subjects) {
            const [countResult] = await railwayConnection.execute(
                'SELECT COUNT(*) as count FROM problems WHERE subject_id = ?',
                [subject.id]
            );
            console.log(`${subject.name}: ${countResult[0].count}개 문제`);
        }

        await railwayConnection.end();
        console.log('\n문제 데이터 수정 완료!');
        
    } catch (error) {
        console.error('문제 데이터 수정 중 오류 발생:', error);
        process.exit(1);
    }
}

fixProblemsImport();
