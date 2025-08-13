require('dotenv').config();
const mysql = require('mysql2/promise');

async function fixTableStructure() {
    try {
        console.log('Railway 데이터베이스 연결 중...');
        
        // Railway 데이터베이스 연결
        const railwayConnection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: process.env.DB_PORT,
            charset: process.env.DB_CHARSET || 'utf8mb4'
        });

        console.log('Railway 데이터베이스 연결 성공!');

        // problems 테이블 구조 수정
        console.log('problems 테이블 구조 수정 중...');
        
        // title 컬럼을 TEXT로 변경
        await railwayConnection.execute('ALTER TABLE problems MODIFY COLUMN title TEXT');
        console.log('title 컬럼을 TEXT로 변경 완료');
        
        // content 컬럼을 LONGTEXT로 변경
        await railwayConnection.execute('ALTER TABLE problems MODIFY COLUMN content LONGTEXT');
        console.log('content 컬럼을 LONGTEXT로 변경 완료');
        
        // option 컬럼들을 TEXT로 변경
        await railwayConnection.execute('ALTER TABLE problems MODIFY COLUMN option_a TEXT');
        await railwayConnection.execute('ALTER TABLE problems MODIFY COLUMN option_b TEXT');
        await railwayConnection.execute('ALTER TABLE problems MODIFY COLUMN option_c TEXT');
        await railwayConnection.execute('ALTER TABLE problems MODIFY COLUMN option_d TEXT');
        console.log('option 컬럼들을 TEXT로 변경 완료');
        
        // explanation 컬럼을 LONGTEXT로 변경
        await railwayConnection.execute('ALTER TABLE problems MODIFY COLUMN explanation LONGTEXT');
        console.log('explanation 컬럼을 LONGTEXT로 변경 완료');

        await railwayConnection.end();
        console.log('\n테이블 구조 수정 완료!');
        
    } catch (error) {
        console.error('테이블 구조 수정 중 오류 발생:', error);
        process.exit(1);
    }
}

fixTableStructure();
