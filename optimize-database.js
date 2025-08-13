require('dotenv').config();
const mysql = require('mysql2/promise');

async function optimizeDatabase() {
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

        console.log('데이터베이스 성능 최적화 시작...');

        // 1. problems 테이블 인덱스 추가
        console.log('1. problems 테이블 인덱스 추가 중...');
        try {
            await connection.execute('CREATE INDEX idx_problems_subject_id ON problems(subject_id)');
            console.log('   - subject_id 인덱스 추가 완료');
        } catch (error) {
            if (error.code === 'ER_DUP_KEYNAME') {
                console.log('   - subject_id 인덱스 이미 존재');
            } else {
                console.error('   - subject_id 인덱스 추가 실패:', error.message);
            }
        }

        try {
            await connection.execute('CREATE INDEX idx_problems_created_at ON problems(created_at)');
            console.log('   - created_at 인덱스 추가 완료');
        } catch (error) {
            if (error.code === 'ER_DUP_KEYNAME') {
                console.log('   - created_at 인덱스 이미 존재');
            } else {
                console.error('   - created_at 인덱스 추가 실패:', error.message);
            }
        }

        // 2. user_progress 테이블 인덱스 추가
        console.log('2. user_progress 테이블 인덱스 추가 중...');
        try {
            await connection.execute('CREATE INDEX idx_user_progress_user_subject ON user_progress(user_id, subject_id)');
            console.log('   - user_id, subject_id 복합 인덱스 추가 완료');
        } catch (error) {
            if (error.code === 'ER_DUP_KEYNAME') {
                console.log('   - user_id, subject_id 복합 인덱스 이미 존재');
            } else {
                console.error('   - user_id, subject_id 복합 인덱스 추가 실패:', error.message);
            }
        }

        // 3. users 테이블 인덱스 추가
        console.log('3. users 테이블 인덱스 추가 중...');
        try {
            await connection.execute('CREATE INDEX idx_users_email ON users(email)');
            console.log('   - email 인덱스 추가 완료');
        } catch (error) {
            if (error.code === 'ER_DUP_KEYNAME') {
                console.log('   - email 인덱스 이미 존재');
            } else {
                console.error('   - email 인덱스 추가 실패:', error.message);
            }
        }

        // 4. subjects 테이블 인덱스 추가
        console.log('4. subjects 테이블 인덱스 추가 중...');
        try {
            await connection.execute('CREATE INDEX idx_subjects_name ON subjects(name)');
            console.log('   - name 인덱스 추가 완료');
        } catch (error) {
            if (error.code === 'ER_DUP_KEYNAME') {
                console.log('   - name 인덱스 이미 존재');
            } else {
                console.error('   - name 인덱스 추가 실패:', error.message);
            }
        }

        // 5. 테이블 최적화
        console.log('5. 테이블 최적화 중...');
        await connection.execute('OPTIMIZE TABLE problems');
        console.log('   - problems 테이블 최적화 완료');
        
        await connection.execute('OPTIMIZE TABLE user_progress');
        console.log('   - user_progress 테이블 최적화 완료');
        
        await connection.execute('OPTIMIZE TABLE users');
        console.log('   - users 테이블 최적화 완료');
        
        await connection.execute('OPTIMIZE TABLE subjects');
        console.log('   - subjects 테이블 최적화 완료');

        await connection.end();
        console.log('데이터베이스 성능 최적화 완료!');
        
    } catch (error) {
        console.error('데이터베이스 최적화 중 오류 발생:', error);
        process.exit(1);
    }
}

optimizeDatabase();
