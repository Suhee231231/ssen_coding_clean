// 공통 JavaScript 함수들

// 인증 상태 캐싱 변수
let authStatus = null;
let lastAuthCheck = 0;
const AUTH_CACHE_DURATION = 30 * 60 * 1000; // 30분 캐시 (rate limit 절약)

// 인증 상태 확인 (최적화된 버전)
async function checkAuthStatus() {
    const now = Date.now();
    
    // URL에서 로그인 성공 파라미터 확인
    const urlParams = new URLSearchParams(window.location.search);
    const loginStatus = urlParams.get('login');
    
    // 로그인 성공이면 캐시 초기화
    if (loginStatus === 'success') {
        sessionStorage.removeItem('authStatus');
        sessionStorage.removeItem('authCheckTime');
        authStatus = null;
        lastAuthCheck = 0;
    }
    
    // 세션 스토리지에서 인증 상태 확인
    const sessionAuth = sessionStorage.getItem('authStatus');
    const sessionTime = sessionStorage.getItem('authCheckTime');
    
    if (sessionAuth && sessionTime && (now - parseInt(sessionTime)) < AUTH_CACHE_DURATION) {
        // 세션에 유효한 인증 상태가 있으면 사용
        authStatus = JSON.parse(sessionAuth);
        lastAuthCheck = parseInt(sessionTime);
        updateNavigation(authStatus);
        return authStatus;
    }
    
    // 메모리 캐시 확인
    if (authStatus && (now - lastAuthCheck) < AUTH_CACHE_DURATION) {
        updateNavigation(authStatus);
        return authStatus;
    }
    
    // 실제 API 호출
    try {
        console.log('인증 상태 확인 중...');
        const response = await fetch('/api/auth/check');
        const data = await response.json();
        
        console.log('인증 상태 응답:', data);
        
        authStatus = data;
        lastAuthCheck = now;
        
        // 세션 스토리지에 저장
        sessionStorage.setItem('authStatus', JSON.stringify(authStatus));
        sessionStorage.setItem('authCheckTime', now.toString());
        
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
            sessionStorage.removeItem('authStatus');
            sessionStorage.removeItem('authCheckTime');
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
