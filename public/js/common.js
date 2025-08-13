// 공통 JavaScript 함수들

// 인증 상태 캐싱 변수
let authStatus = null;
let lastAuthCheck = 0;
const AUTH_CACHE_DURATION = 5 * 60 * 1000; // 5분 캐시

// 인증 상태 확인 (최적화된 버전)
async function checkAuthStatus() {
    const now = Date.now();
    
    // 캐시된 상태가 있고 5분 이내면 캐시 사용
    if (authStatus && (now - lastAuthCheck) < AUTH_CACHE_DURATION) {
        updateNavigation(authStatus);
        return authStatus;
    }
    
    // 실제 API 호출
    try {
        const response = await fetch('/api/auth/check');
        authStatus = await response.json();
        lastAuthCheck = now;
        updateNavigation(authStatus);
        return authStatus;
    } catch (error) {
        console.error('인증 상태 확인 오류:', error);
        return null;
    }
}

// 네비게이션 업데이트 함수
function updateNavigation(data) {
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
}

// 로그아웃 (캐시 초기화 포함)
async function logout() {
    try {
        const response = await fetch('/api/auth/logout', {
            method: 'POST'
        });
        const data = await response.json();
        
        if (data.success) {
            // 인증 캐시 초기화
            authStatus = null;
            lastAuthCheck = 0;
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
