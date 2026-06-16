/* ═══════════════════════════════════════
   KEFFIROOMS — AUTH.JS
   All authentication logic
═══════════════════════════════════════ */

// ── SESSION STATE ──
const SESSION = {
  current: null,
};

function setSession(data) {
  SESSION.current = data;
  if (data) sessionStorage.setItem('kr6_session', JSON.stringify(data));
  else sessionStorage.removeItem('kr6_session');
}

function getSession() {
  if (SESSION.current) return SESSION.current;
  const stored = sessionStorage.getItem('kr6_session');
  if (stored) { SESSION.current = JSON.parse(stored); return SESSION.current; }
  return null;
}

function clearSession() {
  SESSION.current = null;
  sessionStorage.removeItem('kr6_session');
}

// ── PIN HELPERS ──
function pinNext(el, idx, groupId) {
  if (el.value && idx < 5) {
    const row = document.getElementById(groupId);
    if (row) {
      const pins = row.querySelectorAll('.pb');
      if (pins[idx + 1]) pins[idx + 1].focus();
    }
  }
}

function getPin(groupId) {
  const row = document.getElementById(groupId);
  if (!row) return '';
  return Array.from(row.querySelectorAll('.pb')).map(i => i.value).join('');
}

function clearPin(groupId) {
  const row = document.getElementById(groupId);
  if (row) row.querySelectorAll('.pb').forEach(i => i.value = '');
}

// ── PAGE NAVIGATION WITH TRANSITIONS ──
function goPage(url) {
  document.body.style.animation = 'pageOut 200ms ease both';
  setTimeout(() => { window.location.href = url; }, 180);
}

// ── RIPPLE EFFECT ──
function addRipple(el, event) {
  const ripple = document.createElement('span');
  const rect = el.getBoundingClientRect();
  const x = event ? event.clientX - rect.left : rect.width / 2;
  const y = event ? event.clientY - rect.top  : rect.height / 2;
  ripple.style.cssText = `
    position:absolute; border-radius:50%;
    background:rgba(255,255,255,.14);
    width:200px; height:200px;
    margin-left:-100px; margin-top:-100px;
    left:${x}px; top:${y}px;
    animation:ripple 500ms ease-out both;
    pointer-events:none; z-index:0;
  `;
  el.style.position = 'relative';
  el.style.overflow = 'hidden';
  el.appendChild(ripple);
  setTimeout(() => ripple.remove(), 520);
}

// ── SEEKER AUTH ──
function seekerGoogleLogin() {
  setSession({ role:'seeker', name:'Seeker', phone:'', loggedIn:true, via:'google' });
  goPage('seeker.html');
}

function seekerPhoneLogin() {
  const phone = document.getElementById('sk-phone')?.value.trim();
  if (!phone) { showToast('Enter your phone number'); return; }
  if (!DB.seekers.find(s => s.phone === phone)) {
    DB.seekers.push({ phone, at: Date.now() });
    saveDB();
  }
  setSession({ role:'seeker', name:'Seeker', phone, loggedIn:true, via:'phone' });
  goPage('seeker.html');
}

function seekerGuest() {
  setSession({ role:'seeker', name:'Guest', phone:'', loggedIn:false, via:'guest' });
  goPage('seeker.html');
}

// ── AGENT AUTH ──
function agentLogin() {
  const phone = document.getElementById('ag-phone')?.value.trim();
  const pin   = getPin('pin-ag');
  if (!phone || pin.length < 6) { showToast('Enter phone and PIN'); return; }
  const agent = DB.agents.find(a => a.phone === phone && a.pin === pin);
  if (!agent) { showToast('Invalid credentials'); clearPin('pin-ag'); return; }
  if (agent.status === 'pending') { showToast('Awaiting admin approval'); return; }
  if (agent.status === 'denied')  { showToast('Access denied by admin'); return; }
  setSession({ role:'agent', name:agent.name, phone:agent.phone, isAdmin:agent.isAdmin||false });
  clearPin('pin-ag');
  if (agent.isAdmin) goPage('admin.html');
  else               goPage('agent.html');
}

function agentRegister() {
  const name  = document.getElementById('rg-name')?.value.trim();
  const phone = document.getElementById('rg-phone')?.value.trim();
  const pin   = getPin('pin-rg');
  if (!name || !phone || pin.length < 6) { showToast('Fill all fields and set PIN'); return; }
  if (DB.agents.find(a => a.phone === phone)) { showToast('Phone already registered'); return; }
  DB.agents.push({ id:'AG'+Date.now(), name, phone, pin, status:'pending', isAdmin:false, at:Date.now() });
  saveDB();
  clearPin('pin-rg');
  showToast('Request submitted — awaiting approval');
  setTimeout(() => goPage('index.html'), 1600);
}

// ── ADMIN AUTH ──
function adminLogin() {
  const id  = document.getElementById('adm-id')?.value.trim();
  const pin = getPin('pin-adm');
  if ((id === ADMIN_PHONE || id === ADMIN_EMAIL) && pin === ADMIN_PIN) {
    setSession({ role:'admin', name:'COODEV', phone:ADMIN_PHONE, isMaster:true, isAdmin:true });
    clearPin('pin-adm');
    goPage('admin.html');
  } else {
    showToast('Invalid credentials');
    clearPin('pin-adm');
  }
}

// ── SIGN OUT ──
function signOut() {
  clearSession();
  goPage('index.html');
}

// ── AUTH GUARD ── (call at top of each protected page)
function requireAuth(expectedRole) {
  const s = getSession();
  if (!s) { goPage('index.html'); return null; }
  if (expectedRole && s.role !== expectedRole && !s.isAdmin) {
    goPage('index.html'); return null;
  }
  return s;
}

// ── LANDING STATS ──
function updateLandingStats() {
  const total    = DB.listings.filter(l => l.status !== 'rejected').length;
  const verified = DB.listings.filter(l => l.status === 'verified').length;
  const agents   = DB.agents.filter(a => a.status === 'approved').length;
  const el_t = document.getElementById('lp-total');   if (el_t) animateCount(el_t, total);
  const el_v = document.getElementById('lp-verified'); if (el_v) animateCount(el_v, verified);
  const el_a = document.getElementById('lp-agents');   if (el_a) animateCount(el_a, agents);
}

function animateCount(el, target) {
  let current = 0;
  const step = Math.max(1, Math.floor(target / 20));
  const interval = setInterval(() => {
    current = Math.min(current + step, target);
    el.textContent = current;
    if (current >= target) clearInterval(interval);
  }, 40);
}

// ── TOAST ──
function showToast(msg) {
  const t   = document.getElementById('toast');
  const msg_el = document.getElementById('toast-msg');
  if (!t || !msg_el) return;
  msg_el.textContent = msg;
  t.classList.add('on');
  if (window.lucide) lucide.createIcons();
  setTimeout(() => t.classList.remove('on'), 3000);
}
