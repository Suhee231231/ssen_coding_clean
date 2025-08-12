const fetch = require('node-fetch');

async function testAPI() {
    try {
        console.log('API 테스트 시작...');
        const response = await fetch('http://localhost:3001/api/problems/subjects');
        const data = await response.json();
        
        console.log('전체 응답:', JSON.stringify(data, null, 2));
        console.log('latestUpdate 값:', data.latestUpdate);
        console.log('latestUpdate 타입:', typeof data.latestUpdate);
        
        if (data.latestUpdate) {
            const date = new Date(data.latestUpdate);
            console.log('파싱된 날짜:', date);
            console.log('한국 날짜 형식:', date.toLocaleDateString('ko-KR'));
        }
    } catch (error) {
        console.error('API 테스트 오류:', error);
    }
}

testAPI(); 