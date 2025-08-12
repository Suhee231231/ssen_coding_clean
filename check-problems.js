const mysql = require('mysql2');

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '6305rpqkfk**',
    database: 'coding_problems'
});

async function checkProblems() {
    try {
        console.log('=== 문제 목록 확인 ===');
        
        // JavaScript 과목의 문제들 확인
        const [jsProblems] = await connection.promise().execute(`
            SELECT p.*, s.name as subject_name 
            FROM problems p 
            JOIN subjects s ON p.subject_id = s.id
            WHERE s.name = 'JavaScript'
            ORDER BY p.id ASC
        `);
        
        console.log('\n📚 JavaScript 과목 문제:');
        if (jsProblems.length === 0) {
            console.log('JavaScript 과목에 문제가 없습니다.');
        } else {
            jsProblems.forEach(problem => {
                console.log(`- ID: ${problem.id}, 문제: "${problem.question.substring(0, 50)}..."`);
            });
        }
        
        // 모든 과목의 문제 수 확인
        const [allProblems] = await connection.promise().execute(`
            SELECT s.name, COUNT(p.id) as problem_count, 
                   MIN(p.id) as min_id, MAX(p.id) as max_id
            FROM subjects s 
            LEFT JOIN problems p ON s.id = p.subject_id
            GROUP BY s.id, s.name 
            ORDER BY s.sort_order ASC, s.id ASC
        `);
        
        console.log('\n📊 전체 과목별 문제 현황:');
        allProblems.forEach(row => {
            console.log(`- ${row.name}: ${row.problem_count}개 문제 (ID: ${row.min_id || 0}~${row.max_id || 0})`);
        });
        
    } catch (error) {
        console.error('❌ 문제 확인 오류:', error.message);
    } finally {
        connection.end();
    }
}

checkProblems(); 