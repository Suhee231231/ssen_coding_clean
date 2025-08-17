const mysql = require('mysql2/promise');

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '6305rpqkfk**',
    database: process.env.DB_NAME || 'coding_problems',
    port: process.env.DB_PORT || 3306,
    charset: process.env.DB_CHARSET || 'utf8mb4'
};

// 연결 풀 생성 (Railway Pro 플랜 최적화 설정)
const pool = mysql.createPool({
    ...dbConfig,
    waitForConnections: true,
    connectionLimit: 25, // Railway Pro 플랜에 맞게 증가 (10 → 25)
    queueLimit: 50, // 대기열 제한 증가 (20 → 50)
    acquireTimeout: 60000, // 연결 획득 타임아웃 60초
    timeout: 60000, // 쿼리 타임아웃 60초
    charset: 'utf8mb4',
    // 성능 최적화를 위한 추가 설정
    multipleStatements: false, // 보안을 위해 비활성화
    dateStrings: true, // 날짜를 문자열로 반환하여 파싱 오버헤드 감소
    supportBigNumbers: true, // 큰 숫자 지원
    bigNumberStrings: true, // 큰 숫자를 문자열로 처리
    // 연결 풀 모니터링을 위한 이벤트 리스너
    onConnection: (connection) => {
        // 연결별 설정
        connection.execute('SET SESSION sql_mode = "NO_ENGINE_SUBSTITUTION"');
        connection.execute('SET SESSION time_zone = "+09:00"');
    }
});

// 연결 풀 상태 모니터링
setInterval(() => {
    console.log(`📊 DB Pool Status: ${pool.pool.config.connectionLimit} total, ${pool.pool._allConnections.length} active, ${pool.pool._freeConnections.length} free`);
}, 300000); // 5분마다 로그

// 연결 테스트
async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('✅ 데이터베이스 연결 성공!');
        
        // 연결 풀 정보 출력
        console.log(`📊 연결 풀 설정: ${pool.pool.config.connectionLimit}개 연결, ${pool.pool.config.queueLimit}개 대기열`);
        
        connection.release();
    } catch (error) {
        console.error('❌ 데이터베이스 연결 실패:', error.message);
        process.exit(1);
    }
}

module.exports = {
    pool,
    testConnection
}; 