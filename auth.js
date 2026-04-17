// ================================================================
// auth.js - 인증 상태 관리
// 모든 페이지에서 supabase.js 다음에 로드
// ================================================================

// 현재 로그인 사용자 정보 (전역)
window.currentUser = null;

// ── 인증 확인 및 페이지 보호 ─────────────────────────────────
async function requireAuth() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    location.href = 'login.html';
    return null;
  }
  // app_users에서 역할 조회
  const { data: user } = await sb.from('app_users')
    .select('*')
    .eq('email', session.user.email)
    .single();

  if (!user || !user.is_active) {
    await sb.auth.signOut();
    location.href = 'login.html?error=inactive';
    return null;
  }

  window.currentUser = { ...user, session };
  renderUserBadge();
  return window.currentUser;
}

// ── MASTER 전용 페이지 보호 ──────────────────────────────────
async function requireMaster() {
  const user = await requireAuth();
  if (!user) return null;
  if (user.role !== 'master') {
    alert('MASTER 권한이 필요합니다.');
    location.href = 'index.html';
    return null;
  }
  return user;
}

// ── 네비 우측에 사용자 배지 표시 ────────────────────────────
function renderUserBadge() {
  const u = window.currentUser;
  if (!u) return;
  const right = document.querySelector('.topbar-right');
  if (!right) return;

  // 이미 있으면 업데이트
  let badge = document.getElementById('user-badge');
  if (!badge) {
    badge = document.createElement('div');
    badge.id = 'user-badge';
    badge.style.cssText = 'display:flex;align-items:center;gap:8px';
    right.insertBefore(badge, right.firstChild);
  }

  badge.innerHTML = `
    <span style="font-size:12px;color:var(--text2)">${u.name||u.email}</span>
    ${u.role==='master'
      ? '<span style="font-size:10px;padding:2px 7px;border-radius:20px;background:#EDE9FE;color:#5B21B6;font-weight:600">MASTER</span>'
      : '<span style="font-size:10px;padding:2px 7px;border-radius:20px;background:var(--bg2);color:var(--text3);font-weight:600">USER</span>'
    }
    <button onclick="signOut()" style="font-size:11.5px;padding:4px 10px;border:1px solid var(--border2);border-radius:6px;cursor:pointer;background:none;color:var(--text2)">로그아웃</button>
  `;
}

// ── 로그아웃 ──────────────────────────────────────────────────
async function signOut() {
  await sb.auth.signOut();
  location.href = 'login.html';
}

// ── MASTER 전용 UI 요소 숨기기 (role=user 일 때) ─────────────
function applyRoleUI() {
  const u = window.currentUser;
  if (!u) return;
  if (u.role !== 'master') {
    // master 전용 요소 숨김
    document.querySelectorAll('[data-master-only]').forEach(el => {
      el.style.display = 'none';
    });
  }
}
