require('dotenv').config();
const { pool } = require('./config/database');

async function createStatsTables() {
    const connection = await pool.getConnection();
    
    try {
        console.log('🚀 데이터베이스 통계 테이블 생성 시작...');
        
        // 1. 과목별 사용자 통계 테이블 생성
        console.log('📊 user_subject_stats 테이블 생성 중...');
        
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS user_subject_stats (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                subject_id INT NOT NULL,
                total_answered INT DEFAULT 0,
                total_correct INT DEFAULT 0,
                accuracy DECIMAL(5,2) DEFAULT 0.00,
                last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY unique_user_subject (user_id, subject_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        console.log('✅ user_subject_stats 테이블 생성 완료');
        
        // 2. 틀린 문제만 저장하는 테이블 생성
        console.log('📊 user_wrong_problems 테이블 생성 중...');
        
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS user_wrong_problems (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                problem_id INT NOT NULL,
                selected_answer VARCHAR(10) NOT NULL,
                answered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_user_problem (user_id, problem_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (problem_id) REFERENCES problems(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        console.log('✅ user_wrong_problems 테이블 생성 완료');
        
        // 3. 기존 user_progress 데이터를 통계 테이블로 마이그레이션
        console.log('📊 기존 데이터 마이그레이션 중...');
        
        // 과목별 통계 계산 및 저장
        await connection.execute(`
            INSERT INTO user_subject_stats (user_id, subject_id, total_answered, total_correct, accuracy)
            SELECT 
                up.user_id,
                p.subject_id,
                COUNT(*) as total_answered,
                SUM(CASE WHEN up.is_correct = 1 THEN 1 ELSE 0 END) as total_correct,
                ROUND((SUM(CASE WHEN up.is_correct = 1 THEN 1 ELSE 0 END) / COUNT(*)) * 100, 2) as accuracy
            FROM user_progress up
            JOIN problems p ON up.problem_id = p.id
            GROUP BY up.user_id, p.subject_id
            ON DUPLICATE KEY UPDATE
                total_answered = VALUES(total_answered),
                total_correct = VALUES(total_correct),
                accuracy = VALUES(accuracy)
        `);
        console.log('✅ 과목별 통계 마이그레이션 완료');
        
        // 틀린 문제만 별도 테이블로 이동
        await connection.execute(`
            INSERT INTO user_wrong_problems (user_id, problem_id, selected_answer, answered_at)
            SELECT user_id, problem_id, selected_answer, answered_at
            FROM user_progress
            WHERE is_correct = 0
            ON DUPLICATE KEY UPDATE
                selected_answer = VALUES(selected_answer),
                answered_at = VALUES(answered_at)
        `);
        console.log('✅ 틀린 문제 마이그레이션 완료');
        
        // 4. 인덱스 생성
        console.log('📊 통계 테이블 인덱스 생성 중...');
        
        try {
            await connection.execute('CREATE INDEX idx_user_subject_stats_user ON user_subject_stats(user_id)');
            console.log('✅ user_subject_stats.user_id 인덱스 생성 완료');
        } catch (error) {
            if (error.code === 'ER_DUP_KEYNAME') {
                console.log('ℹ️  user_subject_stats.user_id 인덱스가 이미 존재합니다');
            }
        }
        
        try {
            await connection.execute('CREATE INDEX idx_user_wrong_problems_user ON user_wrong_problems(user_id)');
            console.log('✅ user_wrong_problems.user_id 인덱스 생성 완료');
        } catch (error) {
            if (error.code === 'ER_DUP_KEYNAME') {
                console.log('ℹ️  user_wrong_problems.user_id 인덱스가 이미 존재합니다');
            }
        }
        
        console.log('🎉 데이터베이스 통계 테이블 생성 완료!');
        
        // 5. 현재 데이터 현황 출력
        const [statsCount] = await connection.execute('SELECT COUNT(*) as count FROM user_subject_stats');
        const [wrongCount] = await connection.execute('SELECT COUNT(*) as count FROM user_wrong_problems');
        const [progressCount] = await connection.execute('SELECT COUNT(*) as count FROM user_progress');
        
        console.log('📊 현재 데이터 현황:');
        console.log(`- user_subject_stats: ${statsCount[0].count}개 레코드`);
        console.log(`- user_wrong_problems: ${wrongCount[0].count}개 레코드`);
        console.log(`- user_progress: ${progressCount[0].count}개 레코드 (기존)`);
        
    } catch (error) {
        console.error('❌ 통계 테이블 생성 중 오류:', error);
    } finally {
        connection.release();
        process.exit(0);
    }
}

// 스크립트 실행
createStatsTables();
