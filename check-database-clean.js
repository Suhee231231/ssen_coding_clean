const mysql = require('mysql2/promise');

async function checkAndCleanDatabase() {
    let connection;
    
    try {
        // 데이터베이스 연결
        connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '6305rpqkfk**',
            database: 'coding_problems',
            charset: 'utf8mb4'
        });
        
        console.log('=== 데이터베이스 상태 확인 및 정리 ===');
        
        // 1. 현재 과목 목록 확인
        console.log('\n📚 현재 과목 목록:');
        const [subjects] = await connection.execute('SELECT * FROM subjects ORDER BY id');
        subjects.forEach(subject => {
            console.log(`- ID: ${subject.id}, 이름: "${subject.name}", 설명: "${subject.description}", 문제 수: ${subject.total_problems}`);
        });
        
        // 2. 중복 과목 찾기
        console.log('\n🔍 중복 과목 확인:');
        const [duplicates] = await connection.execute(`
            SELECT name, COUNT(*) as count, GROUP_CONCAT(id) as ids
            FROM subjects 
            GROUP BY name 
            HAVING COUNT(*) > 1
        `);
        
        if (duplicates.length > 0) {
            console.log('❌ 중복된 과목 발견:');
            duplicates.forEach(dup => {
                console.log(`  - "${dup.name}": ${dup.count}개 (ID: ${dup.ids})`);
            });
            
            // 3. 중복 과목 정리
            console.log('\n🧹 중복 과목 정리 중...');
            for (const dup of duplicates) {
                const ids = dup.ids.split(',').map(id => parseInt(id));
                const keepId = Math.min(...ids); // 가장 작은 ID 유지
                const deleteIds = ids.filter(id => id !== keepId);
                
                console.log(`  - "${dup.name}": ID ${keepId} 유지, ${deleteIds.join(', ')} 삭제`);
                
                // 삭제할 과목에 속한 문제들을 유지할 과목으로 이동
                for (const deleteId of deleteIds) {
                    await connection.execute(
                        'UPDATE problems SET subject_id = ? WHERE subject_id = ?',
                        [keepId, deleteId]
                    );
                }
                
                // 중복 과목 삭제
                await connection.execute('DELETE FROM subjects WHERE id IN (?)', [deleteIds]);
            }
            
            // 4. 과목별 문제 수 업데이트
            console.log('\n📊 과목별 문제 수 업데이트 중...');
            const [allSubjects] = await connection.execute('SELECT id FROM subjects');
            for (const subject of allSubjects) {
                await connection.execute(`
                    UPDATE subjects 
                    SET total_problems = (SELECT COUNT(*) FROM problems WHERE subject_id = ?)
                    WHERE id = ?
                `, [subject.id, subject.id]);
            }
            
            console.log('✅ 중복 과목 정리 완료!');
        } else {
            console.log('✅ 중복된 과목이 없습니다.');
        }
        
        // 5. 정리 후 과목 목록 확인
        console.log('\n📚 정리 후 과목 목록:');
        const [cleanSubjects] = await connection.execute('SELECT * FROM subjects ORDER BY id');
        cleanSubjects.forEach(subject => {
            console.log(`- ID: ${subject.id}, 이름: "${subject.name}", 설명: "${subject.description}", 문제 수: ${subject.total_problems}`);
        });
        
        // 6. 진행 상황 테이블 확인
        console.log('\n📈 진행 상황 테이블 확인:');
        const [progressCount] = await connection.execute('SELECT COUNT(*) as count FROM user_subject_progress');
        console.log(`- user_subject_progress 테이블: ${progressCount[0].count}개 레코드`);
        
        const [userProgressCount] = await connection.execute('SELECT COUNT(*) as count FROM user_progress');
        console.log(`- user_progress 테이블: ${userProgressCount[0].count}개 레코드`);
        
    } catch (error) {
        console.error('❌ 오류 발생:', error);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

checkAndCleanDatabase(); 