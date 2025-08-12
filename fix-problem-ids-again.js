const mysql = require('mysql2');

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '6305rpqkfk**',
    database: 'coding_problems'
});

async function fixProblemIds() {
    try {
        console.log('=== 문제 ID 재정렬 시작 ===');
        
        await connection.promise().beginTransaction();
        
        // 모든 과목의 문제들을 ID 순으로 가져오기
        const [subjects] = await connection.promise().execute('SELECT * FROM subjects ORDER BY sort_order ASC, id ASC');
        
        for (const subject of subjects) {
            console.log(`\n📚 과목: ${subject.name} 처리 중...`);
            
            const [problems] = await connection.promise().execute(
                'SELECT * FROM problems WHERE subject_id = ? ORDER BY id ASC',
                [subject.id]
            );
            
            if (problems.length === 0) {
                console.log(`  - 문제 없음`);
                continue;
            }
            
            // 임시 테이블 생성
            await connection.promise().execute(`
                CREATE TEMPORARY TABLE temp_problems (
                    old_id INT, new_id INT, subject_id INT, question TEXT, option_a VARCHAR(500),
                    option_b VARCHAR(500), option_c VARCHAR(500), option_d VARCHAR(500),
                    correct_answer CHAR(1), explanation TEXT, difficulty ENUM('easy', 'medium', 'hard'), created_at TIMESTAMP
                )
            `);
            
            // 문제들을 새 ID로 매핑
            for (let i = 0; i < problems.length; i++) {
                const problem = problems[i];
                const newId = i + 1;
                
                await connection.promise().execute(`
                    INSERT INTO temp_problems VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    problem.id, newId, problem.subject_id, problem.question, problem.option_a,
                    problem.option_b, problem.option_c, problem.option_d, problem.correct_answer,
                    problem.explanation, problem.difficulty, problem.created_at
                ]);
                
                console.log(`  - 문제 ${problem.id} → ${newId}: "${problem.question.substring(0, 30)}..."`);
            }
            
            // 기존 문제 삭제
            await connection.promise().execute('DELETE FROM problems WHERE subject_id = ?', [subject.id]);
            
            // 새 ID로 문제 재삽입
            await connection.promise().execute(`
                INSERT INTO problems (id, subject_id, question, option_a, option_b, option_c, option_d, correct_answer, explanation, difficulty, created_at)
                SELECT new_id, subject_id, question, option_a, option_b, option_c, option_d, correct_answer, explanation, difficulty, created_at
                FROM temp_problems ORDER BY new_id
            `);
            
            // 임시 테이블 삭제
            await connection.promise().execute('DROP TEMPORARY TABLE temp_problems');
            
            console.log(`  ✅ ${problems.length}개 문제 ID 재정렬 완료`);
        }
        
        // 과목별 총 문제 수 업데이트
        await connection.promise().execute(`
            UPDATE subjects SET total_problems = (SELECT COUNT(*) FROM problems WHERE subject_id = subjects.id)
        `);
        
        await connection.promise().commit();
        
        console.log('\n🎉 모든 문제 ID 재정렬 완료!');
        
        // 최종 확인
        const [finalCheck] = await connection.promise().execute(`
            SELECT s.name, COUNT(p.id) as problem_count, MIN(p.id) as min_id, MAX(p.id) as max_id
            FROM subjects s LEFT JOIN problems p ON s.id = p.subject_id
            GROUP BY s.id, s.name ORDER BY s.sort_order ASC, s.id ASC
        `);
        
        console.log('\n📊 최종 확인:');
        finalCheck.forEach(row => {
            console.log(`- ${row.name}: ${row.problem_count}개 문제 (ID: ${row.min_id || 0}~${row.max_id || 0})`);
        });
        
    } catch (error) {
        console.error('❌ 문제 ID 재정렬 오류:', error.message);
        await connection.promise().rollback();
    } finally {
        connection.end();
    }
}

fixProblemIds(); 