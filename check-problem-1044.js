require('dotenv').config();
const mysql = require('mysql2/promise');

async function checkProblem1044() {
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

        // 문제 ID 1044 확인
        console.log('\n=== 문제 ID 1044 확인 ===');
        const [problem1044] = await connection.execute(`
            SELECT p.*, s.name as subject_name, s.id as subject_id
            FROM problems p
            JOIN subjects s ON p.subject_id = s.id
            WHERE p.id = 1044
        `);

        if (problem1044.length === 0) {
            console.log('❌ 문제 ID 1044를 찾을 수 없습니다.');
        } else {
            const problem = problem1044[0];
            console.log(`✅ 문제 ID 1044 발견:`);
            console.log(`  - 과목: ${problem.subject_name} (ID: ${problem.subject_id})`);
            console.log(`  - 문제: ${problem.question.substring(0, 100)}...`);
            console.log(`  - 선택지 A: ${problem.option_a}`);
            console.log(`  - 선택지 B: ${problem.option_b}`);
            console.log(`  - 선택지 C: ${problem.option_c}`);
            console.log(`  - 선택지 D: ${problem.option_d}`);
            console.log(`  - 정답: ${problem.correct_answer}`);
        }

        // CSS 과목의 문제들 확인
        console.log('\n=== CSS 과목 문제 확인 ===');
        const [cssProblems] = await connection.execute(`
            SELECT p.id, p.question, s.name as subject_name
            FROM problems p
            JOIN subjects s ON p.subject_id = s.id
            WHERE s.name = 'CSS'
            ORDER BY p.id
            LIMIT 10
        `);

        console.log(`CSS 과목 문제 ${cssProblems.length}개:`);
        cssProblems.forEach(problem => {
            console.log(`  - ID: ${problem.id}, 문제: ${problem.question.substring(0, 50)}...`);
        });

        // 사용자 1의 CSS 과목 틀린 문제 확인
        console.log('\n=== 사용자 1의 CSS 과목 틀린 문제 확인 ===');
        const [userWrongProblems] = await connection.execute(`
            SELECT p.id, p.question, s.name as subject_name, up.selected_answer, up.is_correct
            FROM user_progress up
            JOIN problems p ON up.problem_id = p.id
            JOIN subjects s ON p.subject_id = s.id
            WHERE up.user_id = 1 AND up.is_correct = 0 AND s.name = 'CSS'
            ORDER BY up.answered_at DESC
        `);

        console.log(`사용자 1의 CSS 과목 틀린 문제 ${userWrongProblems.length}개:`);
        userWrongProblems.forEach(problem => {
            console.log(`  - ID: ${problem.id}, 문제: ${problem.question.substring(0, 50)}...`);
        });

        // 모든 과목의 문제 ID 범위 확인
        console.log('\n=== 모든 과목의 문제 ID 범위 확인 ===');
        const [subjectRanges] = await connection.execute(`
            SELECT s.name, COUNT(p.id) as problem_count, MIN(p.id) as min_id, MAX(p.id) as max_id
            FROM subjects s
            LEFT JOIN problems p ON s.id = p.subject_id
            GROUP BY s.id, s.name
            ORDER BY s.id
        `);

        subjectRanges.forEach(subject => {
            console.log(`  - ${subject.name}: ${subject.problem_count}개 문제 (ID: ${subject.min_id || 0}~${subject.max_id || 0})`);
        });

        connection.end();
        console.log('\n✅ 확인 완료!');

    } catch (error) {
        console.error('❌ 오류:', error);
    }
}

checkProblem1044();
