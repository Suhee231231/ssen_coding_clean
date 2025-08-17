require('dotenv').config();
const { pool } = require('./config/database');

async function optimizeDatabase() {
    const connection = await pool.getConnection();
    
    try {
        console.log('🚀 데이터베이스 성능 최적화 시작...');
        
        // 1. 문제 테이블 인덱스 추가
        console.log('📊 problems 테이블 인덱스 추가 중...');
        
        // subject_id 인덱스 (이미 있을 수 있음)
        try {
            await connection.execute('CREATE INDEX idx_problems_subject_id ON problems(subject_id)');
            console.log('✅ problems.subject_id 인덱스 추가 완료');
        } catch (error) {
            if (error.code === 'ER_DUP_KEYNAME') {
                console.log('ℹ️  problems.subject_id 인덱스가 이미 존재합니다');
            } else {
                console.error('❌ problems.subject_id 인덱스 추가 실패:', error.message);
            }
        }
        
        // difficulty 인덱스
        try {
            await connection.execute('CREATE INDEX idx_problems_difficulty ON problems(difficulty)');
            console.log('✅ problems.difficulty 인덱스 추가 완료');
        } catch (error) {
            if (error.code === 'ER_DUP_KEYNAME') {
                console.log('ℹ️  problems.difficulty 인덱스가 이미 존재합니다');
            } else {
                console.error('❌ problems.difficulty 인덱스 추가 실패:', error.message);
            }
        }
        
        // created_at 인덱스
        try {
            await connection.execute('CREATE INDEX idx_problems_created_at ON problems(created_at)');
            console.log('✅ problems.created_at 인덱스 추가 완료');
        } catch (error) {
            if (error.code === 'ER_DUP_KEYNAME') {
                console.log('ℹ️  problems.created_at 인덱스가 이미 존재합니다');
            } else {
                console.error('❌ problems.created_at 인덱스 추가 실패:', error.message);
            }
        }
        
        // 2. 사용자 진행상황 테이블 인덱스 추가
        console.log('📊 user_progress 테이블 인덱스 추가 중...');
        
        // 복합 인덱스 (user_id, problem_id)
        try {
            await connection.execute('CREATE INDEX idx_user_progress_user_problem ON user_progress(user_id, problem_id)');
            console.log('✅ user_progress 복합 인덱스 추가 완료');
        } catch (error) {
            if (error.code === 'ER_DUP_KEYNAME') {
                console.log('ℹ️  user_progress 복합 인덱스가 이미 존재합니다');
            } else {
                console.error('❌ user_progress 복합 인덱스 추가 실패:', error.message);
            }
        }
        
        // is_correct 인덱스
        try {
            await connection.execute('CREATE INDEX idx_user_progress_is_correct ON user_progress(is_correct)');
            console.log('✅ user_progress.is_correct 인덱스 추가 완료');
        } catch (error) {
            if (error.code === 'ER_DUP_KEYNAME') {
                console.log('ℹ️  user_progress.is_correct 인덱스가 이미 존재합니다');
            } else {
                console.error('❌ user_progress.is_correct 인덱스 추가 실패:', error.message);
            }
        }
        
        // 3. 과목별 진행상황 테이블 인덱스 추가
        console.log('📊 user_subject_progress 테이블 인덱스 추가 중...');
        
        // 복합 인덱스 (user_id, subject_id)
        try {
            await connection.execute('CREATE INDEX idx_user_subject_progress_user_subject ON user_subject_progress(user_id, subject_id)');
            console.log('✅ user_subject_progress 복합 인덱스 추가 완료');
        } catch (error) {
            if (error.code === 'ER_DUP_KEYNAME') {
                console.log('ℹ️  user_subject_progress 복합 인덱스가 이미 존재합니다');
            } else {
                console.error('❌ user_subject_progress 복합 인덱스 추가 실패:', error.message);
            }
        }
        
        // 4. 과목 테이블 인덱스 추가
        console.log('📊 subjects 테이블 인덱스 추가 중...');
        
        // is_public 인덱스
        try {
            await connection.execute('CREATE INDEX idx_subjects_is_public ON subjects(is_public)');
            console.log('✅ subjects.is_public 인덱스 추가 완료');
        } catch (error) {
            if (error.code === 'ER_DUP_KEYNAME') {
                console.log('ℹ️  subjects.is_public 인덱스가 이미 존재합니다');
            } else {
                console.error('❌ subjects.is_public 인덱스 추가 실패:', error.message);
            }
        }
        
        // sort_order 인덱스
        try {
            await connection.execute('CREATE INDEX idx_subjects_sort_order ON subjects(sort_order)');
            console.log('✅ subjects.sort_order 인덱스 추가 완료');
        } catch (error) {
            if (error.code === 'ER_DUP_KEYNAME') {
                console.log('ℹ️  subjects.sort_order 인덱스가 이미 존재합니다');
            } else {
                console.error('❌ subjects.sort_order 인덱스 추가 실패:', error.message);
            }
        }
        
        // 5. 테이블 통계 업데이트
        console.log('📊 테이블 통계 업데이트 중...');
        await connection.execute('ANALYZE TABLE problems, user_progress, user_subject_progress, subjects');
        console.log('✅ 테이블 통계 업데이트 완료');
        
        console.log('🎉 데이터베이스 성능 최적화 완료!');
        
    } catch (error) {
        console.error('❌ 데이터베이스 최적화 중 오류:', error);
    } finally {
        connection.release();
        process.exit(0);
    }
}

// 스크립트 실행
optimizeDatabase();
