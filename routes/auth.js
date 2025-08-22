const express = require('express');
const bcrypt = require('bcrypt');
const { pool } = require('../config/database');
const { authenticateJWT, requireAuth } = require('../middleware/jwt-auth');

const router = express.Router();

// 회원가입
router.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // 입력 검증
        if (!username || !email || !password) {
            return res.status(400).json({ 
                success: false, 
                message: '모든 필드를 입력해주세요.' 
            });
        }

        // 비밀번호 해시화
        const hashedPassword = await bcrypt.hash(password, 10);

        // 사용자 생성
        const [result] = await pool.execute(
            'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
            [username, email, hashedPassword]
        );

        res.json({ 
            success: true, 
            message: '회원가입이 완료되었습니다.',
            userId: result.insertId 
        });

    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ 
                success: false, 
                message: '이미 존재하는 사용자명 또는 이메일입니다.' 
            });
        }
        console.error('회원가입 오류:', error);
        res.status(500).json({ 
            success: false, 
            message: '서버 오류가 발생했습니다.' 
        });
    }
});

// 로그인
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // 입력 검증
        if (!email || !password) {
            return res.status(400).json({ 
                success: false, 
                message: '이메일과 비밀번호를 입력해주세요.' 
            });
        }

        // 사용자 조회
        const [users] = await pool.execute(
            'SELECT id, username, email, password, is_admin, email_verified FROM users WHERE email = ?',
            [email]
        );

        if (users.length === 0) {
            return res.status(401).json({ 
                success: false, 
                message: '이메일 또는 비밀번호가 올바르지 않습니다.' 
            });
        }

        const user = users[0];

        // 이메일 인증 확인 (admin 계정은 제외)
        if (!user.email_verified && !user.is_admin) {
            return res.status(401).json({ 
                success: false, 
                message: '이메일 인증이 필요합니다. 이메일을 확인해주세요.' 
            });
        }

        // 비밀번호 검증
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ 
                success: false, 
                message: '이메일 또는 비밀번호가 올바르지 않습니다.' 
            });
        }

        // JWT 토큰 생성
        const jwtConfig = require('../config/jwt');
        const tokenPayload = {
            userId: user.id,
            username: user.username,
            email: user.email,
            isAdmin: user.is_admin || false
        };
        
        const token = jwtConfig.generateToken(tokenPayload);
        
        if (!token) {
            return res.status(500).json({ 
                success: false, 
                message: '토큰 생성 중 오류가 발생했습니다.' 
            });
        }
        
        // JWT 토큰을 쿠키에 저장
        res.cookie('auth_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7일
            sameSite: 'lax'
        });
        
        console.log('로그인 성공 - 사용자 ID:', user.id);
        
        res.json({ 
            success: true, 
            message: '로그인 성공',
            user: {
                id: user.id,
                username: user.username,
                is_admin: user.is_admin
            }
        });

    } catch (error) {
        console.error('로그인 오류:', error);
        res.status(500).json({ 
            success: false, 
            message: '서버 오류가 발생했습니다.' 
        });
    }
});

// JWT 로그아웃 (JWT + 세션 모두 처리)
router.post('/logout', (req, res) => {
    console.log('🔍 로그아웃 요청 처리 시작');
    
    // 1. JWT 토큰 쿠키를 즉시 만료시켜 삭제
    res.clearCookie('auth_token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        expires: new Date(0) // 즉시 만료
    });
    
    // 2. 세션 쿠키도 삭제
    res.clearCookie('ssen-coding-session', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        expires: new Date(0) // 즉시 만료
    });
    
    // 3. 세션도 함께 삭제 (Google OAuth 사용자 처리)
    if (req.session) {
        req.session.destroy((err) => {
            if (err) {
                console.error('세션 삭제 오류:', err);
            } else {
                console.log('✅ 세션 삭제 완료');
            }
        });
    }
    
    // 4. Passport 세션도 정리
    if (req.logout) {
        req.logout((err) => {
            if (err) {
                console.error('Passport 로그아웃 오류:', err);
            } else {
                console.log('✅ Passport 로그아웃 완료');
            }
        });
    }
    
    console.log('✅ 로그아웃 처리 완료');
    res.json({ 
        success: true, 
        message: '로그아웃되었습니다.' 
    });
});

// JWT 인증 확인 - 개선된 버전
router.get('/check', async (req, res) => {
    try {
        console.log('🔍 인증 상태 확인 요청');
        console.log('📋 쿠키 정보:', req.cookies);
        console.log('📋 세션 정보:', req.session);
        
        // 1. JWT 토큰 확인
        const token = req.cookies && req.cookies.auth_token;
        
        if (token) {
            console.log('🔍 JWT 토큰 발견, 검증 중...');
            const jwtConfig = require('../config/jwt');
            const decoded = jwtConfig.verifyToken(token);
            
            if (decoded) {
                console.log('✅ JWT 토큰 검증 성공');
                
                // 데이터베이스에서 최신 사용자 정보 조회
                const [users] = await pool.execute(
                    'SELECT id, username, email, is_admin FROM users WHERE id = ?',
                    [decoded.userId]
                );
                
                if (users.length > 0) {
                    const user = users[0];
                    console.log('✅ 사용자 정보 조회 성공:', user);
                    
                    return res.json({ 
                        success: true, 
                        isLoggedIn: true,
                        isAdmin: user.is_admin || false,
                        user: {
                            id: user.id,
                            username: user.username,
                            email: user.email,
                            is_admin: user.is_admin || false
                        }
                    });
                }
            } else {
                console.log('❌ JWT 토큰 검증 실패, 쿠키 삭제');
                res.clearCookie('auth_token');
            }
        }
        
        // 2. 세션 확인 (기존 세션 기반 인증)
        if (req.isAuthenticated() && req.user) {
            console.log('✅ 세션 기반 인증 성공:', req.user);
            return res.json({ 
                success: true, 
                isLoggedIn: true,
                isAdmin: req.user.is_admin || false,
                user: {
                    id: req.user.id,
                    username: req.user.username,
                    email: req.user.email,
                    is_admin: req.user.is_admin || false
                }
            });
        }
        
        // 3. 인증되지 않은 상태
        console.log('❌ 인증되지 않은 상태');
        res.json({ 
            success: true, 
            isLoggedIn: false,
            isAdmin: false,
            user: null
        });
        
    } catch (error) {
        console.error('❌ 인증 상태 확인 오류:', error);
        res.json({ 
            success: true, 
            isLoggedIn: false,
            isAdmin: false,
            user: null
        });
    }
});

// 비밀번호 변경
router.post('/change-password', requireAuth, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ 
                success: false, 
                message: '현재 비밀번호와 새 비밀번호를 입력해주세요.' 
            });
        }
        
        // 현재 사용자 정보 조회
        const [users] = await pool.execute(
            'SELECT password FROM users WHERE id = ?',
            [req.user.id]
        );
        
        if (users.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: '사용자를 찾을 수 없습니다.' 
            });
        }
        
        // 현재 비밀번호 검증
        const isValidPassword = await bcrypt.compare(currentPassword, users[0].password);
        if (!isValidPassword) {
            return res.status(400).json({ 
                success: false, 
                message: '현재 비밀번호가 올바르지 않습니다.' 
            });
        }
        
        // 새 비밀번호 해시화
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        
        // 비밀번호 업데이트
        await pool.execute(
            'UPDATE users SET password = ? WHERE id = ?',
            [hashedNewPassword, req.user.id]
        );
        
        res.json({ 
            success: true, 
            message: '비밀번호가 성공적으로 변경되었습니다.' 
        });
        
    } catch (error) {
        console.error('비밀번호 변경 오류:', error);
        res.status(500).json({ 
            success: false, 
            message: '서버 오류가 발생했습니다.' 
        });
    }
});

// 회원탈퇴
router.delete('/delete-account', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;

        // 사용자의 모든 데이터 삭제 (트랜잭션 사용)
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            // 사용자의 학습 진행상황 삭제
            await connection.execute(
                'DELETE FROM user_progress WHERE user_id = ?',
                [userId]
            );

            // 사용자 삭제
            await connection.execute(
                'DELETE FROM users WHERE id = ?',
                [userId]
            );

            await connection.commit();

            // JWT 쿠키 삭제
            res.clearCookie('auth_token');

            res.json({ 
                success: true, 
                message: '회원탈퇴가 완료되었습니다.' 
            });

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }

    } catch (error) {
        console.error('회원탈퇴 오류:', error);
        res.status(500).json({ 
            success: false, 
            message: '서버 오류가 발생했습니다.' 
        });
    }
});

module.exports = router; 