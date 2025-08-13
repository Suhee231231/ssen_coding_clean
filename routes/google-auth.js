const express = require('express');
const passport = require('passport');
const router = express.Router();
const { pool } = require('../config/database');

// Google OAuth 설정
const googleConfig = require('../config/google-oauth');

// Google OAuth 환경 변수가 설정된 경우에만 Strategy 로드
if (googleConfig.google.clientID && googleConfig.google.clientSecret) {
    const GoogleStrategy = require('passport-google-oauth20').Strategy;
    
    // Passport Google Strategy 설정
    passport.use(new GoogleStrategy({
        clientID: googleConfig.google.clientID,
        clientSecret: googleConfig.google.clientSecret,
        callbackURL: googleConfig.google.callbackURL
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            // Google 프로필에서 정보 추출
            const googleId = profile.id;
            const email = profile.emails[0].value;
            const name = profile.displayName;
            const picture = profile.photos[0].value;

            // 데이터베이스에서 기존 사용자 확인
            const [existingUser] = await pool.query(
                'SELECT * FROM users WHERE google_id = ? OR email = ?',
                [googleId, email]
            );

            if (existingUser.length > 0) {
                // 기존 사용자가 있으면 로그인
                console.log('기존 사용자 로그인:', existingUser[0]);
                return done(null, existingUser[0]);
            } else {
                console.log('새 사용자 생성 시작:', { googleId, email, name, picture });
                // 새 사용자 생성 (사용자명 중복 처리)
                let finalUsername = name;
                let counter = 1;
                
                // 사용자명 중복 확인 및 처리
                console.log('사용자명 중복 확인 시작:', finalUsername);
                while (true) {
                    const [existingUsers] = await pool.query(
                        'SELECT id FROM users WHERE username = ?',
                        [finalUsername]
                    );
                    
                    if (existingUsers.length === 0) {
                        console.log('최종 사용자명 결정:', finalUsername);
                        break; // 중복되지 않는 사용자명을 찾음
                    }
                    
                    // 중복되는 경우 숫자를 붙여서 새로운 사용자명 생성
                    finalUsername = `${name}${counter}`;
                    counter++;
                    console.log('사용자명 중복, 새 이름 시도:', finalUsername);
                }
                
                console.log('데이터베이스에 새 사용자 삽입 시도:', { finalUsername, email, googleId, picture });
                const [result] = await pool.query(
                    'INSERT INTO users (username, email, password, google_id, google_picture, created_at) VALUES (?, ?, NULL, ?, ?, NOW())',
                    [finalUsername, email, googleId, picture]
                );
                console.log('삽입 결과:', result);

                const [newUser] = await pool.query(
                    'SELECT * FROM users WHERE id = ?',
                    [result.insertId]
                );
                console.log('조회된 새 사용자:', newUser[0]);

                if (!newUser[0]) {
                    console.error('새 사용자 생성 실패: 사용자를 찾을 수 없습니다.');
                    return done(new Error('새 사용자 생성 실패'), null);
                }

                console.log('새 사용자 생성 완료:', newUser[0]);
                return done(null, newUser[0]);
            }
        } catch (error) {
            console.error('Google OAuth 전략 오류:', error);
            return done(error, null);
        }
    }));
} else {
    console.log('Google OAuth 환경 변수가 설정되지 않아 Google 로그인이 비활성화됩니다.');
}

// Passport serialize/deserialize 설정
passport.serializeUser((user, done) => {
    console.log('사용자 직렬화:', user);
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        console.log('사용자 역직렬화, ID:', id);
        const [users] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
        console.log('역직렬화된 사용자:', users[0]);
        done(null, users[0]);
    } catch (error) {
        console.error('역직렬화 오류:', error);
        done(error, null);
    }
});

// Google 로그인 시작 (환경 변수가 설정된 경우에만 작동)
router.get('/google', (req, res) => {
    if (googleConfig.google.clientID && googleConfig.google.clientSecret) {
        passport.authenticate('google', {
            scope: ['profile', 'email']
        })(req, res);
    } else {
        res.status(400).json({ error: 'Google OAuth가 설정되지 않았습니다.' });
    }
});

// Google 로그인 콜백 (환경 변수가 설정된 경우에만 작동)
router.get('/google/callback', (req, res) => {
    if (googleConfig.google.clientID && googleConfig.google.clientSecret) {
        passport.authenticate('google', { 
            failureRedirect: '/login.html',
            failureFlash: true 
        })(req, res, () => {
            console.log('Google OAuth 로그인 성공:', req.user);
            
            // req.user가 존재하는지 확인
            if (!req.user) {
                console.error('req.user가 undefined입니다.');
                return res.redirect('/login.html?error=user_not_found');
            }
            
            // 세션 저장을 명시적으로 처리
            req.session.save((err) => {
                if (err) {
                    console.error('세션 저장 오류:', err);
                    return res.redirect('/login.html?error=session_error');
                }
                
                console.log('세션 저장 완료, 사용자 ID:', req.user.id);
                console.log('세션 정보:', req.session);
                
                // 성공적으로 로그인되면 메인 페이지로 리디렉션
                res.redirect('/');
            });
        });
    } else {
        res.status(400).json({ error: 'Google OAuth가 설정되지 않았습니다.' });
    }
});

// 로그인 상태 확인 API
router.get('/status', (req, res) => {
    if (req.isAuthenticated()) {
        res.json({
            isAuthenticated: true,
            user: {
                id: req.user.id,
                username: req.user.username,
                email: req.user.email
            }
        });
    } else {
        res.json({
            isAuthenticated: false,
            user: null
        });
    }
});

// 로그아웃
router.get('/logout', (req, res) => {
    req.logout((err) => {
        if (err) {
            console.error('로그아웃 오류:', err);
            return res.status(500).json({ error: '로그아웃 중 오류가 발생했습니다.' });
        }
        res.redirect('/');
    });
});

module.exports = router; 