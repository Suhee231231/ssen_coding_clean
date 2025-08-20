const express = require('express');
const { pool } = require('../config/database');
const router = express.Router();

// 테스트용 엔드포인트 추가
router.get('/test', (req, res) => {
    res.json({
        message: '🚀 NEW SITEMAP CODE IS WORKING!',
        timestamp: new Date().toISOString(),
        version: 'SEO OPTIMIZED VERSION'
    });
});

// 사이트맵 생성 (캐시 우회를 위한 새로운 경로)
router.get('/new', async (req, res) => {
    console.log('🚀 NEW SITEMAP 요청 받음!', new Date().toISOString());
    
    // 강력한 캐시 방지 헤더 설정
    res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate, private',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Last-Modified': new Date().toUTCString(),
        'ETag': `"${Date.now()}"`
    });
    
    try {
        const baseUrl = 'https://ssencoding.com';
        const currentDate = new Date().toISOString();
        
        console.log('📝 NEW SITEMAP 생성 시작...');
        
        // 정적 페이지들
        let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<!-- 🚀 NEW SITEMAP VERSION - ${currentDate} - SEO OPTIMIZED -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url>
        <loc>${baseUrl}/</loc>
        <lastmod>${currentDate}</lastmod>
        <changefreq>daily</changefreq>
        <priority>1.0</priority>
    </url>
    <url>
        <loc>${baseUrl}/login.html</loc>
        <lastmod>${currentDate}</lastmod>
        <changefreq>monthly</changefreq>
        <priority>0.8</priority>
    </url>
    <url>
        <loc>${baseUrl}/register.html</loc>
        <lastmod>${currentDate}</lastmod>
        <changefreq>monthly</changefreq>
        <priority>0.8</priority>
    </url>
    <url>
        <loc>${baseUrl}/problems.html</loc>
        <lastmod>${currentDate}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.9</priority>
    </url>
    <url>
        <loc>${baseUrl}/profile.html</loc>
        <lastmod>${currentDate}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.7</priority>
    </url>
    <url>
        <loc>${baseUrl}/wrong-problems.html</loc>
        <lastmod>${currentDate}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.7</priority>
    </url>
    <url>
        <loc>${baseUrl}/admin.html</loc>
        <lastmod>${currentDate}</lastmod>
        <changefreq>monthly</changefreq>
        <priority>0.5</priority>
    </url>
    <url>
        <loc>${baseUrl}/verify-email</loc>
        <lastmod>${currentDate}</lastmod>
        <changefreq>monthly</changefreq>
        <priority>0.6</priority>
    </url>
    <url>
        <loc>${baseUrl}/rss</loc>
        <lastmod>${currentDate}</lastmod>
        <changefreq>daily</changefreq>
        <priority>0.8</priority>
    </url>`;

        // 개별 문제 페이지들 추가
        try {
            console.log('🔍 NEW SITEMAP: 문제 데이터 조회 시작...');
            
            const [problems] = await pool.execute(`
                SELECT p.id, p.created_at, p.updated_at, s.name as subject_name
                FROM problems p
                JOIN subjects s ON p.subject_id = s.id
                WHERE s.is_public = TRUE
                ORDER BY p.id
            `);
            
            console.log(`✅ NEW SITEMAP: ${problems.length}개의 문제 발견`);
            
            problems.forEach(problem => {
                const lastmod = problem.updated_at || problem.created_at;
                sitemap += `
    <url>
        <loc>${baseUrl}/problems/${problem.subject_name}/problem/${problem.id}</loc>
        <lastmod>${lastmod}</lastmod>
        <changefreq>monthly</changefreq>
        <priority>0.6</priority>
    </url>`;
            });
            
        } catch (dbError) {
            console.error('❌ NEW SITEMAP: 데이터베이스 오류:', dbError);
            // 데이터베이스 오류가 있어도 기본 사이트맵은 반환
        }

        sitemap += `
</urlset>`;

        console.log('✅ NEW SITEMAP 생성 완료!');
        res.header('Content-Type', 'application/xml');
        res.send(sitemap);
        
    } catch (error) {
        console.error('❌ NEW SITEMAP 생성 오류:', error);
        res.status(500).send('사이트맵 생성 중 오류가 발생했습니다.');
    }
});

// 기존 사이트맵 (리다이렉트)
router.get('/', async (req, res) => {
    console.log('🚀 기존 사이트맵 요청 받음!', new Date().toISOString());
    res.redirect('/sitemap.xml/new');
});

module.exports = router;
