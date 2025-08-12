const { pool, testConnection } = require('./config/database');

async function testDatabase() {
    try {
        console.log('데이터베이스 연결 테스트 중...');
        await testConnection();
        
        // 데이터베이스 존재 여부 확인
        const connection = await pool.getConnection();
        
        try {
            // 데이터베이스 목록 조회
            const [databases] = await connection.execute('SHOW DATABASES');
            console.log('사용 가능한 데이터베이스:');
            databases.forEach(db => {
                console.log(`- ${db.Database}`);
            });
            
            // coding_problems 데이터베이스 존재 여부 확인
            const codingProblemsExists = databases.some(db => db.Database === 'coding_problems');
            
            if (!codingProblemsExists) {
                console.log('\n❌ coding_problems 데이터베이스가 존재하지 않습니다.');
                console.log('데이터베이스를 생성하시겠습니까? (y/n)');
                // 여기서는 수동으로 생성하도록 안내
                console.log('\n다음 명령어로 데이터베이스를 생성하세요:');
                console.log('1. MySQL에 접속');
                console.log('2. CREATE DATABASE coding_problems;');
                console.log('3. USE coding_problems;');
                console.log('4. database/schema.sql 파일의 내용을 실행');
            } else {
                console.log('\n✅ coding_problems 데이터베이스가 존재합니다.');
                
                // 테이블 존재 여부 확인
                await connection.execute('USE coding_problems');
                const [tables] = await connection.execute('SHOW TABLES');
                console.log('\n테이블 목록:');
                tables.forEach(table => {
                    console.log(`- ${Object.values(table)[0]}`);
                });
            }
            
        } finally {
            connection.release();
        }
        
    } catch (error) {
        console.error('❌ 데이터베이스 테스트 실패:', error.message);
        console.log('\n해결 방법:');
        console.log('1. MySQL이 설치되어 있는지 확인');
        console.log('2. MySQL 서비스가 실행 중인지 확인');
        console.log('3. config/database.js의 연결 정보가 올바른지 확인');
    }
}

testDatabase(); 