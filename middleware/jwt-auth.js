const jwtConfig = require('../config/jwt');
const { pool } = require('../config/database');

// JWT 토큰 검증 미들웨어
const authenticateJWT = async (req, res, next) => {
    try {
        // 쿠키에서 JWT 토큰 추출
        const token = req.cookies.auth_token;
        
        if (!token) {
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
            // 토큰이 유효하지 않으면 쿠키 삭제
            res.clearCookie('auth_token');
            return res.json({ 
                success: true, 
                isLoggedIn: false,
                isAdmin: false,
                user: null
            });
        }
        
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
        
        // req.user에 사용자 정보 설정 (기존 코드와 호환성 유지)
        req.user = user;
        
        res.json({ 
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
        const token = req.cookies.auth_token;
        
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

module.exports = {
    authenticateJWT,
    requireAuth
};
