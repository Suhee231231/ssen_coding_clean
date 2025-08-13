require('dotenv').config();
const mysql = require('mysql2/promise');

async function checkProblemData() {
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

        console.log('문제 데이터 상태 확인 중...');
        
        // HTML 과목의 첫 번째 문제 확인
        const [htmlProblems] = await connection.execute(`
            SELECT id, title, content, option_a, option_b, option_c, option_d, explanation
            FROM problems 
            WHERE subject_id = (SELECT id FROM subjects WHERE name = 'HTML')
            ORDER BY id
            LIMIT 5
        `);
        
        console.log('HTML 과목 문제 데이터:');
        htmlProblems.forEach((problem, index) => {
            console.log(`\n문제 ${index + 1} (ID: ${problem.id}):`);
            console.log(`  제목: ${problem.title}`);
            console.log(`  내용: ${problem.content ? problem.content.substring(0, 100) + '...' : 'NULL'}`);
            console.log(`  선택지 A: ${problem.option_a}`);
            console.log(`  선택지 B: ${problem.option_b}`);
            console.log(`  선택지 C: ${problem.option_c}`);
            console.log(`  선택지 D: ${problem.option_d}`);
            console.log(`  설명: ${problem.explanation ? problem.explanation.substring(0, 100) + '...' : 'NULL'}`);
        });

        // 전체 문제 수와 undefined/null 값 확인
        const [stats] = await connection.execute(`
            SELECT 
                COUNT(*) as total_problems,
                SUM(CASE WHEN content IS NULL OR content = '' THEN 1 ELSE 0 END) as empty_content,
                SUM(CASE WHEN title IS NULL OR title = '' THEN 1 ELSE 0 END) as empty_title
            FROM problems
        `);
        
        console.log('\n전체 문제 통계:');
        console.log(`  전체 문제 수: ${stats[0].total_problems}`);
        console.log(`  내용이 비어있는 문제: ${stats[0].empty_content}`);
        console.log(`  제목이 비어있는 문제: ${stats[0].empty_title}`);

        await connection.end();
        console.log('데이터베이스 연결 종료');
        
    } catch (error) {
        console.error('문제 데이터 확인 중 오류 발생:', error);
        process.exit(1);
    }
}

checkProblemData();
