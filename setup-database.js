const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');

const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '6305rpqkfk**', // MySQL Installer에서 설정한 root 비밀번호로 변경하세요
    charset: 'utf8mb4'
};

async function setupDatabase() {
    console.log('=== 데이터베이스 설정 시작 ===');
    
    try {
        // 1. MySQL 서버 연결
        console.log('1. MySQL 서버 연결 중...');
        const connection = await mysql.createConnection(dbConfig);
        console.log('✅ MySQL 서버 연결 성공!');
        
        // 2. 데이터베이스 생성
        console.log('2. coding_problems 데이터베이스 생성 중...');
        await connection.execute('CREATE DATABASE IF NOT EXISTS coding_problems CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
        console.log('✅ 데이터베이스 생성 완료!');
        
        // 3. 데이터베이스 사용
        await connection.execute('USE coding_problems');
        
        // 4. 스키마 파일 읽기 및 실행
        console.log('3. 테이블 생성 중...');
        const schemaPath = path.join(__dirname, 'database', 'schema.sql');
        const schemaContent = await fs.readFile(schemaPath, 'utf8');
        
        // USE 문과 CREATE DATABASE 문 제거 (이미 생성했으므로)
        const cleanSchema = schemaContent
            .replace(/CREATE DATABASE.*?;/gi, '')
            .replace(/USE.*?;/gi, '')
            .trim();
        
        // 각 SQL 문을 개별적으로 실행
        const statements = cleanSchema.split(';').filter(stmt => stmt.trim());
        
        for (const statement of statements) {
            if (statement.trim()) {
                try {
                    await connection.execute(statement);
                } catch (error) {
                    // 테이블이 이미 존재하는 경우 무시
                    if (!error.message.includes('already exists')) {
                        console.log('SQL 실행 중 오류:', error.message);
                    }
                }
            }
        }
        
        console.log('✅ 테이블 생성 완료!');
        
        // 5. 관리자 계정 생성
        console.log('4. 관리자 계정 생성 중...');
        const bcrypt = require('bcrypt');
        const hashedPassword = await bcrypt.hash('admin123', 10);
        
        try {
            await connection.execute(`
                INSERT INTO users (username, email, password, is_admin) 
                VALUES (?, ?, ?, ?)
            `, ['admin', 'admin@codingproblems.com', hashedPassword, true]);
            console.log('✅ 관리자 계정 생성 완료!');
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') {
                console.log('ℹ️  관리자 계정이 이미 존재합니다.');
            } else {
                console.log('관리자 계정 생성 중 오류:', error.message);
            }
        }
        
        // 6. 테이블 확인
        console.log('5. 생성된 테이블 확인...');
        const [tables] = await connection.execute('SHOW TABLES');
        console.log('생성된 테이블:');
        tables.forEach(table => {
            console.log(`  - ${Object.values(table)[0]}`);
        });
        
        connection.end();
        console.log('\n🎉 데이터베이스 설정 완료!');
        console.log('\n관리자 로그인 정보:');
        console.log('  사용자명: admin');
        console.log('  비밀번호: admin123');
        console.log('\n이제 서버를 시작할 수 있습니다: npm start');
        
    } catch (error) {
        console.error('❌ 데이터베이스 설정 실패:', error.message);
        console.log('\n해결 방법:');
        console.log('1. XAMPP가 설치되어 있는지 확인');
        console.log('2. XAMPP Control Panel에서 MySQL 서비스가 시작되어 있는지 확인');
        console.log('3. MySQL 서비스가 포트 3306에서 실행 중인지 확인');
    }
}

setupDatabase(); 