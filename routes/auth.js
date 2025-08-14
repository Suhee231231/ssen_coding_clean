const express = require('express');
const bcrypt = require('bcrypt');
const { pool } = require('../config/database');

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

        // Passport 세션에 사용자 정보 저장
        req.login(user, (err) => {
            if (err) {
                return res.status(500).json({ 
                    success: false, 
                    message: '로그인 중 오류가 발생했습니다.' 
                });
            }
            
            // 세션을 명시적으로 저장
            req.session.save((saveErr) => {
                if (saveErr) {
                    console.error('세션 저장 오류:', saveErr);
                    return res.status(500).json({ 
                        success: false, 
                        message: '세션 저장 중 오류가 발생했습니다.' 
                    });
                }
                
                console.log('로그인 성공 - 사용자 ID:', user.id, '세션 ID:', req.sessionID);
                
                res.json({ 
                    success: true, 
                    message: '로그인 성공',
                    user: {
                        id: user.id,
                        username: user.username,
                        is_admin: user.is_admin
                    }
                });
            });
        });

    } catch (error) {
        console.error('로그인 오류:', error);
        res.status(500).json({ 
            success: false, 
            message: '서버 오류가 발생했습니다.' 
        });
    }
});

// 로그아웃
router.post('/logout', (req, res) => {
    req.logout((err) => {
        if (err) {
            return res.status(500).json({ 
                success: false, 
                message: '로그아웃 중 오류가 발생했습니다.' 
            });
        }
        res.json({ 
            success: true, 
            message: '로그아웃되었습니다.' 
        });
    });
});

// 세션 확인 (성능 최적화)
router.get('/check', (req, res) => {
    if (req.isAuthenticated()) {
        res.json({ 
            success: true, 
            isLoggedIn: true,
            isAdmin: req.user.is_admin || false,
            user: {
                id: req.user.id,
                username: req.user.username,
                is_admin: req.user.is_admin || false
            }
        });
    } else {
        res.json({ 
            success: true, 
            isLoggedIn: false,
            isAdmin: false
        });
    }
});

// 비밀번호 변경
router.post('/change-password', async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        
        if (!req.isAuthenticated()) {
            return res.status(401).json({ 
                success: false, 
                message: '로그인이 필요합니다.' 
            });
        }
        
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
router.delete('/delete-account', async (req, res) => {
    try {
        if (!req.isAuthenticated()) {
            return res.status(401).json({ 
                success: false, 
                message: '로그인이 필요합니다.' 
            });
        }

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

            // 세션 삭제
            req.logout((err) => {
                if (err) {
                    console.error('로그아웃 오류:', err);
                }
            });

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