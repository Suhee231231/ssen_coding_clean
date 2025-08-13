// 공통 JavaScript 함수들
// 인증 상태 확인
async function checkAuthStatus() {
    try {
        const response = await fetch('/api/auth/check');
        const data = await response.json();
        
        const navLinks = document.getElementById('navLinks');
        if (navLinks) {
            if (data.authenticated) {
                navLinks.innerHTML = `
                    <a href="/">홈</a>
                    <a href="/problems.html">문제 풀기</a>
                    <a href="/profile.html">내 학습</a>
                    <a href="/wrong-problems.html">틀린 문제</a>
                    <a href="#" onclick="logout()">로그아웃</a>
                `;
            } else {
                navLinks.innerHTML = `
                    <a href="/">홈</a>
                    <a href="/login.html">로그인</a>
                    <a href="/register.html">회원가입</a>
                `;
            }
        }
    } catch (error) {
        console.error('인증 상태 확인 오류:', error);
    }
}

// 로그아웃
async function logout() {
    try {
        const response = await fetch('/api/auth/logout', {
            method: 'POST'
        });
        const data = await response.json();
        
        if (data.success) {
            window.location.href = '/';
        }
    } catch (error) {
        console.error('로그아웃 오류:', error);
    }
}

// 로딩 상태 표시
function showLoading(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = '로딩중...';
        element.classList.add('loading');
    }
}

// 로딩 상태 제거
function hideLoading(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.classList.remove('loading');
    }
}

// 에러 처리
function handleError(error, elementId, defaultValue = '0') {
    console.error('오류 발생:', error);
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = defaultValue;
    }
}
