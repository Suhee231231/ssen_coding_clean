require('dotenv').config();
const mysql = require('mysql2/promise');

async function setupDatabase() {
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

        // users 테이블 생성
        const createUsersTable = `
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                is_admin BOOLEAN DEFAULT FALSE,
                is_verified BOOLEAN DEFAULT FALSE,
                verification_token VARCHAR(255),
                google_id VARCHAR(255),
                google_picture VARCHAR(500),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `;

        await connection.execute(createUsersTable);
        console.log('users 테이블 생성 완료!');

        // problems 테이블 생성
        const createProblemsTable = `
            CREATE TABLE IF NOT EXISTS problems (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(500) NOT NULL,
                content TEXT NOT NULL,
                option_a VARCHAR(500) NOT NULL,
                option_b VARCHAR(500) NOT NULL,
                option_c VARCHAR(500) NOT NULL,
                option_d VARCHAR(500) NOT NULL,
                correct_answer CHAR(1) NOT NULL,
                explanation TEXT,
                difficulty ENUM('easy', 'medium', 'hard') DEFAULT 'medium',
                category VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `;

        await connection.execute(createProblemsTable);
        console.log('problems 테이블 생성 완료!');

        // user_progress 테이블 생성
        const createUserProgressTable = `
            CREATE TABLE IF NOT EXISTS user_progress (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                problem_id INT NOT NULL,
                selected_answer CHAR(1),
                is_correct BOOLEAN,
                answered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (problem_id) REFERENCES problems(id) ON DELETE CASCADE,
                UNIQUE KEY unique_user_problem (user_id, problem_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `;

        await connection.execute(createUserProgressTable);
        console.log('user_progress 테이블 생성 완료!');

        // 기본 관리자 계정 생성 (선택사항)
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
        const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
        
        const bcrypt = require('bcrypt');
        const hashedPassword = await bcrypt.hash(adminPassword, 10);
        
        const insertAdmin = `
            INSERT IGNORE INTO users (username, email, password, is_admin, is_verified) 
            VALUES ('admin', ?, ?, TRUE, TRUE)
        `;
        
        await connection.execute(insertAdmin, [adminEmail, hashedPassword]);
        console.log('기본 관리자 계정 생성 완료!');

        await connection.end();
        console.log('데이터베이스 설정 완료!');
        
    } catch (error) {
        console.error('데이터베이스 설정 중 오류 발생:', error);
        process.exit(1);
    }
}

setupDatabase();
