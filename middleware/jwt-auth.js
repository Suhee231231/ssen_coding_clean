const jwtConfig = require('../config/jwt');
const { pool } = require('../config/database');

// JWT 토큰 검증 미들웨어
const authenticateJWT = async (req, res, next) => {
    try {
        console.log('🔍 JWT 인증 요청');
        console.log('📋 쿠키 정보:', req.cookies);
        
        // 쿠키에서 JWT 토큰 추출 (안전장치 추가)
        const token = req.cookies && req.cookies.auth_token;
        
        if (!token) {
            console.log('❌ JWT 토큰 없음');
            return res.json({ 
                success: true, 
                isLoggedIn: false,
                isAdmin: false,
                user: null
            });
        }
        
        // JWT 토큰 검증
        const decoded = jwtConfig.verifyToken(token);
        
        if (!decoded) {
            console.log('❌ JWT 토큰 검증 실패');
            // 토큰이 유효하지 않으면 쿠키 삭제
            res.clearCookie('auth_token');
            return res.json({ 
                success: true, 
                isLoggedIn: false,
                isAdmin: false,
                user: null
            });
        }
        
        console.log('✅ JWT 토큰 검증 성공:', decoded);
        
        // 데이터베이스에서 최신 사용자 정보 조회
        const [users] = await pool.execute(
            'SELECT id, username, email, is_admin FROM users WHERE id = ?',
            [decoded.userId]
        );
        
        if (users.length === 0) {
            // 사용자가 존재하지 않으면 쿠키 삭제
            res.clearCookie('auth_token');
            return res.json({ 
                success: true, 
                isLoggedIn: false,
                isAdmin: false,
                user: null
            });
        }
        
        const user = users[0];
        
        console.log('✅ 사용자 정보 조회 성공:', user);
        
        // req.user에 사용자 정보 설정 (기존 코드와 호환성 유지)
        req.user = user;
        
        const response = { 
            success: true, 
            isLoggedIn: true,
            isAdmin: user.is_admin || false,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                is_admin: user.is_admin || false
            }
        };
        
        console.log('📤 응답 데이터:', response);
        res.json(response);
        
    } catch (error) {
        console.error('JWT 인증 오류:', error);
        res.json({ 
            success: true, 
            isLoggedIn: false,
            isAdmin: false,
            user: null
        });
    }
};

// JWT 토큰 검증 (API 보호용)
const requireAuth = async (req, res, next) => {
    try {
        const token = req.cookies && req.cookies.auth_token;
        
        if (!token) {
            return res.status(401).json({ 
                success: false, 
                message: '인증이 필요합니다.' 
            });
        }
        
        const decoded = jwtConfig.verifyToken(token);
        
        if (!decoded) {
            res.clearCookie('auth_token');
            return res.status(401).json({ 
                success: false, 
                message: '유효하지 않은 토큰입니다.' 
            });
        }
        
        // 데이터베이스에서 사용자 정보 조회
        const [users] = await pool.execute(
            'SELECT id, username, email, is_admin FROM users WHERE id = ?',
            [decoded.userId]
        );
        
        if (users.length === 0) {
            res.clearCookie('auth_token');
            return res.status(401).json({ 
                success: false, 
                message: '사용자를 찾을 수 없습니다.' 
            });
        }
        
        req.user = users[0];
        next();
        
    } catch (error) {
        console.error('JWT 인증 오류:', error);
        res.status(401).json({ 
            success: false, 
            message: '인증 오류가 발생했습니다.' 
        });
    }
};

// JWT 토큰 선택적 검증 (토큰이 있으면 사용자 정보 설정, 없으면 익명)
const optionalAuth = async (req, res, next) => {
    try {
        const token = req.cookies && req.cookies.auth_token;
        
        if (!token) {
            // 토큰이 없으면 익명 사용자로 처리
            req.user = null;
            return next();
        }
        
        const decoded = jwtConfig.verifyToken(token);
        
        if (!decoded) {
            // 토큰이 유효하지 않으면 쿠키 삭제하고 익명 사용자로 처리
            res.clearCookie('auth_token');
            req.user = null;
            return next();
        }
        
        // 데이터베이스에서 사용자 정보 조회
        const [users] = await pool.execute(
            'SELECT id, username, email, is_admin FROM users WHERE id = ?',
            [decoded.userId]
        );
        
        if (users.length === 0) {
            // 사용자가 존재하지 않으면 쿠키 삭제하고 익명 사용자로 처리
            res.clearCookie('auth_token');
            req.user = null;
            return next();
        }
        
        req.user = users[0];
        next();
        
    } catch (error) {
        console.error('JWT 선택적 인증 오류:', error);
        req.user = null;
        next();
    }
};

module.exports = {
    authenticateJWT,
    requireAuth,
    optionalAuth
};
