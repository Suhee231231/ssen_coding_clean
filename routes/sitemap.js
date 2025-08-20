const express = require('express');
const { pool } = require('../config/database');
const router = express.Router();

// 사이트맵 생성
router.get('/', async (req, res) => {
    try {
        const baseUrl = 'https://ssencoding.com';
        const currentDate = new Date().toISOString();
        
        // 정적 페이지들
        let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
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
        const [problems] = await pool.execute(`
            SELECT p.id, p.created_at, p.updated_at, s.name as subject_name
            FROM problems p
            JOIN subjects s ON p.subject_id = s.id
            WHERE s.is_public = TRUE
            ORDER BY p.id
        `);

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

        sitemap += `
</urlset>`;

        res.header('Content-Type', 'application/xml');
        res.send(sitemap);
        
    } catch (error) {
        console.error('사이트맵 생성 오류:', error);
        res.status(500).send('사이트맵 생성 중 오류가 발생했습니다.');
    }
});

module.exports = router;
