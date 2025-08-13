// 공통 JavaScript 함수들
// 인증 상태 확인
async function checkAuthStatus() {
    try {
        const response = await fetch('/api/auth/check');
        const data = await response.json();
        
        const navLinks = document.getElementById('navLinks');
        if (navLinks) {
            if (data.isLoggedIn) {
                let navHTML = `<a href="/profile.html">내 학습</a>`;
                if (data.isAdmin) {
                    navHTML += `<a href="/admin.html">관리자</a>`;
                }
                navHTML += `<a href="#" onclick="logout()">로그아웃</a>`;
                navLinks.innerHTML = navHTML;
            } else {
                navLinks.innerHTML = `
                    <a href="#" onclick="showLoginPrompt()">내 학습</a>
                    <a href="/login.html" title="학습 진행상황을 저장하고 틀린 문제들만 다시 풀어볼 수 있습니다.">로그인</a>
                    <a href="/register.html" title="학습 진행상황을 저장하고 틀린 문제들만 다시 풀어볼 수 있습니다.">회원가입</a>
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

// 로그인 안내 메시지 표시
function showLoginPrompt() {
    if (confirm('로그인 시 이용 가능합니다.\n진행상황 저장 및 틀린 문제 다시풀기 등이 가능합니다.\n\n로그인 페이지로 이동하시겠습니까?')) {
        window.location.href = '/login.html';
    }
}
