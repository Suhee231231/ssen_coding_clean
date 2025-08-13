require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const passport = require('passport');

// 라우터들 import
const authRoutes = require('./routes/auth');
const problemRoutes = require('./routes/problems');
const dashboardRoutes = require('./routes/dashboard');
const adminRoutes = require('./routes/admin');
const googleAuthRoutes = require('./routes/google-auth');
const emailVerificationRoutes = require('./routes/email-verification');
const rssRoutes = require('./routes/rss');
const sitemapRoutes = require('./routes/sitemap');

const app = express();
const PORT = process.env.PORT || 3001;

// 미들웨어 설정
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: '7d', // 7일간 캐싱으로 연장
    etag: true,
    lastModified: true,
    immutable: true, // 파일이 변경되지 않음을 명시
    setHeaders: (res, path) => {
        // CSS, JS 파일에 대한 추가 캐싱 설정
        if (path.endsWith('.css') || path.endsWith('.js')) {
            res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1년
        }
    }
}));

// favicon 명시적 라우트
app.get('/favicon.ico', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'favicon.ico'));
});

// 세션 설정 (강화된 버전)
app.use(session({
    secret: process.env.SESSION_SECRET || 'coding-problems-secret-key',
    resave: true, // Railway 환경에서 세션 유지를 위해 true로 변경
    saveUninitialized: true, // 세션 초기화를 위해 true로 변경
    cookie: { 
        secure: false, // Railway 환경에서는 false로 설정
        httpOnly: true, // XSS 공격 방지
        maxAge: 24 * 60 * 60 * 1000, // 24시간
        sameSite: 'lax' // CSRF 공격 방지
    },
    name: 'ssen-coding-session' // 세션 쿠키 이름 명시
}));

// Passport 초기화
app.use(passport.initialize());
app.use(passport.session());

// 라우터 설정
app.use('/api/auth', authRoutes);
app.use('/api/problems', problemRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/admin', adminRoutes);
app.use('/auth', googleAuthRoutes);
app.use('/api/email-verification', emailVerificationRoutes);
app.use('/rss', rssRoutes);
app.use('/sitemap.xml', sitemapRoutes);

// 메인 페이지 라우트
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 이메일 인증 페이지 라우트
app.get('/verify-email', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'verify-email.html'));
});

// 내 정보 페이지 라우트
app.get('/profile.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'profile.html'));
});

// 기존 대시보드 페이지 리다이렉트 (내 정보 페이지로)
app.get('/dashboard.html', (req, res) => {
    res.redirect('/profile.html');
});

// 서버 시작
app.listen(PORT, () => {
    console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
    console.log(`http://localhost:${PORT}`);
}); 