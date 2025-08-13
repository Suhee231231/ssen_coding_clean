require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const passport = require('passport');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

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

// Rate Limiting 설정
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15분
    max: 500, // IP당 최대 요청 수 (200에서 500으로 증가)
    message: {
        success: false,
        message: '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// 로그인/회원가입 전용 rate limiter (더 관대하게 조정)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15분
    max: 20, // IP당 최대 20번 시도 (5에서 20으로 증가)
    message: {
        success: false,
        message: '로그인 시도가 너무 많습니다. 15분 후 다시 시도해주세요.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Google OAuth 전용 rate limiter (더 관대하게)
const googleAuthLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15분
    max: 30, // IP당 최대 30번 시도
    message: {
        success: false,
        message: 'Google 로그인 시도가 너무 많습니다. 15분 후 다시 시도해주세요.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// 미들웨어 설정
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://pagead2.googlesyndication.com", "https://use.typekit.net", "https://cdnjs.cloudflare.com", "https://developers.google.com", "https://ep2.adtrafficquality.google"],
            scriptSrcAttr: ["'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://use.typekit.net", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "https://use.typekit.net", "https://p.typekit.net", "https://googleads.g.doubleclick.net", "https://ep1.adtrafficquality.google", "https://ep2.adtrafficquality.google", "https://csi.gstatic.com"],
            frameSrc: ["'self'", "https://googleads.g.doubleclick.net", "https://pagead2.googlesyndication.com", "https://ep2.adtrafficquality.google", "https://www.google.com"],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"]
        }
    }
})); // 기본 보안 헤더 설정

// Railway 환경에서 trust proxy 설정
app.set('trust proxy', 1);

app.use(cors());
app.use(limiter); // 전역 rate limiting 적용

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

// 세션 설정 (Railway 호환 버전)
app.use(session({
    secret: process.env.SESSION_SECRET || 'coding-problems-secret-key',
    resave: true, // Google OAuth를 위해 true로 변경
    saveUninitialized: true, // Google OAuth를 위해 true로 변경
    cookie: { 
        secure: process.env.NODE_ENV === 'production', // 프로덕션에서만 HTTPS 강제
        httpOnly: true, // XSS 공격 방지
        maxAge: 3 * 24 * 60 * 60 * 1000, // 3일 (적당한 세션)
        sameSite: 'lax' // Google OAuth를 위해 lax로 변경
    },
    name: 'ssen-coding-session', // 세션 쿠키 이름 명시
    rolling: true, // 세션 갱신
    unset: 'destroy' // 세션 삭제 시 완전히 제거
}));

// Passport 초기화
app.use(passport.initialize());
app.use(passport.session());

// 라우터 설정
app.use('/api/auth', authLimiter, authRoutes); // 인증 라우트에 엄격한 rate limiting 적용
app.use('/api/problems', problemRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/admin', adminRoutes);
app.use('/auth', googleAuthLimiter, googleAuthRoutes); // Google 인증에도 rate limiting 적용
app.use('/api/email-verification', authLimiter, emailVerificationRoutes); // 이메일 인증에도 rate limiting 적용
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