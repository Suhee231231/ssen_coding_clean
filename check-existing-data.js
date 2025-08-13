require('dotenv').config();
const mysql = require('mysql2/promise');

async function checkExistingData() {
    try {
        console.log('데이터베이스 연결 중...');
        
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: process.env.DB_PORT,
            charset: process.env.DB_CHARSET || 'utf8mb4'
        });

        console.log('데이터베이스 연결 성공!');

        // 기존 테이블 확인
        const [tables] = await connection.execute('SHOW TABLES');
        console.log('\n=== 기존 테이블 목록 ===');
        tables.forEach(table => {
            console.log(Object.values(table)[0]);
        });

        // subjects 테이블 데이터 확인
        try {
            const [subjects] = await connection.execute('SELECT * FROM subjects');
            console.log('\n=== 기존 과목 데이터 ===');
            console.log(`총 ${subjects.length}개의 과목이 있습니다:`);
            subjects.forEach(subject => {
                console.log(`- ID: ${subject.id}, 이름: ${subject.name}, 공개: ${subject.is_public}`);
            });
        } catch (error) {
            console.log('\nsubjects 테이블이 없습니다.');
        }

        // problems 테이블 데이터 확인
        try {
            const [problems] = await connection.execute('SELECT * FROM problems LIMIT 5');
            console.log('\n=== 기존 문제 데이터 (상위 5개) ===');
            console.log(`총 문제 수를 확인 중...`);
            
            const [totalProblems] = await connection.execute('SELECT COUNT(*) as count FROM problems');
            console.log(`총 ${totalProblems[0].count}개의 문제가 있습니다.`);
            
            problems.forEach(problem => {
                console.log(`- ID: ${problem.id}, 제목: ${problem.title}, 정답: ${problem.correct_answer}`);
            });
        } catch (error) {
            console.log('\nproblems 테이블이 없습니다.');
        }

        await connection.end();
        console.log('\n데이터 확인 완료!');
        
    } catch (error) {
        console.error('데이터 확인 중 오류 발생:', error);
        process.exit(1);
    }
}

checkExistingData();
