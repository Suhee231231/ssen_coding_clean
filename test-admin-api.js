const fetch = require('node-fetch');

async function testAdminAPI() {
    try {
        console.log('관리자 API 테스트 시작...');
        
        // 1. 먼저 로그인
        console.log('1. 관리자 로그인 시도...');
        const loginResponse = await fetch('http://localhost:3001/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: 'admin@codingproblems.com',
                password: 'admin123'
            })
        });
        
        const loginData = await loginResponse.json();
        console.log('로그인 결과:', loginData);
        
        if (!loginData.success) {
            console.log('로그인 실패');
            return;
        }
        
        // 2. 쿠키 추출
        const cookies = loginResponse.headers.get('set-cookie');
        console.log('쿠키:', cookies);
        
        // 3. 관리자 권한 확인
        console.log('2. 관리자 권한 확인...');
        const authResponse = await fetch('http://localhost:3001/api/auth/check', {
            headers: {
                'Cookie': cookies
            }
        });
        
        const authData = await authResponse.json();
        console.log('권한 확인 결과:', authData);
        
        // 4. 문제 목록 조회
        console.log('3. 문제 목록 조회...');
        const problemsResponse = await fetch('http://localhost:3001/api/admin/problems', {
            headers: {
                'Cookie': cookies
            }
        });
        
        const problemsData = await problemsResponse.json();
        console.log('문제 목록 결과:', problemsData);
        
        if (problemsData.success) {
            console.log(`총 ${problemsData.problems.length}개의 문제가 조회되었습니다.`);
            if (problemsData.problems.length > 0) {
                console.log('첫 번째 문제:', problemsData.problems[0]);
            }
        }
        
    } catch (error) {
        console.error('테스트 중 오류 발생:', error);
    }
}

testAdminAPI(); 