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
                return done(null, existingUser[0]);
            } else {
                // 새 사용자 생성 (사용자명 중복 처리)
                let finalUsername = name;
                let counter = 1;
                
                // 사용자명 중복 확인 및 처리
                while (true) {
                    const [existingUsers] = await pool.query(
                        'SELECT id FROM users WHERE username = ?',
                        [finalUsername]
                    );
                    
                    if (existingUsers.length === 0) {
                        break; // 중복되지 않는 사용자명을 찾음
                    }
                    
                    // 중복되는 경우 숫자를 붙여서 새로운 사용자명 생성
                    finalUsername = `${name}${counter}`;
                    counter++;
                }
                
                const [result] = await pool.query(
                    'INSERT INTO users (username, email, google_id, google_picture, created_at) VALUES (?, ?, ?, ?, NOW())',
                    [finalUsername, email, googleId, picture]
                );

                const [newUser] = await pool.query(
                    'SELECT * FROM users WHERE id = ?',
                    [result.insertId]
                );

                return done(null, newUser[0]);
            }
        } catch (error) {
            return done(error, null);
        }
    }));
} else {
    console.log('Google OAuth 환경 변수가 설정되지 않아 Google 로그인이 비활성화됩니다.');
}

// Passport serialize/deserialize 설정
passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const [users] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
        done(null, users[0]);
    } catch (error) {
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