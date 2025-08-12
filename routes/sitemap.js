const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

// Sitemap 생성 함수
function generateSitemap(pages, problems) {
    const baseUrl = 'http://localhost:3001';
    const currentDate = new Date().toISOString();
    
    let sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

    // 정적 페이지들 추가
    pages.forEach(page => {
        sitemapContent += `
    <url>
        <loc>${baseUrl}${page.url}</loc>
        <lastmod>${page.lastmod}</lastmod>
        <changefreq>${page.changefreq}</changefreq>
        <priority>${page.priority}</priority>
    </url>`;
    });

    // 문제 페이지들 추가
    problems.forEach(problem => {
        sitemapContent += `
    <url>
        <loc>${baseUrl}/problems.html?id=${problem.id}</loc>
        <lastmod>${new Date(problem.created_at).toISOString()}</lastmod>
        <changefreq>monthly</changefreq>
        <priority>0.7</priority>
    </url>`;
    });

    sitemapContent += `
</urlset>`;

    return sitemapContent;
}

// Sitemap 라우트
router.get('/', async (req, res) => {
    try {
        // 정적 페이지 목록
        const pages = [
            {
                url: '/',
                lastmod: new Date().toISOString(),
                changefreq: 'daily',
                priority: '1.0'
            },
            {
                url: '/login.html',
                lastmod: new Date().toISOString(),
                changefreq: 'monthly',
                priority: '0.8'
            },
            {
                url: '/register.html',
                lastmod: new Date().toISOString(),
                changefreq: 'monthly',
                priority: '0.8'
            },
            {
                url: '/problems.html',
                lastmod: new Date().toISOString(),
                changefreq: 'daily',
                priority: '0.9'
            },
            {
                url: '/profile.html',
                lastmod: new Date().toISOString(),
                changefreq: 'weekly',
                priority: '0.7'
            },
            {
                url: '/verify-email.html',
                lastmod: new Date().toISOString(),
                changefreq: 'monthly',
                priority: '0.6'
            },
            {
                url: '/rss',
                lastmod: new Date().toISOString(),
                changefreq: 'daily',
                priority: '0.8'
            }
        ];

        // 문제 목록 가져오기 (최대 100개)
        const [problems] = await pool.execute(`
            SELECT id, created_at 
            FROM problems 
            ORDER BY created_at DESC 
            LIMIT 100
        `);
        
        // Sitemap 생성
        const sitemap = generateSitemap(pages, problems);
        
        // XML 컨텐츠 타입 설정
        res.set('Content-Type', 'application/xml; charset=utf-8');
        res.send(sitemap);
        
    } catch (error) {
        console.error('Sitemap 생성 오류:', error);
        res.status(500).send('Sitemap 생성 중 오류가 발생했습니다.');
    }
});

module.exports = router;
