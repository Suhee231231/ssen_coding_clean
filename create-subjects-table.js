require('dotenv').config();
const mysql = require('mysql2/promise');

async function createSubjectsTable() {
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

        // subjects 테이블 생성
        const createSubjectsTable = `
            CREATE TABLE IF NOT EXISTS subjects (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                is_public BOOLEAN DEFAULT TRUE,
                sort_order INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `;

        await connection.execute(createSubjectsTable);
        console.log('subjects 테이블 생성 완료!');

        // 기본 과목 데이터 추가
        const insertSubjects = `
            INSERT IGNORE INTO subjects (name, description, is_public, sort_order) VALUES 
            ('JavaScript 기초', 'JavaScript의 기본 문법과 개념을 학습합니다.', TRUE, 1),
            ('Python 기초', 'Python의 기본 문법과 개념을 학습합니다.', TRUE, 2),
            ('Java 기초', 'Java의 기본 문법과 개념을 학습합니다.', TRUE, 3),
            ('C++ 기초', 'C++의 기본 문법과 개념을 학습합니다.', TRUE, 4),
            ('알고리즘', '다양한 알고리즘 문제를 풀어봅니다.', TRUE, 5)
        `;

        await connection.execute(insertSubjects);
        console.log('기본 과목 데이터 추가 완료!');

        await connection.end();
        console.log('subjects 테이블 설정 완료!');
        
    } catch (error) {
        console.error('subjects 테이블 생성 중 오류 발생:', error);
        process.exit(1);
    }
}

createSubjectsTable();
