// 공통 JavaScript 함수들

// 인증 상태 캐싱 변수
let authStatus = null;
let lastAuthCheck = 0;
const AUTH_CACHE_DURATION = 30 * 60 * 1000; // 30분 캐시 (rate limit 절약)

// 페이지 로드 시 인증 상태 확인
document.addEventListener('DOMContentLoaded', async () => {
    console.log('페이지 로드 - 인증 상태 확인 시작');
    
    // 일반적인 인증 상태 확인
    await checkAuthStatus();
});

// 인증 상태 확인 (최적화된 버전)
async function checkAuthStatus() {
    const now = Date.now();
    
    // URL에서 로그인 성공 파라미터 확인
    const urlParams = new URLSearchParams(window.location.search);
    const loginStatus = urlParams.get('login');
    const authType = urlParams.get('auth');
    
    // 로그아웃/회원탈퇴 후 페이지 새로고침 감지 (현재 탭에서만)
    const logoutRefreshTime = sessionStorage.getItem('logoutRefresh');
    if (logoutRefreshTime) {
        const logoutTime = parseInt(logoutRefreshTime);
        const now = Date.now();
        
        // 5분 이내의 로그아웃/회원탈퇴 새로고침만 처리 (안전장치)
        if (now - logoutTime < 5 * 60 * 1000) {
            console.log('🔍 로그아웃/회원탈퇴 후 새로고침 감지 - 인증 캐시 초기화');
            sessionStorage.removeItem('logoutRefresh');
            sessionStorage.removeItem('authStatus');
            sessionStorage.removeItem('authCheckTime');
            localStorage.removeItem('authStatus');
            localStorage.removeItem('authCheckTime');
            authStatus = null;
            lastAuthCheck = 0;
            
            // 즉시 로그아웃 상태로 네비게이션 업데이트
            updateNavigation({ isLoggedIn: false, isAdmin: false, user: null });
        } else {
            // 오래된 플래그는 제거
            sessionStorage.removeItem('logoutRefresh');
        }
    }
    
    // 로그인 성공이면 캐시 초기화하고 즉시 인증 상태 확인
    if (loginStatus === 'success') {
        // 모든 캐시 초기화
        sessionStorage.removeItem('authStatus');
        sessionStorage.removeItem('authCheckTime');
        localStorage.removeItem('authStatus');
        localStorage.removeItem('authCheckTime');
        authStatus = null;
        lastAuthCheck = 0;
        console.log('로그인 성공 - 모든 인증 캐시 초기화됨');
        
        // URL에서 파라미터 제거 (브라우저 히스토리 정리)
        const newUrl = new URL(window.location);
        newUrl.searchParams.delete('login');
        newUrl.searchParams.delete('auth');
        window.history.replaceState({}, '', newUrl);
        
        // 즉시 인증 상태 확인 (캐시 무시)
        try {
            console.log('로그인 후 즉시 인증 상태 확인 중...');
            const response = await fetch('/api/auth/check', {
                method: 'GET',
                credentials: 'include', // 쿠키 포함
                headers: {
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            });
            
            if (!response.ok) {
                console.error('로그인 후 인증 상태 확인 실패:', response.status, response.statusText);
                authStatus = { isLoggedIn: false, isAdmin: false, user: null };
                lastAuthCheck = Date.now();
                updateNavigation(authStatus);
                return authStatus;
            }
            
            const data = await response.json();
            
            console.log('로그인 후 인증 상태 응답:', data);
            
            authStatus = data;
            lastAuthCheck = Date.now();
            
            // 세션 스토리지에 저장
            sessionStorage.setItem('authStatus', JSON.stringify(authStatus));
            sessionStorage.setItem('authCheckTime', lastAuthCheck.toString());
            
            updateNavigation(authStatus);
            
            // Google OAuth인 경우 추가 확인
            if (authType === 'google' && data.isLoggedIn) {
                console.log('Google OAuth 로그인 성공 - 네비게이션 업데이트 완료');
            }
            
            // 로그인 성공 후 홈페이지로 리다이렉트 (상태 완전 초기화)
            console.log('로그인 성공 - 홈페이지로 리다이렉트');
            window.location.href = '/';
            
            return authStatus;
        } catch (error) {
            console.error('로그인 후 인증 상태 확인 오류:', error);
            authStatus = { isLoggedIn: false, isAdmin: false, user: null };
            lastAuthCheck = Date.now();
            updateNavigation(authStatus);
            return authStatus;
        }
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
        const response = await fetch('/api/auth/check', {
            method: 'GET',
            credentials: 'include', // 쿠키 포함
            headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            }
        });
        
        if (!response.ok) {
            console.error('인증 상태 확인 실패:', response.status, response.statusText);
            // 응답이 실패하면 로그아웃 상태로 처리
            authStatus = { isLoggedIn: false, isAdmin: false, user: null };
            lastAuthCheck = now;
            updateNavigation(authStatus);
            return authStatus;
        }
        
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
        // 오류 발생 시 로그아웃 상태로 처리
        authStatus = { isLoggedIn: false, isAdmin: false, user: null };
        lastAuthCheck = now;
        updateNavigation(authStatus);
        return authStatus;
    }
}

// 네비게이션 업데이트 함수
function updateNavigation(data) {
    const navLinks = document.getElementById('navLinks');
    if (navLinks) {
        if (data && data.isLoggedIn) {
            let navHTML = `<a href="/">홈</a><a href="/profile.html">내 학습</a>`;
            if (data.isAdmin) {
                navHTML += `<a href="/admin.html">관리자</a>`;
            }
            navHTML += `<a href="#" onclick="logout()">로그아웃</a>`;
            navLinks.innerHTML = navHTML;
        } else {
            navLinks.innerHTML = `
                <a href="/">홈</a>
                <a href="#" onclick="showLoginPrompt()">내 학습</a>
                <a href="/login.html" title="학습 진행상황을 저장하고 틀린 문제들만 다시 풀어볼 수 있습니다.">로그인</a>
                <a href="/register.html" title="학습 진행상황을 저장하고 틀린 문제들만 다시 풀어볼 수 있습니다.">회원가입</a>
            `;
        }
    } else {
        console.warn('navLinks 요소를 찾을 수 없습니다. 현재 페이지:', window.location.pathname);
    }
}

// 로그아웃 (캐시 초기화 포함)
async function logout() {
    try {

        
        // 1. 먼저 모든 캐시 초기화
        authStatus = null;
        lastAuthCheck = 0;
        sessionStorage.removeItem('authStatus');
        sessionStorage.removeItem('authCheckTime');
        localStorage.removeItem('authStatus');
        localStorage.removeItem('authCheckTime');
        
        // 2. 인증 관련 캐시만 정리 (다른 탭 데이터 보호)
        // sessionStorage와 localStorage에서 인증 관련 항목만 삭제
        const authKeys = ['authStatus', 'authCheckTime', 'logoutRefresh'];
        authKeys.forEach(key => {
            sessionStorage.removeItem(key);
            localStorage.removeItem(key);
        });
        
        // 3. 네비게이션 즉시 업데이트 (로그아웃 상태로)
        updateNavigation({ isLoggedIn: false, isAdmin: false, user: null });
        
        // 4. 서버에 로그아웃 요청
        const response = await fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'include', // 쿠키 포함
            headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            }
        });
        const data = await response.json();
        

        
        if (data.success) {

            
            // 5. 현재 탭에서만 로그아웃 후 새로고침 플래그 설정
            sessionStorage.setItem('logoutRefresh', Date.now().toString());
            
            // 6. 강제로 페이지 새로고침하여 모든 상태 초기화
            window.location.replace('/');
        } else {

            // 실패해도 홈페이지로 이동
            sessionStorage.setItem('logoutRefresh', Date.now().toString());
            window.location.replace('/');
        }
    } catch (error) {

        // 오류가 발생해도 홈페이지로 이동
        window.location.replace('/');
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
