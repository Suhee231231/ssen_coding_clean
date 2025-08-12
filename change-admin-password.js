const mysql = require('mysql2');
const bcrypt = require('bcrypt');

const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '6305rpqkfk**',
    database: 'coding_problems',
    charset: 'utf8mb4'
};

async function changeAdminPassword() {
    console.log('=== 관리자 비밀번호 변경 ===');
    
    // 새 비밀번호 설정 (여기서 변경하세요)
    const newPassword = 'newadmin123'; // 원하는 새 비밀번호로 변경
    
    try {
        const connection = mysql.createConnection(dbConfig);
        
        // Promise로 래핑
        const connectPromise = new Promise((resolve, reject) => {
            connection.connect((err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        
        await connectPromise;
        console.log('✅ 데이터베이스 연결 성공!');
        
        // 새 비밀번호 해시화
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        // admin 사용자의 비밀번호 업데이트
        await new Promise((resolve, reject) => {
            connection.query(
                'UPDATE users SET password = ? WHERE username = ?',
                [hashedPassword, 'admin'],
                (err, result) => {
                    if (err) reject(err);
                    else resolve(result);
                }
            );
        });
        
        console.log('✅ 관리자 비밀번호 변경 완료!');
        console.log('\n새 관리자 로그인 정보:');
        console.log('  사용자명: admin');
        console.log(`  비밀번호: ${newPassword}`);
        
        connection.end();
        
    } catch (error) {
        console.error('❌ 비밀번호 변경 실패:', error.message);
    }
}

changeAdminPassword(); 