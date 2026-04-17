// ================================================================
// auth.js - 인증 상태 관리
// ================================================================

window.currentUser = null;

// ── 페이지 즉시 숨김 (인증 전 콘텐츠 노출 방지) ──────────────
document.documentElement.style.visibility = 'hidden';

// ── 인증 확인 및 페이지 보호 ─────────────────────────────────
async function requireAuth() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    location.replace('login.html');
    return null;
  }

  const { data: user } = await sb.from('app_users')
    .select('*')
    .eq('email', session.user.email)
    .single();

  if (!user || !user.is_active) {
    await sb.auth.signOut();
    location.replace('login.html?error=inactive');
    return null;
  }

  window.currentUser = { ...user, session };
  // 인증 완료 → 페이지 표시
  document.documentElement.style.visibility = '';
  renderUserBadge();
  return window.currentUser;
}

// ── MASTER 전용 페이지 보호 ──────────────────────────────────
async function requireMaster() {
  const user = await requireAuth();
  if (!user) return null;
  if (user.role !== 'master') {
    document.documentElement.style.visibility = '';
    alert('MASTER 권한이 필요합니다.');
    location.replace('index.html');
    return null;
  }
  return user;
}

// ── 네비 우측 사용자 배지 ────────────────────────────────────
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
    <span style="font-size:12px;color:var(--text2)">${u.name||u.email}</span>
    ${u.role==='master'
      ? '<span style="font-size:10px;padding:2px 7px;border-radius:20px;background:#EDE9FE;color:#5B21B6;font-weight:600">MASTER</span>'
      : '<span style="font-size:10px;padding:2px 7px;border-radius:20px;background:var(--bg2);color:var(--text3);font-weight:600">USER</span>'
    }
    <button onclick="signOut()" style="font-size:11.5px;padding:4px 10px;border:1px solid var(--border2);border-radius:6px;cursor:pointer;background:none;color:var(--text2)">로그아웃</button>
  `;
}

// ── 로그아웃 ─────────────────────────────────────────────────
async function signOut() {
  await sb.auth.signOut();
  location.replace('login.html');
}

// ── MASTER 전용 UI 숨김 ───────────────────────────────────────
function applyRoleUI() {
  const u = window.currentUser;
  if (!u || u.role !== 'master') {
    document.querySelectorAll('[data-master-only]').forEach(el => {
      el.style.display = 'none';
    });
  }
}
