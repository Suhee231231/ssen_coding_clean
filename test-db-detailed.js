const mysql = require('mysql2/promise');

const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    charset: 'utf8mb4'
};

async function testDatabaseConnection() {
    console.log('=== 데이터베이스 연결 상세 테스트 ===');
    console.log('연결 설정:', { ...dbConfig, password: '***' });
    
    try {
        // 1. MySQL 서버 연결 테스트 (데이터베이스 없이)
        console.log('\n1. MySQL 서버 연결 테스트...');
        const connection = await mysql.createConnection(dbConfig);
        console.log('✅ MySQL 서버 연결 성공!');
        
        // 2. 데이터베이스 목록 조회
        console.log('\n2. 데이터베이스 목록 조회...');
        const [databases] = await connection.execute('SHOW DATABASES');
        console.log('사용 가능한 데이터베이스:');
        databases.forEach(db => {
            console.log(`  - ${db.Database}`);
        });
        
        // 3. coding_problems 데이터베이스 존재 여부 확인
        const codingProblemsExists = databases.some(db => db.Database === 'coding_problems');
        
        if (!codingProblemsExists) {
            console.log('\n❌ coding_problems 데이터베이스가 존재하지 않습니다.');
            console.log('\n데이터베이스를 생성하시겠습니까? (y/n)');
            
            // 자동으로 데이터베이스 생성 시도
            try {
                console.log('\n데이터베이스 생성 시도 중...');
                await connection.execute('CREATE DATABASE coding_problems CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
                console.log('✅ coding_problems 데이터베이스 생성 성공!');
            } catch (createError) {
                console.log('❌ 데이터베이스 생성 실패:', createError.message);
                console.log('\n수동으로 생성해주세요:');
                console.log('1. MySQL에 접속');
                console.log('2. CREATE DATABASE coding_problems;');
                console.log('3. USE coding_problems;');
                console.log('4. database/schema.sql 파일의 내용을 실행');
                connection.end();
                return;
            }
        } else {
            console.log('\n✅ coding_problems 데이터베이스가 존재합니다.');
        }
        
        // 4. coding_problems 데이터베이스 사용
        console.log('\n3. coding_problems 데이터베이스 사용...');
        await connection.execute('USE coding_problems');
        
        // 5. 테이블 목록 조회
        console.log('\n4. 테이블 목록 조회...');
        const [tables] = await connection.execute('SHOW TABLES');
        console.log('테이블 목록:');
        tables.forEach(table => {
            console.log(`  - ${Object.values(table)[0]}`);
        });
        
        // 6. users 테이블 구조 확인
        if (tables.some(table => Object.values(table)[0] === 'users')) {
            console.log('\n5. users 테이블 구조 확인...');
            const [columns] = await connection.execute('DESCRIBE users');
            console.log('users 테이블 컬럼:');
            columns.forEach(col => {
                console.log(`  - ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'}`);
            });
        }
        
        connection.end();
        console.log('\n✅ 모든 테스트 완료!');
        
    } catch (error) {
        console.error('\n❌ 데이터베이스 연결 실패:', error.message);
        console.error('오류 코드:', error.code);
        console.error('오류 번호:', error.errno);
        
        console.log('\n=== 해결 방법 ===');
        console.log('1. MySQL이 설치되어 있는지 확인');
        console.log('2. MySQL 서비스가 실행 중인지 확인');
        console.log('3. config/database.js의 연결 정보가 올바른지 확인');
        console.log('4. MySQL root 비밀번호가 설정되어 있다면 config/database.js에서 password를 설정');
        
        if (error.code === 'ECONNREFUSED') {
            console.log('\nMySQL 서비스가 실행되지 않았을 가능성이 높습니다.');
            console.log('Windows에서 MySQL 서비스 시작:');
            console.log('1. 서비스 관리자 열기 (services.msc)');
            console.log('2. MySQL 서비스 찾기');
            console.log('3. 서비스 시작');
        }
    }
}

testDatabaseConnection(); 