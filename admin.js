/* ═══════════════════════════════════════
   KEFFIROOMS — ADMIN.JS
   Admin panel, verification, agent approval
═══════════════════════════════════════ */

// ── INIT ──
document.addEventListener('DOMContentLoaded', async () => {
  const session = requireAuth('admin');
  if (!session) return;
  await initIDB();
  applyTheme();
  renderAdmin();
  if (window.lucide) lucide.createIcons();
});

// ── TABS ──
function admTab(tab, el) {
  document.querySelectorAll('.adm-tab').forEach(t => t.classList.remove('on'));
  el.classList.add('on');
  document.querySelectorAll('.adm-panel').forEach(p => p.classList.remove('on'));
  document.getElementById('adm-panel-' + tab).classList.add('on');
  if (tab === 'queue')  renderAuditQueue();
  if (tab === 'agents') renderAgentRequests();
  if (tab === 'all')    renderAllListings();
  if (tab === 'users')  renderUsers();
}

// ── RENDER ADMIN ──
function renderAdmin() {
  const pending   = DB.listings.filter(l => l.status === 'pending').length;
  const agentPend = DB.agents.filter(a => a.status === 'pending').length;
  const tcQ  = document.getElementById('tc-q');  if (tcQ)  tcQ.textContent  = pending;
  const tcAg = document.getElementById('tc-ag'); if (tcAg) tcAg.textContent = agentPend;
  renderAuditQueue();
}

// ── AUDIT QUEUE ──
function renderAuditQueue() {
  updateTrustStats();
  const panel   = document.getElementById('pq-list');
  if (!panel) return;
  const pending = DB.listings.filter(l => l.status === 'pending');
  if (!pending.length) {
    panel.innerHTML = `<div class="empty" style="padding:20px 16px;">
      <span class="material-symbols-rounded" style="font-size:3rem;color:var(--em);">check_circle</span>
      <p>All clear — no pending audits.</p>
    </div>`;
    return;
  }
  panel.innerHTML = pending.map((l, i) => {
    const meta = l.photoMetadata && l.photoMetadata[0];
    return `<div class="pq-card" style="animation-delay:${i*60}ms">
      <div class="pqc-img">
        ${l.photos && l.photos.length
          ? `<img src="${l.photos[0]}" alt="${l.title}">`
          : `<div class="pqc-img-ph">
               <span class="material-symbols-rounded" style="font-size:2rem;">image_not_supported</span>
             </div>`}
      </div>
      <div class="pqc-body">
        <div class="pqc-status-row">
          <span class="pqc-s-tag">PENDING VERIFICATION</span>
          <span class="pqc-distance">${l.distance || ''}</span>
        </div>
        <div class="pqc-title">${l.title}</div>
        <div class="pqc-desc">${l.description || 'No description.'}</div>
        <div class="pqc-meta">
          <div class="pqc-meta-row">
            <span class="material-symbols-rounded" style="font-size:.85rem;color:var(--teal-l);">location_on</span>
            ${l.area}, Keffi &nbsp;
            <span class="material-symbols-rounded" style="font-size:.85rem;color:var(--teal-l);">payments</span>
            N${fmtN(l.price)}/yr
          </div>
          <div class="pqc-meta-row">
            <span class="material-symbols-rounded" style="font-size:.85rem;color:var(--teal-l);">person</span>
            ${l.agentName} (${l.agentPhone})
          </div>
          <div class="pqc-meta-row">
            <span class="material-symbols-rounded" style="font-size:.85rem;color:var(--teal-l);">photo_library</span>
            ${l.photos ? l.photos.length : 0} photos attached
          </div>
        </div>
        ${meta ? `<div class="pqc-seal">
          <strong>Seal Metadata Check</strong>Captured at: ${meta.time || '—'}
GPS Lock: ${meta.gps_lat ? `${meta.gps_lat} N, ${meta.gps_lng} E` : 'No GPS'}
Hardware: ${meta.device || 'Unknown'}
Status: ${meta.gps_lat ? 'Secure (GPS Locked)' : 'Verify manually'}</div>`
        : `<div class="pqc-seal" style="color:var(--gold-l);">No metadata — verify manually before approving.</div>`}
        <div class="pqc-actions">
          <button class="btn-verify-pub" onclick="adminAction('${l.id}','verified')">
            <span class="material-symbols-rounded" style="font-size:1rem;">verified</span>
            Verify &amp; Publish
          </button>
          <button class="btn-reject-flag" onclick="adminAction('${l.id}','rejected')">
            <span class="material-symbols-rounded" style="font-size:1rem;">cancel</span>
            Reject/Flag Scam
          </button>
        </div>
      </div>
    </div>`;
  }).join('');
  if (window.lucide) lucide.createIcons();
}

function adminAction(id, status) {
  const idx = DB.listings.findIndex(l => l.id === id);
  if (idx < 0) return;
  DB.listings[idx].status    = status;
  DB.listings[idx].updatedAt = Date.now();
  saveDB();
  renderAdmin();
  const tcQ = document.getElementById('tc-q');
  if (tcQ) tcQ.textContent = DB.listings.filter(l => l.status === 'pending').length;
  showToast('Listing ' + (status === 'verified' ? 'verified and published' : 'rejected'));
}

function updateTrustStats() {
  const total    = DB.listings.length;
  const verified = DB.listings.filter(l => l.status === 'verified').length;
  const pending  = DB.listings.filter(l => l.status === 'pending').length;
  const verEl  = document.getElementById('ts-verified'); if (verEl) verEl.textContent = verified;
  const pndEl  = document.getElementById('ts-pending');  if (pndEl) pndEl.textContent = pending;
  const vBar   = document.getElementById('ts-ver-bar');  if (vBar)  vBar.style.width  = (total ? verified/total*100 : 0) + '%';
  const pBar   = document.getElementById('ts-pnd-bar');  if (pBar)  pBar.style.width  = (total ? pending/total*100 : 0) + '%';
}

// ── AGENT REQUESTS ──
function renderAgentRequests() {
  const pending  = DB.agents.filter(a => a.status === 'pending');
  const approved = DB.agents.filter(a => a.status === 'approved');
  const pp = document.getElementById('adm-agent-pending');
  const ap = document.getElementById('adm-agent-approved');
  if (pp) pp.innerHTML = pending.length
    ? pending.map(a => agentReqCard(a, 'pending')).join('')
    : '<div style="padding:10px 0;font-size:.8rem;color:var(--t4);">None pending.</div>';
  if (ap) ap.innerHTML = approved.length
    ? approved.map(a => agentReqCard(a, 'approved')).join('')
    : '<div style="padding:10px 0;font-size:.8rem;color:var(--t4);">No approved agents yet.</div>';
  if (window.lucide) lucide.createIcons();
}

function agentReqCard(a, status) {
  return `<div class="agr-card">
    <div class="agr-top">
      <span class="agr-name">${a.name}</span>
      <span class="agr-time">${fmtDate(a.at)}</span>
    </div>
    <div class="agr-phone">
      <span class="material-symbols-rounded" style="font-size:.85rem;color:var(--teal-l);">phone</span>
      ${a.phone}
    </div>
    <div class="agr-actions">
      ${status === 'pending' ? `
        <button class="btn-approve" onclick="approveAgent('${a.id}')">
          <span class="material-symbols-rounded" style="font-size:.85rem;">check</span> Approve
        </button>
        <button class="btn-deny" onclick="denyAgent('${a.id}')">
          <span class="material-symbols-rounded" style="font-size:.85rem;">close</span> Deny
        </button>` : `
        <button class="btn-promote" onclick="promoteAgent('${a.id}')">
          <span class="material-symbols-rounded" style="font-size:.85rem;">shield</span> Make Admin
        </button>
        <button class="btn-deny" onclick="denyAgent('${a.id}')">
          <span class="material-symbols-rounded" style="font-size:.85rem;">block</span> Revoke
        </button>`}
    </div>
  </div>`;
}

function approveAgent(id) {
  const a = DB.agents.find(x => x.id === id); if (!a) return;
  a.status = 'approved'; saveDB(); renderAgentRequests();
  const tcAg = document.getElementById('tc-ag');
  if (tcAg) tcAg.textContent = DB.agents.filter(a => a.status === 'pending').length;
  showToast(a.name + ' approved');
}
function denyAgent(id) {
  const a = DB.agents.find(x => x.id === id); if (!a) return;
  a.status = 'denied'; saveDB(); renderAgentRequests(); showToast('Agent denied');
}
function promoteAgent(id) {
  const a = DB.agents.find(x => x.id === id); if (!a) return;
  a.isAdmin = true; saveDB(); renderAgentRequests(); showToast(a.name + ' promoted to admin');
}

// ── ALL LISTINGS ──
function renderAllListings() {
  const c = document.getElementById('adm-all-list'); if (!c) return;
  if (!DB.listings.length) {
    c.innerHTML = `<div class="empty">
      <span class="material-symbols-rounded" style="font-size:3rem;color:var(--t4);">list_alt</span>
      <p>No listings yet.</p>
    </div>`;
    return;
  }
  c.innerHTML = DB.listings.map(l => `
    <div class="all-listing-row">
      <div class="alr-top">
        <div class="alr-thumb">
          ${l.photos && l.photos.length
            ? `<img src="${l.photos[0]}" alt="${l.title}">`
            : `<div style="width:100%;height:100%;background:var(--bg3);display:flex;align-items:center;justify-content:center;">
                 <span class="material-symbols-rounded" style="font-size:1.2rem;color:var(--t4);">image</span>
               </div>`}
        </div>
        <div class="alr-info">
          <div class="alr-title">${l.title}</div>
          <div class="alr-meta">N${fmtN(l.price)}/yr · ${l.area} · ${l.agentPhone}</div>
          <span class="sbadge ${l.status}">
            <span class="material-symbols-rounded" style="font-size:.7rem;">${l.status==='verified'?'verified':l.status==='pending'?'schedule':'cancel'}</span>
            ${l.status.toUpperCase()}
          </span>
        </div>
      </div>
      <div class="alr-actions">
        ${l.status !== 'verified'  ? `<button class="btn-alr-v" onclick="adminAction('${l.id}','verified')"><span class="material-symbols-rounded" style="font-size:.85rem;">check</span> Verify</button>` : ''}
        ${l.status !== 'rejected'  ? `<button class="btn-alr-r" onclick="adminAction('${l.id}','rejected')"><span class="material-symbols-rounded" style="font-size:.85rem;">close</span> Reject</button>` : ''}
        <button class="btn-alr-u" onclick="adminAction('${l.id}','unavailable')">
          <span class="material-symbols-rounded" style="font-size:.85rem;">visibility_off</span>
        </button>
      </div>
    </div>`).join('');
  if (window.lucide) lucide.createIcons();
}

// ── USERS ──
function renderUsers() {
  const c = document.getElementById('adm-users-list'); if (!c) return;
  const all = [
    ...DB.agents.map(a  => ({ ...a,  _r: 'Agent'  })),
    ...DB.seekers.map(s => ({ name: s.phone, phone: s.phone, at: s.at, _r: 'Seeker' }))
  ];
  if (!all.length) {
    c.innerHTML = `<div class="empty">
      <span class="material-symbols-rounded" style="font-size:3rem;color:var(--t4);">group</span>
      <p>No users yet.</p>
    </div>`;
    return;
  }
  c.innerHTML = all.map(u => `
    <div class="agr-card">
      <div class="agr-top"><span class="agr-name">${u.name || u.phone}</span><span class="agr-time">${u._r}</span></div>
      <div class="agr-phone"><span class="material-symbols-rounded" style="font-size:.85rem;color:var(--teal-l);">phone</span>${u.phone}</div>
    </div>`).join('');
}

// ── THEME ──
function applyTheme() {
  const theme = localStorage.getItem('kr6_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', theme);
}
