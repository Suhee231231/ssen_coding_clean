const mysql = require('mysql2/promise');

async function debugProgress() {
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
        
        console.log('=== 진행 상황 추적 디버깅 ===');
        
        // 1. 사용자 테이블 확인
        console.log('\n👥 사용자 목록:');
        const [users] = await connection.execute('SELECT id, username, is_admin FROM users');
        users.forEach(user => {
            console.log(`- ID: ${user.id}, 사용자명: ${user.username}, 관리자: ${user.is_admin}`);
        });
        
        // 2. 과목 테이블 확인
        console.log('\n📚 과목 목록:');
        const [subjects] = await connection.execute('SELECT id, name FROM subjects ORDER BY id');
        subjects.forEach(subject => {
            console.log(`- ID: ${subject.id}, 이름: ${subject.name}`);
        });
        
        // 3. 문제 테이블 확인
        console.log('\n❓ 문제 목록:');
        const [problems] = await connection.execute(`
            SELECT p.id, p.subject_id, s.name as subject_name, p.question 
            FROM problems p 
            JOIN subjects s ON p.subject_id = s.id 
            ORDER BY p.subject_id, p.id
        `);
        problems.forEach(problem => {
            console.log(`- ID: ${problem.id}, 과목: ${problem.subject_name} (${problem.subject_id}), 문제: ${problem.question.substring(0, 50)}...`);
        });
        
        // 4. 진행 상황 테이블 확인
        console.log('\n📈 진행 상황 테이블:');
        const [userProgress] = await connection.execute('SELECT * FROM user_progress');
        console.log(`- user_progress: ${userProgress.length}개 레코드`);
        userProgress.forEach(progress => {
            console.log(`  - 사용자: ${progress.user_id}, 문제: ${progress.problem_id}, 답안: ${progress.selected_answer}, 정답: ${progress.is_correct}`);
        });
        
        const [subjectProgress] = await connection.execute('SELECT * FROM user_subject_progress');
        console.log(`- user_subject_progress: ${subjectProgress.length}개 레코드`);
        subjectProgress.forEach(progress => {
            console.log(`  - 사용자: ${progress.user_id}, 과목: ${progress.subject_id}, 마지막 문제: ${progress.last_problem_id}`);
        });
        
        // 5. 테이블 구조 확인
        console.log('\n🔧 테이블 구조 확인:');
        const [userProgressColumns] = await connection.execute('DESCRIBE user_progress');
        console.log('- user_progress 테이블 구조:');
        userProgressColumns.forEach(col => {
            console.log(`  - ${col.Field}: ${col.Type} ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'}`);
        });
        
        const [subjectProgressColumns] = await connection.execute('DESCRIBE user_subject_progress');
        console.log('- user_subject_progress 테이블 구조:');
        subjectProgressColumns.forEach(col => {
            console.log(`  - ${col.Field}: ${col.Type} ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'}`);
        });
        
    } catch (error) {
        console.error('❌ 오류 발생:', error);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

debugProgress(); 