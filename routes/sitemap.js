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

// 사이트맵 생성 함수 (공통 로직)
async function generateSitemap() {
    const baseUrl = 'https://ssencoding.com';
    const currentDate = new Date().toISOString();
    
    // 정적 페이지들
    let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<!-- 🚀 SITEMAP VERSION - ${currentDate} - SEO OPTIMIZED FOR NAVER -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url>
        <loc>${baseUrl}/</loc>
        <lastmod>${currentDate}</lastmod>
        <changefreq>daily</changefreq>
        <priority>1.0</priority>
    </url>
    <url>
        <loc>${baseUrl}/problems.html</loc>
        <lastmod>${currentDate}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.9</priority>
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
        <loc>${baseUrl}/verify-email.html</loc>
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

    // 과목별 페이지 추가
    try {
        console.log('🔍 SITEMAP: 과목 데이터 조회 시작...');
        
        const [subjects] = await pool.execute(`
            SELECT name, updated_at, created_at
            FROM subjects
            WHERE is_public = TRUE
            ORDER BY name
        `);
        
        console.log(`✅ SITEMAP: ${subjects.length}개의 과목 발견`);
        
        subjects.forEach(subject => {
            const lastmod = new Date(subject.updated_at || subject.created_at).toISOString();
            const encodedSubjectName = encodeURIComponent(subject.name);
            sitemap += `
    <url>
        <loc>${baseUrl}/problems.html?subject=${encodedSubjectName}</loc>
        <lastmod>${lastmod}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.8</priority>
    </url>`;
        });
        
        console.log(`✅ SITEMAP: ${subjects.length}개의 과목 페이지 추가됨`);
        
    } catch (dbError) {
        console.error('❌ SITEMAP: 과목 데이터베이스 오류:', dbError);
    }

    // 개별 문제 페이지들 추가
    try {
        console.log('🔍 SITEMAP: 문제 데이터 조회 시작...');
        
        const [problems] = await pool.execute(`
            SELECT p.id, p.created_at, p.updated_at, s.name as subject_name
            FROM problems p
            JOIN subjects s ON p.subject_id = s.id
            WHERE s.is_public = TRUE
            ORDER BY p.id
        `);
        
        console.log(`✅ SITEMAP: ${problems.length}개의 문제 발견`);
        
        problems.forEach(problem => {
            const lastmod = new Date(problem.updated_at || problem.created_at).toISOString();
            const encodedSubjectName = encodeURIComponent(problem.subject_name);
            sitemap += `
    <url>
        <loc>${baseUrl}/problems/${encodedSubjectName}/problem/${problem.id}</loc>
        <lastmod>${lastmod}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.7</priority>
    </url>`;
        });
        
        console.log(`✅ SITEMAP: ${problems.length}개의 개별 문제 페이지 추가됨`);
        
    } catch (dbError) {
        console.error('❌ SITEMAP: 문제 데이터베이스 오류:', dbError);
    }

    sitemap += `
</urlset>`;

    console.log(`🎉 SITEMAP 생성 완료! 총 URL 수: ${sitemap.split('<url>').length - 1}`);
    return sitemap;
}

// generateSitemap 함수를 export하여 다른 파일에서 사용할 수 있도록 함
module.exports.generateSitemap = generateSitemap;

// sitemap.xml 경로 지원 (구글 서치 콘솔 호환성)
router.get('/xml', async (req, res) => {
    console.log('🚀 sitemap.xml 요청 받음!', new Date().toISOString());
    
    // 강력한 캐시 방지 헤더 설정
    res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate, private',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Last-Modified': new Date().toUTCString(),
        'ETag': `"${Date.now()}"`
    });
    
    try {
        console.log('📝 sitemap.xml 생성 시작...');
        const sitemap = await generateSitemap();
        console.log('✅ sitemap.xml 생성 완료!');
        res.header('Content-Type', 'application/xml');
        res.send(sitemap);
        
    } catch (error) {
        console.error('❌ sitemap.xml 생성 오류:', error);
        res.status(500).send('사이트맵 생성 중 오류가 발생했습니다.');
    }
});

// sitemap.xml/new 경로 지원 (네이버 서치어드바이저 호환성)
router.get('/xml/new', async (req, res) => {
    console.log('🚀 sitemap.xml/new 요청 받음! (네이버 호환)', new Date().toISOString());
    
    // 강력한 캐시 방지 헤더 설정
    res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate, private',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Last-Modified': new Date().toUTCString(),
        'ETag': `"${Date.now()}"`
    });
    
    try {
        console.log('📝 sitemap.xml/new 생성 시작...');
        const sitemap = await generateSitemap();
        console.log('✅ sitemap.xml/new 생성 완료!');
        res.header('Content-Type', 'application/xml');
        res.send(sitemap);
        
    } catch (error) {
        console.error('❌ sitemap.xml/new 생성 오류:', error);
        res.status(500).send('사이트맵 생성 중 오류가 발생했습니다.');
    }
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
        console.log('📝 NEW SITEMAP 생성 시작...');
        const sitemap = await generateSitemap();
        console.log('✅ NEW SITEMAP 생성 완료!');
        res.header('Content-Type', 'application/xml');
        res.send(sitemap);
        
    } catch (error) {
        console.error('❌ NEW SITEMAP 생성 오류:', error);
        res.status(500).send('사이트맵 생성 중 오류가 발생했습니다.');
    }
});

// 기존 사이트맵 (직접 처리 - 리다이렉트 제거)
router.get('/', async (req, res) => {
    console.log('🚀 기존 사이트맵 요청 받음!', new Date().toISOString());
    
    // 강력한 캐시 방지 헤더 설정
    res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate, private',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Last-Modified': new Date().toUTCString(),
        'ETag': `"${Date.now()}"`
    });
    
    try {
        console.log('📝 기존 사이트맵 생성 시작...');
        const sitemap = await generateSitemap();
        console.log('✅ 기존 사이트맵 생성 완료!');
        res.header('Content-Type', 'application/xml');
        res.send(sitemap);
        
    } catch (error) {
        console.error('❌ 기존 사이트맵 생성 오류:', error);
        res.status(500).send('사이트맵 생성 중 오류가 발생했습니다.');
    }
});

module.exports = router;
