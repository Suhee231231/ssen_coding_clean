const mysql = require('mysql2');
const bcrypt = require('bcrypt');

const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '6305rpqkfk**',
    charset: 'utf8mb4'
};

async function setupDatabase() {
    console.log('=== 데이터베이스 설정 시작 ===');
    
    try {
        // 1. MySQL 서버 연결 (mysql2의 기본 연결 사용)
        console.log('1. MySQL 서버 연결 중...');
        const connection = mysql.createConnection(dbConfig);
        
        // Promise로 래핑
        const connectPromise = new Promise((resolve, reject) => {
            connection.connect((err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        
        await connectPromise;
        console.log('✅ MySQL 서버 연결 성공!');
        
        // 2. 데이터베이스 생성
        console.log('2. coding_problems 데이터베이스 생성 중...');
        await new Promise((resolve, reject) => {
            connection.query('CREATE DATABASE IF NOT EXISTS coding_problems CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci', (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        console.log('✅ 데이터베이스 생성 완료!');
        
        // 3. 데이터베이스 사용
        await new Promise((resolve, reject) => {
            connection.query('USE coding_problems', (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        
        // 4. 테이블 생성
        console.log('3. 테이블 생성 중...');
        
        const createTables = [
            `CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                is_admin BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS subjects (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                description TEXT,
                total_problems INT DEFAULT 0
            )`,
            `CREATE TABLE IF NOT EXISTS problems (
                id INT AUTO_INCREMENT PRIMARY KEY,
                subject_id INT,
                question TEXT NOT NULL,
                option_a VARCHAR(500) NOT NULL,
                option_b VARCHAR(500) NOT NULL,
                option_c VARCHAR(500) NOT NULL,
                option_d VARCHAR(500) NOT NULL,
                correct_answer CHAR(1) NOT NULL,
                explanation TEXT,
                difficulty ENUM('easy', 'medium', 'hard') DEFAULT 'medium',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
            )`,
            `CREATE TABLE IF NOT EXISTS user_progress (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT,
                problem_id INT,
                selected_answer CHAR(1),
                is_correct BOOLEAN,
                answered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (problem_id) REFERENCES problems(id) ON DELETE CASCADE,
                UNIQUE KEY unique_user_problem (user_id, problem_id)
            )`,
            `CREATE TABLE IF NOT EXISTS user_subject_progress (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT,
                subject_id INT,
                last_problem_id INT,
                last_visited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
                FOREIGN KEY (last_problem_id) REFERENCES problems(id) ON DELETE SET NULL,
                UNIQUE KEY unique_user_subject (user_id, subject_id)
            )`
        ];
        
        for (const sql of createTables) {
            await new Promise((resolve, reject) => {
                connection.query(sql, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        }
        
        console.log('✅ 테이블 생성 완료!');
        
        // 5. 샘플 데이터 삽입
        console.log('4. 샘플 데이터 삽입 중...');
        
        // 과목 데이터
        const subjects = [
            ['JavaScript', '웹 개발의 핵심 언어', 25],
            ['Python', '다재다능한 프로그래밍 언어', 30],
            ['Java', '객체지향 프로그래밍', 20],
            ['HTML/CSS', '웹 페이지 구조와 스타일', 15],
            ['SQL', '데이터베이스 쿼리 언어', 20],
            ['알고리즘', '문제 해결 능력 향상', 35]
        ];
        
        for (const [name, description, total] of subjects) {
            await new Promise((resolve, reject) => {
                connection.query('INSERT IGNORE INTO subjects (name, description, total_problems) VALUES (?, ?, ?)', 
                    [name, description, total], (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
            });
        }
        
        // JavaScript 문제 샘플
        const jsProblems = [
            ['JavaScript에서 변수를 선언할 때 사용하는 키워드가 아닌 것은?', 'var', 'let', 'const', 'variable', 'D', 'JavaScript에서 변수 선언 키워드는 var, let, const입니다. variable은 키워드가 아닙니다.', 'easy'],
            ['다음 중 JavaScript의 데이터 타입이 아닌 것은?', 'string', 'number', 'boolean', 'character', 'D', 'JavaScript에는 character 타입이 없습니다. 문자열은 string 타입으로 처리됩니다.', 'easy'],
            ['JavaScript에서 배열의 길이를 확인하는 속성은?', 'length()', 'size()', 'length', 'count()', 'C', 'JavaScript 배열의 길이는 length 속성으로 확인합니다. 메서드가 아닌 속성입니다.', 'easy']
        ];
        
        for (const [question, a, b, c, d, correct, explanation, difficulty] of jsProblems) {
            await new Promise((resolve, reject) => {
                connection.query('INSERT IGNORE INTO problems (subject_id, question, option_a, option_b, option_c, option_d, correct_answer, explanation, difficulty) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)', 
                    [question, a, b, c, d, correct, explanation, difficulty], (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
            });
        }
        
        console.log('✅ 샘플 데이터 삽입 완료!');
        
        // 6. 관리자 계정 생성
        console.log('5. 관리자 계정 생성 중...');
        const hashedPassword = await bcrypt.hash('admin123', 10);
        
        try {
            await new Promise((resolve, reject) => {
                connection.query('INSERT INTO users (username, email, password, is_admin) VALUES (?, ?, ?, ?)', 
                    ['admin', 'admin@codingproblems.com', hashedPassword, true], (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
            });
            console.log('✅ 관리자 계정 생성 완료!');
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') {
                console.log('ℹ️  관리자 계정이 이미 존재합니다.');
            } else {
                console.log('관리자 계정 생성 중 오류:', error.message);
            }
        }
        
        // 7. 테이블 확인
        console.log('6. 생성된 테이블 확인...');
        const tables = await new Promise((resolve, reject) => {
            connection.query('SHOW TABLES', (err, results) => {
                if (err) reject(err);
                else resolve(results);
            });
        });
        
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
        console.log('1. MySQL 서비스가 실행 중인지 확인');
        console.log('2. 비밀번호가 올바른지 확인');
    }
}

setupDatabase(); 