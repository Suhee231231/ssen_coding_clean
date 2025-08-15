const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

// RSS 피드 생성 함수
function generateRSSFeed(problems, req) {
    // 환경 변수에서 도메인 가져오기, 없으면 요청 헤더에서 추출
    let baseUrl = process.env.DOMAIN_URL || 'https://ssencoding.com';
    
    // 개발 환경에서는 요청 헤더에서 호스트 추출
    if (process.env.NODE_ENV === 'development') {
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = req.headers.host;
        baseUrl = `${protocol}://${host}`;
    }
    
    const currentDate = new Date().toUTCString();
    
    let rssContent = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
    <channel>
        <title>코딩 문제 RSS 피드</title>
        <link>${baseUrl}</link>
        <description>최신 코딩 문제들을 RSS로 구독하세요</description>
        <language>ko-KR</language>
        <lastBuildDate>${currentDate}</lastBuildDate>
        <atom:link href="${baseUrl}/rss" rel="self" type="application/rss+xml" />
`;

    problems.forEach(problem => {
        const pubDate = new Date(problem.created_at).toUTCString();
        const description = problem.explanation ? problem.explanation.replace(/<[^>]*>/g, '') : '';
        
        rssContent += `
        <item>
            <title>${problem.title || problem.content}</title>
            <link>${baseUrl}/problems.html?id=${problem.id}</link>
            <guid>${baseUrl}/problems.html?id=${problem.id}</guid>
            <pubDate>${pubDate}</pubDate>
            <description><![CDATA[${description}]]></description>
            <category>${problem.subject || '코딩문제'}</category>
        </item>`;
    });

    rssContent += `
    </channel>
</rss>`;

    return rssContent;
}

// RSS 피드 라우트
router.get('/', async (req, res) => {
    try {
        // 최근 문제들을 가져옴 (최대 20개)
        const [problems] = await pool.execute(`
            SELECT p.id, p.title, p.content, p.explanation, s.name as subject, p.created_at 
            FROM problems p
            LEFT JOIN subjects s ON p.subject_id = s.id
            ORDER BY p.created_at DESC 
            LIMIT 20
        `);
        
        // RSS 피드 생성 (req 객체 전달)
        const rssFeed = generateRSSFeed(problems, req);
        
        // RSS 컨텐츠 타입 설정
        res.set('Content-Type', 'application/rss+xml; charset=utf-8');
        res.send(rssFeed);
        
    } catch (error) {
        console.error('RSS 피드 생성 오류:', error);
        res.status(500).send('RSS 피드 생성 중 오류가 발생했습니다.');
    }
});

module.exports = router;
