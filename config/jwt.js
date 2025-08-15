const jwt = require('jsonwebtoken');

module.exports = {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
    options: {
        expiresIn: '7d', // 7일
        issuer: 'ssen-coding',
        audience: 'ssen-coding-users'
    },
    
    // JWT 토큰 생성
    generateToken: (payload) => {
        return jwt.sign(payload, module.exports.secret, module.exports.options);
    },
    
    // JWT 토큰 검증
    verifyToken: (token) => {
        try {
            return jwt.verify(token, module.exports.secret);
        } catch (error) {
            return null;
        }
    }
};
