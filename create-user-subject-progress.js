require('dotenv').config();
const mysql = require('mysql2/promise');

async function createUserSubjectProgress() {
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

        console.log('user_subject_progress 테이블 생성 중...');
        
        // user_subject_progress 테이블 생성
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS user_subject_progress (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                subject_id INT NOT NULL,
                last_problem_id INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY unique_user_subject (user_id, subject_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
                FOREIGN KEY (last_problem_id) REFERENCES problems(id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        
        console.log('user_subject_progress 테이블 생성 완료!');

        await connection.end();
        console.log('데이터베이스 연결 종료');
        
    } catch (error) {
        console.error('테이블 생성 중 오류 발생:', error);
        process.exit(1);
    }
}

createUserSubjectProgress();
