const nodemailer = require('nodemailer');

// 이메일 전송을 위한 설정
const transporter = nodemailer.createTransport({
    // Gmail SMTP 설정 (기본값)
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // TLS
    auth: {
        user: 'ssencoding@gmail.com',
        pass: 'nkms ivud jsuh grgd' // Gmail 앱 비밀번호 (16자리)
    }
});

// 다른 이메일 서비스 설정 예시 (주석 처리)
/*
// Outlook/Hotmail
const transporter = nodemailer.createTransport({
    host: 'smtp-mail.outlook.com',
    port: 587,
    secure: false,
    auth: {
        user: 'your-email@outlook.com',
        pass: 'your-password'
    }
});

// Yahoo
const transporter = nodemailer.createTransport({
    host: 'smtp.mail.yahoo.com',
    port: 587,
    secure: false,
    auth: {
        user: 'your-email@yahoo.com',
        pass: 'your-app-password'
    }
});

// Naver
const transporter = nodemailer.createTransport({
    host: 'smtp.naver.com',
    port: 587,
    secure: false,
    auth: {
        user: 'your-email@naver.com',
        pass: 'your-password'
    }
});

// Daum
const transporter = nodemailer.createTransport({
    host: 'smtp.daum.net',
    port: 465,
    secure: true,
    auth: {
        user: 'your-email@daum.net',
        pass: 'your-password'
    }
});
*/

// 이메일 인증 토큰 생성
const generateVerificationToken = () => {
    return require('crypto').randomBytes(32).toString('hex');
};

// 인증 이메일 전송
const sendVerificationEmail = async (email, token) => {
    // 환경에 따라 도메인 설정
    const baseUrl = process.env.NODE_ENV === 'production' 
        ? 'https://ssencoding.com' 
        : 'http://localhost:3001';
    const verificationUrl = `${baseUrl}/verify-email?token=${token}`;
    
    const mailOptions = {
        from: 'ssencoding@gmail.com',
        to: email,
        subject: 'SSEN CODING - 이메일 인증',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #00d4aa;">SSEN CODING 이메일 인증</h2>
                <p>안녕하세요! SSEN CODING 회원가입을 위한 이메일 인증입니다.</p>
                <p>아래 버튼을 클릭하여 이메일 인증을 완료해주세요:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${verificationUrl}" 
                       style="background-color: #00d4aa; color: white; padding: 12px 30px; 
                              text-decoration: none; border-radius: 5px; display: inline-block;">
                        이메일 인증하기
                    </a>
                </div>
                <p>또는 아래 링크를 복사하여 브라우저에 붙여넣기 하세요:</p>
                <p style="word-break: break-all; color: #666;">${verificationUrl}</p>
                <p>이 링크는 24시간 동안 유효합니다.</p>
                <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
                <p style="color: #666; font-size: 12px;">
                    이 이메일을 요청하지 않으셨다면 무시하셔도 됩니다.
                </p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        return true;
    } catch (error) {
        console.error('이메일 전송 오류:', error);
        return false;
    }
};

module.exports = {
    transporter,
    generateVerificationToken,
    sendVerificationEmail
}; 