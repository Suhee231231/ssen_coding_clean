require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const passport = require('passport');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');

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

// Rate Limiting 설정 - 성능 최적화 버전
// 문제 풀이 전용 rate limiter (더 관대하게)
const problemLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15분
    max: 5000, // 문제 풀이용 5000회 (2000 → 5000으로 증가)
    message: {
        success: false,
        message: '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // 성공한 요청은 카운트하지 않음
});

// API 전용 rate limiter (더 관대하게)
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15분
    max: 1000, // API용 1000회 (500 → 1000으로 증가)
    message: {
        success: false,
        message: '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // 성공한 요청은 카운트하지 않음
});

// 로그인/회원가입 전용 rate limiter (보안 강화)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15분
    max: 30, // IP당 최대 30번 시도 (50 → 30으로 조정)
    message: {
        success: false,
        message: '로그인 시도가 너무 많습니다. 15분 후 다시 시도해주세요.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // 성공한 요청은 카운트하지 않음
    // 추가 보안: 실패한 요청에 대해 더 엄격한 제한
    skipFailedRequests: false, // 실패한 요청은 반드시 카운트
});

// Google OAuth 전용 rate limiter (더 관대하게)
const googleAuthLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15분
    max: 100, // IP당 최대 100번 시도 (30 → 100으로 증가)
    message: {
        success: false,
        message: 'Google 로그인 시도가 너무 많습니다. 15분 후 다시 시도해주세요.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // 성공한 요청은 카운트하지 않음
});

// 미들웨어 설정
app.use(cookieParser());

app.use(helmet({
            contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: [
                    "'self'", 
                    "'unsafe-inline'", 
                    "https://pagead2.googlesyndication.com", 
                    "https://use.typekit.net", 
                    "https://cdnjs.cloudflare.com", 
                    "https://developers.google.com", 
                    "https://ep2.adtrafficquality.google", 
                    "https://www.googletagmanager.com",
                    "https://googleads.g.doubleclick.net",
                    "https://tpc.googlesyndication.com",
                    "https://www.google-analytics.com",
                    "https://ssl.google-analytics.com",
                    "https://analytics.google.com"
                ],
                scriptSrcAttr: ["'unsafe-inline'"],
                styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
                fontSrc: ["'self'", "https://fonts.gstatic.com", "https://use.typekit.net", "https://cdnjs.cloudflare.com"],
                imgSrc: ["'self'", "data:", "https:", "https://googleads.g.doubleclick.net", "https://tpc.googlesyndication.com", "https://www.google-analytics.com", "https://ssl.google-analytics.com"],
                connectSrc: [
                    "'self'", 
                    "https://use.typekit.net", 
                    "https://p.typekit.net", 
                    "https://*.googlesyndication.com", 
                    "https://*.gstatic.com", 
                    "https://*.doubleclick.net", 
                    "https://*.adtrafficquality.google", 
                    "https://*.googleadservices.com",
                    "https://*.google-analytics.com",
                    "https://analytics.google.com"
                ],
                frameSrc: [
                    "'self'", 
                    "https://*.googlesyndication.com", 
                    "https://*.doubleclick.net", 
                    "https://*.adtrafficquality.google", 
                    "https://*.googleadservices.com",
                    "https://googleads.g.doubleclick.net",
                    "https://tpc.googlesyndication.com",
                    "https://www.google.com"
                ],
                frameAncestors: [
                    "'self'", 
                    "https://accounts.google.com", 
                    "https://www.google.com",
                    "https://googleads.g.doubleclick.net",
                    "https://tpc.googlesyndication.com",
                    "https://pagead2.googlesyndication.com"
                ],
                objectSrc: ["'none'"],
                baseUri: ["'self'"],
                formAction: ["'self'"]
            }
        }
})); // 기본 보안 헤더 설정

// Railway 환경에서 trust proxy 설정
app.set('trust proxy', 1);

app.use(cors());

// 세밀한 Rate Limiting 적용
app.use((req, res, next) => {
    // 정적 파일은 rate limiting 제외
    if (req.path.startsWith('/css/') || 
        req.path.startsWith('/js/') || 
        req.path.startsWith('/images/') ||
        req.path === '/favicon.ico') {
        return next();
    }
    
    // 문제 풀이 관련 API는 관대한 제한 적용
    if (req.path.startsWith('/api/problems/') && 
        (req.path.includes('/save-progress') || req.path.includes('/wrong-submit'))) {
        return problemLimiter(req, res, next);
    }
    
    // 그 외 API는 보수적인 제한 적용
    if (req.path.startsWith('/api/')) {
        return apiLimiter(req, res, next);
    }
    
    // 문제 풀이 페이지는 제외
    if (req.path.startsWith('/problems.html')) {
        return next();
    }
    
    // 기본적으로는 API 제한 적용
    return apiLimiter(req, res, next);
});

// 개별 문제 페이지는 정적 콘텐츠로 취급 (캐시 허용)

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
    resave: false, // 성능 최적화 유지
    saveUninitialized: false, // 성능 최적화 유지
    cookie: { 
        secure: process.env.NODE_ENV === 'production', // 프로덕션에서만 HTTPS 강제
        httpOnly: true, // XSS 공격 방지
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7일로 연장
        sameSite: 'lax', // Google OAuth를 위해 lax로 변경
        name: 'ssen-coding-session' // 쿠키 이름을 cookie 객체 내부에 설정
    },
    name: 'ssen-coding-session', // 세션 쿠키 이름 명시
    unset: 'destroy' // 세션 삭제 시 완전히 제거
}));

// Passport 초기화
app.use(passport.initialize());
app.use(passport.session());

// Passport serialize/deserialize 설정 (일반 로그인용)
const { pool } = require('./config/database');

// 데이터베이스 테이블 자동 업데이트 함수
async function updateDatabaseTables() {
    try {
        console.log('🔧 데이터베이스 테이블 업데이트 중...');
        
        // 먼저 테이블 구조 확인
        const [columns] = await pool.execute('DESCRIBE subjects');
        const existingColumns = columns.map(col => col.Field);
        
        console.log('현재 subjects 테이블 컬럼:', existingColumns);
        
        // category 컬럼 추가 (없는 경우에만)
        if (!existingColumns.includes('category')) {
            try {
                await pool.execute('ALTER TABLE subjects ADD COLUMN category VARCHAR(50) DEFAULT "프로그래밍" AFTER description');
                console.log('✅ category 컬럼 추가 완료');
            } catch (error) {
                console.error('❌ category 컬럼 추가 오류:', error.message);
            }
        } else {
            console.log('ℹ️  category 컬럼이 이미 존재합니다');
        }
        
        // is_public 컬럼 추가 (없는 경우에만)
        if (!existingColumns.includes('is_public')) {
            try {
                await pool.execute('ALTER TABLE subjects ADD COLUMN is_public BOOLEAN DEFAULT true AFTER category');
                console.log('✅ is_public 컬럼 추가 완료');
            } catch (error) {
                console.error('❌ is_public 컬럼 추가 오류:', error.message);
            }
        } else {
            console.log('ℹ️  is_public 컬럼이 이미 존재합니다');
        }
        
        // sort_order 컬럼 추가 (없는 경우에만)
        if (!existingColumns.includes('sort_order')) {
            try {
                await pool.execute('ALTER TABLE subjects ADD COLUMN sort_order INT DEFAULT 0 AFTER is_public');
                console.log('✅ sort_order 컬럼 추가 완료');
            } catch (error) {
                console.error('❌ sort_order 컬럼 추가 오류:', error.message);
            }
        } else {
            console.log('ℹ️  sort_order 컬럼이 이미 존재합니다');
        }
        
        // 컬럼 추가 후 다시 확인
        const [updatedColumns] = await pool.execute('DESCRIBE subjects');
        const hasCategory = updatedColumns.some(col => col.Field === 'category');
        
        // 기존 과목들에 기본 카테고리 설정 (category 컬럼이 있는 경우에만)
        if (hasCategory) {
            const categoryMappings = {
                'JavaScript': '웹 개발',
                'Python': '프로그래밍 언어',
                'Java': '프로그래밍 언어',
                'HTML/CSS': '웹 개발',
                'SQL': '데이터베이스',
                '알고리즘': '알고리즘'
            };
            
            for (const [subjectName, category] of Object.entries(categoryMappings)) {
                try {
                    await pool.execute(`
                        UPDATE subjects 
                        SET category = ? 
                        WHERE name = ? AND (category IS NULL OR category = '프로그래밍')
                    `, [category, subjectName]);
                } catch (error) {
                    console.error(`❌ ${subjectName} 카테고리 업데이트 오류:`, error.message);
                }
            }
            console.log('✅ 기본 카테고리 설정 완료');
        }
        
        console.log('✅ 데이터베이스 테이블 업데이트 완료!');
    } catch (error) {
        console.error('❌ 데이터베이스 업데이트 중 오류:', error);
    }
}

// 데이터베이스 인덱스 자동 생성 함수
async function createDatabaseIndexes() {
    try {
        console.log('🚀 데이터베이스 인덱스 생성 중...');
        
        // 1. problems 테이블 인덱스
        console.log('📊 problems 테이블 인덱스 생성 중...');
        
        try {
            await pool.execute('CREATE INDEX idx_problems_subject_id ON problems(subject_id)');
            console.log('✅ problems.subject_id 인덱스 생성 완료');
        } catch (error) {
            if (error.code === 'ER_DUP_KEYNAME') {
                console.log('ℹ️  problems.subject_id 인덱스가 이미 존재합니다');
            } else {
                console.error('❌ problems.subject_id 인덱스 생성 실패:', error.message);
            }
        }
        
        try {
            await pool.execute('CREATE INDEX idx_problems_difficulty ON problems(difficulty)');
            console.log('✅ problems.difficulty 인덱스 생성 완료');
        } catch (error) {
            if (error.code === 'ER_DUP_KEYNAME') {
                console.log('ℹ️  problems.difficulty 인덱스가 이미 존재합니다');
            } else {
                console.error('❌ problems.difficulty 인덱스 생성 실패:', error.message);
            }
        }
        
        try {
            await pool.execute('CREATE INDEX idx_problems_created_at ON problems(created_at)');
            console.log('✅ problems.created_at 인덱스 생성 완료');
        } catch (error) {
            if (error.code === 'ER_DUP_KEYNAME') {
                console.log('ℹ️  problems.created_at 인덱스가 이미 존재합니다');
            } else {
                console.error('❌ problems.created_at 인덱스 생성 실패:', error.message);
            }
        }
        
        // 2. user_progress 테이블 인덱스
        console.log('📊 user_progress 테이블 인덱스 생성 중...');
        
        try {
            await pool.execute('CREATE INDEX idx_user_progress_user_problem ON user_progress(user_id, problem_id)');
            console.log('✅ user_progress 복합 인덱스 생성 완료');
        } catch (error) {
            if (error.code === 'ER_DUP_KEYNAME') {
                console.log('ℹ️  user_progress 복합 인덱스가 이미 존재합니다');
            } else {
                console.error('❌ user_progress 복합 인덱스 생성 실패:', error.message);
            }
        }
        
        try {
            await pool.execute('CREATE INDEX idx_user_progress_is_correct ON user_progress(is_correct)');
            console.log('✅ user_progress.is_correct 인덱스 생성 완료');
        } catch (error) {
            if (error.code === 'ER_DUP_KEYNAME') {
                console.log('ℹ️  user_progress.is_correct 인덱스가 이미 존재합니다');
            } else {
                console.error('❌ user_progress.is_correct 인덱스 생성 실패:', error.message);
            }
        }
        
        // 3. user_subject_progress 테이블 인덱스
        console.log('📊 user_subject_progress 테이블 인덱스 생성 중...');
        
        try {
            await pool.execute('CREATE INDEX idx_user_subject_progress_user_subject ON user_subject_progress(user_id, subject_id)');
            console.log('✅ user_subject_progress 복합 인덱스 생성 완료');
        } catch (error) {
            if (error.code === 'ER_DUP_KEYNAME') {
                console.log('ℹ️  user_subject_progress 복합 인덱스가 이미 존재합니다');
            } else {
                console.error('❌ user_subject_progress 복합 인덱스 생성 실패:', error.message);
            }
        }
        
        // 4. subjects 테이블 인덱스
        console.log('📊 subjects 테이블 인덱스 생성 중...');
        
        try {
            await pool.execute('CREATE INDEX idx_subjects_is_public ON subjects(is_public)');
            console.log('✅ subjects.is_public 인덱스 생성 완료');
        } catch (error) {
            if (error.code === 'ER_DUP_KEYNAME') {
                console.log('ℹ️  subjects.is_public 인덱스가 이미 존재합니다');
            } else {
                console.error('❌ subjects.is_public 인덱스 생성 실패:', error.message);
            }
        }
        
        try {
            await pool.execute('CREATE INDEX idx_subjects_sort_order ON subjects(sort_order)');
            console.log('✅ subjects.sort_order 인덱스 생성 완료');
        } catch (error) {
            if (error.code === 'ER_DUP_KEYNAME') {
                console.log('ℹ️  subjects.sort_order 인덱스가 이미 존재합니다');
            } else {
                console.error('❌ subjects.sort_order 인덱스 생성 실패:', error.message);
            }
        }
        
        console.log('🎉 데이터베이스 인덱스 생성 완료!');
    } catch (error) {
        console.error('❌ 데이터베이스 인덱스 생성 중 오류:', error);
    }
}

// 통계 테이블 자동 생성 함수
async function createStatsTables() {
    try {
        console.log('🚀 데이터베이스 통계 테이블 생성 중...');
        
        // 1. 과목별 사용자 통계 테이블 생성
        console.log('📊 user_subject_stats 테이블 생성 중...');
        
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS user_subject_stats (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                subject_id INT NOT NULL,
                total_answered INT DEFAULT 0,
                total_correct INT DEFAULT 0,
                accuracy DECIMAL(5,2) DEFAULT 0.00,
                last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY unique_user_subject (user_id, subject_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        console.log('✅ user_subject_stats 테이블 생성 완료');
        
        // 2. 틀린 문제만 저장하는 테이블 생성
        console.log('📊 user_wrong_problems 테이블 생성 중...');
        
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS user_wrong_problems (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                problem_id INT NOT NULL,
                selected_answer VARCHAR(10) NOT NULL,
                answered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_user_problem (user_id, problem_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (problem_id) REFERENCES problems(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        console.log('✅ user_wrong_problems 테이블 생성 완료');
        
        // 3. 기존 user_progress 데이터를 통계 테이블로 마이그레이션 (기존 데이터가 있는 경우에만)
        console.log('📊 기존 데이터 마이그레이션 중...');
        
        // user_progress 테이블이 존재하는지 확인
        const [tables] = await pool.execute("SHOW TABLES LIKE 'user_progress'");
        
        if (tables.length > 0) {
            // 과목별 통계 계산 및 저장
            await pool.execute(`
                INSERT INTO user_subject_stats (user_id, subject_id, total_answered, total_correct, accuracy)
                SELECT 
                    up.user_id,
                    p.subject_id,
                    COUNT(*) as total_answered,
                    SUM(CASE WHEN up.is_correct = 1 THEN 1 ELSE 0 END) as total_correct,
                    ROUND((SUM(CASE WHEN up.is_correct = 1 THEN 1 ELSE 0 END) / COUNT(*)) * 100, 2) as accuracy
                FROM user_progress up
                JOIN problems p ON up.problem_id = p.id
                GROUP BY up.user_id, p.subject_id
                ON DUPLICATE KEY UPDATE
                    total_answered = VALUES(total_answered),
                    total_correct = VALUES(total_correct),
                    accuracy = VALUES(accuracy)
            `);
            console.log('✅ 과목별 통계 마이그레이션 완료');
            
            // 틀린 문제만 별도 테이블로 이동
            await pool.execute(`
                INSERT INTO user_wrong_problems (user_id, problem_id, selected_answer, answered_at)
                SELECT user_id, problem_id, selected_answer, answered_at
                FROM user_progress
                WHERE is_correct = 0
                ON DUPLICATE KEY UPDATE
                    selected_answer = VALUES(selected_answer),
                    answered_at = VALUES(answered_at)
            `);
            console.log('✅ 틀린 문제 마이그레이션 완료');
        } else {
            console.log('ℹ️  user_progress 테이블이 없어서 마이그레이션을 건너뜁니다');
        }
        
        // 4. 인덱스 생성
        console.log('📊 통계 테이블 인덱스 생성 중...');
        
        try {
            await pool.execute('CREATE INDEX idx_user_subject_stats_user ON user_subject_stats(user_id)');
            console.log('✅ user_subject_stats.user_id 인덱스 생성 완료');
        } catch (error) {
            if (error.code === 'ER_DUP_KEYNAME') {
                console.log('ℹ️  user_subject_stats.user_id 인덱스가 이미 존재합니다');
            }
        }
        
        try {
            await pool.execute('CREATE INDEX idx_user_wrong_problems_user ON user_wrong_problems(user_id)');
            console.log('✅ user_wrong_problems.user_id 인덱스 생성 완료');
        } catch (error) {
            if (error.code === 'ER_DUP_KEYNAME') {
                console.log('ℹ️  user_wrong_problems.user_id 인덱스가 이미 존재합니다');
            }
        }
        
        console.log('🎉 데이터베이스 통계 테이블 생성 완료!');
        
    } catch (error) {
        console.error('❌ 통계 테이블 생성 중 오류:', error);
    }
}

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const [users] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
        if (users.length > 0) {
            done(null, users[0]);
        } else {
            done(null, false);
        }
    } catch (error) {
        console.error('Passport 역직렬화 오류:', error);
        done(error, null);
    }
});

// 라우터 설정
app.use('/api/auth', authLimiter, authRoutes); // 인증 라우트에 엄격한 rate limiting 적용
app.use('/api/problems', problemRoutes);
app.use('/problems', problemRoutes); // 개별 문제 페이지 라우트 추가
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
app.listen(PORT, async () => {
    console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
    console.log(`http://localhost:${PORT}`);
    
    // 데이터베이스 테이블 자동 업데이트 실행
    await updateDatabaseTables();
    await createDatabaseIndexes(); // 데이터베이스 인덱스 자동 생성 실행
    await createStatsTables(); // 통계 테이블 자동 생성 실행
}); 