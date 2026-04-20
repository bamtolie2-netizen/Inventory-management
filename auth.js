// ================================================================
// auth.js - 인증 상태 관리 (간소화 버전)
// ================================================================

window.currentUser = null;

// 페이지 즉시 숨김
document.documentElement.style.visibility = 'hidden';

// 안전장치: 2초 후 강제 표시
const _authTimeout = setTimeout(() => {
  document.documentElement.style.visibility = '';
}, 2000);

async function requireAuth() {
  try {
    const { data: { session } } = await sb.auth.getSession();
    clearTimeout(_authTimeout);
    if (!session) {
      location.replace('login.html');
      return null;
    }
    // app_users 체크 없이 세션만으로 통과
    window.currentUser = {
      email: session.user.email,
      name:  session.user.email.split('@')[0],
      role:  'master',
      is_active: true,
      session
    };
    document.documentElement.style.visibility = '';
    renderUserBadge();
    return window.currentUser;
  } catch(e) {
    clearTimeout(_authTimeout);
    document.documentElement.style.visibility = '';
    return null;
  }
}

async function requireMaster() {
  return await requireAuth();
}

function renderUserBadge() {
  const u = window.currentUser;
  if (!u) return;
  const right = document.querySelector('.topbar-right');
  if (!right) return;
  let badge = document.getElementById('user-badge');
  if (!badge) {
    badge = document.createElement('div');
    badge.id = 'user-badge';
    badge.style.cssText = 'display:flex;align-items:center;gap:8px';
    right.insertBefore(badge, right.firstChild);
  }
  badge.innerHTML = `
    <span style="font-size:12px;color:var(--text2)">${u.name}</span>
    <button onclick="signOut()" style="font-size:11.5px;padding:4px 10px;border:1px solid var(--border2);border-radius:6px;cursor:pointer;background:none;color:var(--text2)">로그아웃</button>
  `;
}

async function signOut() {
  await sb.auth.signOut();
  location.replace('login.html');
}

function applyRoleUI() {}
