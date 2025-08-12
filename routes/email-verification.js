const express = require('express');
const { pool } = require('../config/database');
const { generateVerificationToken, sendVerificationEmail } = require('../config/email');
const bcrypt = require('bcrypt');

const router = express.Router();

// 이메일 인증 요청 (회원가입 시)
router.post('/request-verification', async (req, res) => {
    try {
        const { email, password } = req.body;

        // 입력 검증
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: '모든 필드를 입력해주세요.'
            });
        }

        // 이미 가입된 이메일인지 확인
        const [existingUsers] = await pool.execute(
            'SELECT id FROM users WHERE email = ?',
            [email]
        );

        if (existingUsers.length > 0) {
            return res.status(400).json({
                success: false,
                message: '이미 가입된 이메일입니다.'
            });
        }

        // 기존 인증 토큰이 있다면 삭제
        await pool.execute(
            'DELETE FROM email_verifications WHERE email = ?',
            [email]
        );

        // 새로운 인증 토큰 생성
        const token = generateVerificationToken();
        const hashedPassword = await bcrypt.hash(password, 10);

        // 인증 토큰 저장
        await pool.execute(
            'INSERT INTO email_verifications (email, token, password) VALUES (?, ?, ?)',
            [email, token, hashedPassword]
        );

        // 인증 이메일 전송
        const emailSent = await sendVerificationEmail(email, token);

        if (emailSent) {
            res.json({
                success: true,
                message: '인증 이메일이 전송되었습니다. 이메일을 확인해주세요.'
            });
        } else {
            res.status(500).json({
                success: false,
                message: '이메일 전송에 실패했습니다. 다시 시도해주세요.'
            });
        }

    } catch (error) {
        console.error('인증 요청 오류:', error);
        res.status(500).json({
            success: false,
            message: '서버 오류가 발생했습니다.'
        });
    }
});

// 이메일 인증 확인
router.get('/verify', async (req, res) => {
    try {
        const { token } = req.query;

        if (!token) {
            return res.status(400).json({
                success: false,
                message: '인증 토큰이 없습니다.'
            });
        }

        // 토큰으로 인증 정보 조회
        const [verifications] = await pool.execute(
            'SELECT * FROM email_verifications WHERE token = ? AND expires_at > NOW() AND is_verified = FALSE',
            [token]
        );

        if (verifications.length === 0) {
            return res.status(400).json({
                success: false,
                message: '유효하지 않거나 만료된 인증 토큰입니다.'
            });
        }

        const verification = verifications[0];

        // 사용자 생성 (사용자명은 이메일에서 추출하고 중복 처리)
        let username = verification.email.split('@')[0];
        
        // 사용자명 중복 확인 및 처리
        let counter = 1;
        let finalUsername = username;
        
        while (true) {
            const [existingUsers] = await pool.execute(
                'SELECT id FROM users WHERE username = ?',
                [finalUsername]
            );
            
            if (existingUsers.length === 0) {
                break; // 중복되지 않는 사용자명을 찾음
            }
            
            // 중복되는 경우 숫자를 붙여서 새로운 사용자명 생성
            finalUsername = `${username}${counter}`;
            counter++;
        }
        
        const [result] = await pool.execute(
            'INSERT INTO users (username, email, password, email_verified, created_at) VALUES (?, ?, ?, TRUE, NOW())',
            [finalUsername, verification.email, verification.password]
        );

        // 인증 완료 표시
        await pool.execute(
            'UPDATE email_verifications SET is_verified = TRUE WHERE id = ?',
            [verification.id]
        );

        res.json({
            success: true,
            message: '이메일 인증이 완료되었습니다. 로그인해주세요.'
        });

    } catch (error) {
        console.error('이메일 인증 오류:', error);
        res.status(500).json({
            success: false,
            message: '서버 오류가 발생했습니다.'
        });
    }
});

// 인증 재전송
router.post('/resend', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: '이메일을 입력해주세요.'
            });
        }

        // 기존 인증 정보 조회
        const [verifications] = await pool.execute(
            'SELECT * FROM email_verifications WHERE email = ? AND expires_at > NOW() AND is_verified = FALSE',
            [email]
        );

        if (verifications.length === 0) {
            return res.status(400).json({
                success: false,
                message: '인증 정보를 찾을 수 없습니다.'
            });
        }

        const verification = verifications[0];

        // 새로운 토큰 생성
        const newToken = generateVerificationToken();

        // 토큰 업데이트
        await pool.execute(
            'UPDATE email_verifications SET token = ?, expires_at = (NOW() + INTERVAL 24 HOUR) WHERE id = ?',
            [newToken, verification.id]
        );

        // 인증 이메일 재전송
        const emailSent = await sendVerificationEmail(email, newToken);

        if (emailSent) {
            res.json({
                success: true,
                message: '인증 이메일이 재전송되었습니다.'
            });
        } else {
            res.status(500).json({
                success: false,
                message: '이메일 전송에 실패했습니다.'
            });
        }

    } catch (error) {
        console.error('인증 재전송 오류:', error);
        res.status(500).json({
            success: false,
            message: '서버 오류가 발생했습니다.'
        });
    }
});

module.exports = router; 