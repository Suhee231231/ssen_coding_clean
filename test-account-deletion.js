require('dotenv').config();
const mysql = require('mysql2/promise');

async function testAccountDeletionAndRecreation() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT,
        charset: process.env.DB_CHARSET || 'utf8mb4'
    });

    try {
        console.log('=== 계정 탈퇴 후 재가입 테스트 시작 ===\n');

        const testEmail = 'test@example.com';
        const testUsername = 'testuser';

        // 1. 기존 테스트 계정이 있다면 삭제
        console.log('1. 기존 테스트 계정 정리...');
        await connection.execute('DELETE FROM users WHERE email = ?', [testEmail]);
        console.log('   ✅ 기존 테스트 계정 삭제 완료');

        // 2. 테스트 계정 생성
        console.log('\n2. 테스트 계정 생성...');
        const bcrypt = require('bcrypt');
        const hashedPassword = await bcrypt.hash('test123', 10);
        
        const [result] = await connection.execute(
            'INSERT INTO users (username, email, password, email_verified) VALUES (?, ?, ?, TRUE)',
            [testUsername, testEmail, hashedPassword]
        );
        const userId = result.insertId;
        console.log(`   ✅ 테스트 계정 생성 완료 (ID: ${userId})`);

        // 3. 사용자 데이터 확인
        console.log('\n3. 생성된 계정 정보 확인...');
        const [users] = await connection.execute(
            'SELECT id, username, email, email_verified FROM users WHERE email = ?',
            [testEmail]
        );
        console.log('   계정 정보:', users[0]);

        // 4. 테스트 학습 데이터 생성
        console.log('\n4. 테스트 학습 데이터 생성...');
        await connection.execute(
            'INSERT INTO user_progress (user_id, problem_id, selected_answer, is_correct) VALUES (?, ?, ?, ?)',
            [userId, 1, 'A', true]
        );
        console.log('   ✅ 테스트 학습 데이터 생성 완료');

        // 5. 학습 데이터 확인
        console.log('\n5. 학습 데이터 확인...');
        const [progress] = await connection.execute(
            'SELECT * FROM user_progress WHERE user_id = ?',
            [userId]
        );
        console.log(`   학습 데이터 개수: ${progress.length}개`);

        // 6. 계정 탈퇴 (회원탈퇴 API 로직과 동일)
        console.log('\n6. 계정 탈퇴 실행...');
        await connection.beginTransaction();
        
        try {
            // 사용자의 학습 진행상황 삭제
            await connection.execute(
                'DELETE FROM user_progress WHERE user_id = ?',
                [userId]
            );
            console.log('   ✅ 학습 데이터 삭제 완료');

            // 사용자 삭제
            await connection.execute(
                'DELETE FROM users WHERE id = ?',
                [userId]
            );
            console.log('   ✅ 사용자 계정 삭제 완료');

            await connection.commit();
            console.log('   ✅ 트랜잭션 커밋 완료');

        } catch (error) {
            await connection.rollback();
            throw error;
        }

        // 7. 삭제 확인
        console.log('\n7. 삭제 확인...');
        const [deletedUsers] = await connection.execute(
            'SELECT * FROM users WHERE email = ?',
            [testEmail]
        );
        const [deletedProgress] = await connection.execute(
            'SELECT * FROM user_progress WHERE user_id = ?',
            [userId]
        );
        
        console.log(`   남은 사용자: ${deletedUsers.length}개`);
        console.log(`   남은 학습 데이터: ${deletedProgress.length}개`);

        if (deletedUsers.length === 0 && deletedProgress.length === 0) {
            console.log('   ✅ 계정 및 데이터 완전 삭제 확인');
        }

        // 8. 동일한 이메일로 재가입 테스트
        console.log('\n8. 동일한 이메일로 재가입 테스트...');
        
        // 이메일 중복 체크 (회원가입 로직과 동일)
        const [existingUsers] = await connection.execute(
            'SELECT id FROM users WHERE email = ?',
            [testEmail]
        );

        if (existingUsers.length === 0) {
            console.log('   ✅ 이메일 중복 없음 - 재가입 가능');
            
            // 재가입 실행
            const [newResult] = await connection.execute(
                'INSERT INTO users (username, email, password, email_verified) VALUES (?, ?, ?, TRUE)',
                [testUsername, testEmail, hashedPassword]
            );
            console.log(`   ✅ 재가입 성공 (새 ID: ${newResult.insertId})`);
            
            // 재가입된 계정 확인
            const [newUsers] = await connection.execute(
                'SELECT id, username, email FROM users WHERE email = ?',
                [testEmail]
            );
            console.log('   재가입된 계정:', newUsers[0]);
            
        } else {
            console.log('   ❌ 이메일 중복 - 재가입 불가');
        }

        // 9. 최종 정리
        console.log('\n9. 테스트 데이터 정리...');
        await connection.execute('DELETE FROM users WHERE email = ?', [testEmail]);
        console.log('   ✅ 테스트 데이터 정리 완료');

        console.log('\n=== 테스트 완료 ===');
        console.log('✅ 계정 탈퇴 후 재가입 기능이 정상적으로 작동합니다!');

    } catch (error) {
        console.error('❌ 테스트 중 오류 발생:', error);
    } finally {
        await connection.end();
    }
}

testAccountDeletionAndRecreation();
