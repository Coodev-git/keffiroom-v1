/* ═══════════════════════════════════════
   KEFFIROOMS — AGENT.JS
   Agent hub, post form, photos, GPS
═══════════════════════════════════════ */

let agentState = {
  photos: [],
  trustMeta: null,
};

// ── INIT ──
document.addEventListener('DOMContentLoaded', async () => {
  const session = requireAuth('agent');
  if (!session) return;
  await initIDB();
  applyTheme();
  renderAgentHub(session);
  if (window.lucide) lucide.createIcons();
});

// ── RENDER HUB ──
function renderAgentHub(session) {
  const phone = session.phone;
  const agent = DB.agents.find(a => a.phone === phone);
  const mine  = DB.listings.filter(l => l.agentPhone === phone);
  const verified = mine.filter(l => l.status === 'verified').length;
  const pending  = mine.filter(l => l.status === 'pending').length;

  // update name display
  const nameEl = document.getElementById('ah-agent-name');
  if (nameEl) nameEl.textContent = session.name;

  // stats
  const totEl = document.getElementById('ag-total'); if (totEl) animateCount(totEl, mine.length);
  const verEl = document.getElementById('ag-verified'); if (verEl) animateCount(verEl, verified);
  const pndEl = document.getElementById('ag-pending'); if (pndEl) animateCount(pndEl, pending);
  const subEl = document.getElementById('ag-stat-sub');
  if (subEl) subEl.textContent = `${verified} verified, ${pending} pending review`;

  renderPropTable(mine);
}

function renderPropTable(items) {
  const c = document.getElementById('ag-props-list');
  if (!c) return;
  if (!items.length) {
    c.innerHTML = `<div class="empty">
      <span class="material-symbols-rounded" style="font-size:3rem;color:var(--t4);">list_alt</span>
      <p>No listings yet.<br>Tap <strong>List New Room</strong> to get started.</p>
    </div>`;
    return;
  }
  c.innerHTML = items.map(l => `
    <div class="prop-row">
      <div class="prop-row-info">
        <div class="prop-thumb">
          ${l.photos && l.photos.length
            ? `<img src="${l.photos[0]}" alt="${l.title}">`
            : `<div style="width:100%;height:100%;background:var(--bg3);border-radius:8px;display:flex;align-items:center;justify-content:center;">
                 <span class="material-symbols-rounded" style="font-size:1.2rem;color:var(--t4);">image</span>
               </div>`}
        </div>
        <div>
          <div class="prop-name">${l.title}</div>
          <div class="prop-by">By: ${l.agentName}</div>
        </div>
      </div>
      <div><span class="prop-loc">${l.area}</span></div>
      <div class="prop-price">N${fmtN(l.price)}</div>
    </div>`).join('');
}

// ── POST FORM ──
function showPostForm() {
  document.getElementById('ag-home-panel').style.display = 'none';
  document.getElementById('ag-post-panel').style.display = 'block';
  document.getElementById('ag-btm-nav').style.display    = 'none';
  window.scrollTo(0, 0);
  if (window.lucide) lucide.createIcons();
}
function hidePostForm() {
  document.getElementById('ag-home-panel').style.display = 'block';
  document.getElementById('ag-post-panel').style.display = 'none';
  document.getElementById('ag-btm-nav').style.display    = 'flex';
  const session = getSession();
  if (session) renderAgentHub(session);
  if (window.lucide) lucide.createIcons();
}
function agTab(tab, el) {
  document.querySelectorAll('#sag .bn').forEach(b => b.classList.remove('on'));
  el.classList.add('on');
  if (tab === 'post')   showPostForm();
  else if (tab === 'browse') { window.location.href = 'seeker.html'; }
  else hidePostForm();
}

// ── PHOTOS + METADATA ──
async function handlePhotos(e) {
  const files = Array.from(e.target.files).slice(0, 12 - agentState.photos.length);
  if (!files.length) return;
  showToast('Attaching GPS metadata...');
  const gps = await getGPS();
  const now = nowStr();
  const dev = getDevice();
  for (const f of files) {
    await new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = async ev => {
        const obj = {
          id: 'PH' + Date.now() + Math.random().toString(36).slice(2, 5),
          data: ev.target.result,
          metadata: {
            time: now, gps_lat: gps.lat, gps_lng: gps.lng, gps_acc: gps.acc,
            device: dev, size_kb: Math.round(f.size / 1024),
            status: navigator.onLine ? 'online' : 'pending_upload'
          }
        };
        agentState.photos.push(obj);
        idbPut(obj);
        renderPhotoPreviews();
        resolve();
      };
      reader.readAsDataURL(f);
    });
  }
  showToast(gps.lat ? `GPS ±${gps.acc} captured` : 'Metadata attached (no GPS)');
}

function renderPhotoPreviews() {
  const c = document.getElementById('photo-row');
  if (!c) return;
  const n = agentState.photos.length;
  const lbl = document.getElementById('photo-count-lbl');
  if (lbl) {
    const ok = n >= 5;
    lbl.innerHTML = `<span style="color:${ok ? 'var(--em)' : 'var(--gold-l)'};">${n} / 12 photos</span> ${!ok ? `<span style="color:var(--gold-l);">(need ${5-n} more)</span>` : '<span style="color:var(--em);">✓ minimum met</span>'}`;
  }
  c.innerHTML = agentState.photos.map((p, i) => `
    <div class="photo-wrap">
      <img src="${p.data}" class="photo-thumb" alt="Photo ${i+1}">
      <button class="photo-del" onclick="deletePhoto(${i})">✕</button>
      <div class="gdot ${p.metadata?.gps_lat ? 'ok' : 'no'}">
        <span class="material-symbols-rounded" style="font-size:.6rem;">${p.metadata?.gps_lat ? 'location_on' : 'schedule'}</span>
      </div>
    </div>`).join('');
}

function deletePhoto(i) {
  const p = agentState.photos[i];
  if (p?.id) idbDelete(p.id);
  agentState.photos.splice(i, 1);
  renderPhotoPreviews();
}

async function doCapture() {
  showToast('Capturing verification shot...');
  const gps = await getGPS();
  const now = nowStr();
  const dev = getDevice();
  agentState.trustMeta = { time: now, gps_lat: gps.lat, gps_lng: gps.lng, gps_acc: gps.acc, device: dev };
  const el = document.getElementById('metabox');
  if (el) {
    el.style.display = 'block';
    el.innerHTML = `<strong>CAMERA EXIF ENCRYPTED</strong>GPS: ${gps.lat ? `${gps.lat} N, ${gps.lng} E (±${gps.acc})` : 'Unavailable'}\nHardware: ${dev}\nTime Signature: ${now}\nCheck Status: ${gps.lat ? 'Secure (GPS Locked)' : 'Limited — No GPS'}`;
  }
  showToast('Verification snapshot captured');
}

// ── SUBMIT LISTING ──
function submitListing() {
  const title    = document.getElementById('f-title')?.value.trim();
  const type     = document.getElementById('f-type')?.value;
  const price    = document.getElementById('f-price')?.value;
  const area     = document.getElementById('f-area')?.value;
  const distance = document.getElementById('f-distance')?.value;
  const desc     = document.getElementById('f-desc')?.value.trim();

  if (!title || !type || !price || !area || !distance) {
    showToast('Fill all required fields'); return;
  }
  if (agentState.photos.length < 5) {
    showToast(`Add at least 5 photos (${agentState.photos.length}/5 uploaded)`); return;
  }

  const session = getSession();
  const agent   = DB.agents.find(a => a.phone === session?.phone);
  if (!agent || agent.status !== 'approved') { showToast('Account not approved yet'); return; }

  const amenities = Array.from(document.querySelectorAll('.amenity-check-label input:checked')).map(i => i.value);
  const id = 'KR' + Date.now();
  const photos = agentState.photos.map(p => p.data);
  const meta   = agentState.photos.map(p => { if (p.metadata) p.metadata.listing_id = id; return p.metadata; });
  if (agentState.trustMeta && !meta.length) meta.push(agentState.trustMeta);

  DB.listings.unshift({
    id, title, type, price: Number(price), description: desc,
    area, landmark: document.getElementById('f-landmark')?.value.trim() || '',
    distance, amenities, agentName: agent.name, agentPhone: agent.phone,
    agentRole: 'Agent', photos, photoMetadata: meta,
    status: 'pending', createdAt: Date.now(), updatedAt: Date.now()
  });
  saveDB();

  // reset
  ['f-title','f-type','f-price','f-desc','f-area','f-distance','f-landmark']
    .forEach(fid => { const e = document.getElementById(fid); if (e) e.value = ''; });
  document.querySelectorAll('.amenity-check-label input').forEach(i => i.checked = false);
  agentState.photos = [];
  agentState.trustMeta = null;
  renderPhotoPreviews();
  const mb = document.getElementById('metabox'); if (mb) mb.style.display = 'none';
  showToast('Dispatched to verification queue');
  setTimeout(() => hidePostForm(), 1300);
}

// ── THEME ──
function applyTheme() {
  const theme = localStorage.getItem('kr6_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', theme);
}
