const bcrypt = require('bcrypt');
const { pool } = require('./config/database');

async function createAdminUser() {
    try {
        const connection = await pool.getConnection();
        
        // 관리자 계정 정보
        const adminData = {
            username: 'admin',
            email: 'admin@codingproblems.com',
            password: 'admin123',
            is_admin: true
        };
        
        // 비밀번호 해시화
        const hashedPassword = await bcrypt.hash(adminData.password, 10);
        
        // 관리자 계정 생성
        const [result] = await connection.execute(`
            INSERT INTO users (username, email, password, is_admin) 
            VALUES (?, ?, ?, ?)
        `, [adminData.username, adminData.email, hashedPassword, adminData.is_admin]);
        
        connection.release();
        
        console.log('✅ 관리자 계정이 성공적으로 생성되었습니다!');
        console.log('📋 관리자 로그인 정보:');
        console.log(`   사용자명: ${adminData.username}`);
        console.log(`   이메일: ${adminData.email}`);
        console.log(`   비밀번호: ${adminData.password}`);
        console.log('\n⚠️  보안을 위해 로그인 후 비밀번호를 변경하세요.');
        
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            console.log('ℹ️  관리자 계정이 이미 존재합니다.');
        } else {
            console.error('❌ 관리자 계정 생성 실패:', error.message);
        }
    } finally {
        process.exit(0);
    }
}

// 스크립트 실행
createAdminUser(); 