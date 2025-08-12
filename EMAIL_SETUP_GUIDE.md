# 이메일 설정 가이드

## 현재 설정
- **기본 이메일 서비스**: Gmail
- **SMTP 서버**: smtp.gmail.com
- **포트**: 587
- **보안**: TLS

## Gmail 설정 방법

### 1. Gmail 2단계 인증 활성화
1. Gmail 계정 설정 → 보안
2. "2단계 인증" 활성화

### 2. 앱 비밀번호 생성
1. Gmail 계정 설정 → 보안 → 앱 비밀번호
2. "앱 선택" → "기타"
3. 앱 이름 입력 (예: "SSEN CODING")
4. 생성된 16자리 비밀번호 복사

### 3. 설정 파일 업데이트
`config/email.js` 파일에서:
```javascript
auth: {
    user: 'ssencoding@gmail.com',
    pass: '생성된-앱-비밀번호' // 여기에 앱 비밀번호 입력
}
```

## 다른 이메일 서비스 설정

### Outlook/Hotmail
```javascript
host: 'smtp-mail.outlook.com',
port: 587,
secure: false,
auth: {
    user: 'your-email@outlook.com',
    pass: 'your-password'
}
```

### Yahoo
```javascript
host: 'smtp.mail.yahoo.com',
port: 587,
secure: false,
auth: {
    user: 'your-email@yahoo.com',
    pass: 'your-app-password'
}
```

### Naver
```javascript
host: 'smtp.naver.com',
port: 587,
secure: false,
auth: {
    user: 'your-email@naver.com',
    pass: 'your-password'
}
```

### Daum
```javascript
host: 'smtp.daum.net',
port: 465,
secure: true,
auth: {
    user: 'your-email@daum.net',
    pass: 'your-password'
}
```

## 설정 변경 후
1. `config/email.js` 파일에서 원하는 이메일 서비스 설정으로 변경
2. 서버 재시작: `node server.js`
3. 회원가입 테스트

## 주의사항
- Gmail, Yahoo는 앱 비밀번호 필요
- Outlook, Naver, Daum은 일반 비밀번호 사용
- 보안을 위해 실제 운영환경에서는 환경 변수 사용 권장 