# SSEN CODING - 코딩 문제 학습 사이트

4지 선다형 코딩 문제를 풀며 학습할 수 있는 웹 애플리케이션입니다.

## 주요 기능

- 📚 다양한 과목별 코딩 문제
- 🎯 4지 선다형 문제 풀이
- 📊 개인별 학습 진도 관리
- 👤 사용자 인증 및 프로필 관리
- 🔐 Google OAuth 로그인
- 📧 이메일 인증
- 👨‍💼 관리자 페이지 (문제 등록/수정/삭제)

## 기술 스택

- **Backend**: Node.js, Express.js
- **Database**: MySQL
- **Authentication**: Passport.js, Google OAuth
- **Frontend**: HTML, CSS, JavaScript
- **Email**: Nodemailer

## 설치 및 실행

### 1. 저장소 클론
```bash
git clone [repository-url]
cd ssen_coding
```

### 2. 의존성 설치
```bash
npm install
```

### 3. 환경변수 설정
```bash
cp env.example .env
# .env 파일을 편집하여 데이터베이스 정보 입력
```

### 4. 데이터베이스 설정
```bash
npm run setup-db
```

### 5. 관리자 계정 생성
```bash
npm run create-admin
```

### 6. 서버 실행
```bash
# 개발 모드
npm run dev

# 프로덕션 모드
npm start
```

## 환경변수

| 변수명 | 설명 | 기본값 |
|--------|------|--------|
| `DB_HOST` | 데이터베이스 호스트 | localhost |
| `DB_USER` | 데이터베이스 사용자 | root |
| `DB_PASSWORD` | 데이터베이스 비밀번호 | - |
| `DB_NAME` | 데이터베이스 이름 | coding_problems |
| `SESSION_SECRET` | 세션 시크릿 키 | - |
| `GOOGLE_CLIENT_ID` | Google OAuth 클라이언트 ID | - |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 클라이언트 시크릿 | - |
| `EMAIL_HOST` | 이메일 서버 호스트 | - |
| `EMAIL_USER` | 이메일 사용자 | - |
| `EMAIL_PASS` | 이메일 비밀번호 | - |
| `PORT` | 서버 포트 | 3001 |
| `NODE_ENV` | 환경 설정 | development |

## 배포

이 프로젝트는 Railway에서 배포할 수 있습니다.

1. GitHub에 코드 푸시
2. Railway 계정 생성
3. GitHub 저장소 연결
4. 환경변수 설정
5. MySQL 데이터베이스 추가
6. 배포 완료

## 라이선스

MIT License
