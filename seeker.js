/* ═══════════════════════════════════════
   KEFFIROOMS — SEEKER.JS
   Seeker portal, listings, detail, chat
═══════════════════════════════════════ */

// ── STATE ──
let seekerState = {
  area: 'all',
  vOnly: false,
  maxPrice: 500000,
  loved: new Set(JSON.parse(localStorage.getItem('kr6_loved') || '[]')),
  currentListing: null,
};

function saveLoved() {
  localStorage.setItem('kr6_loved', JSON.stringify([...seekerState.loved]));
}

// ── INIT ──
document.addEventListener('DOMContentLoaded', async () => {
  await initIDB();
  applyTheme();
  const session = getSession();
  // update mode chip
  const chip = document.getElementById('mode-chip-label');
  if (chip) chip.textContent = session?.loggedIn ? 'Seeker Mode' : 'Guest Mode';
  renderListings();
  if (window.lucide) lucide.createIcons();
});

// ── FILTER ──
function setArea(area, el) {
  seekerState.area = area;
  document.querySelectorAll('.area-row').forEach(b => b.classList.remove('on'));
  el.classList.add('on');
  renderListings();
}

function toggleVerified() {
  seekerState.vOnly = !seekerState.vOnly;
  const tgl = document.getElementById('v-toggle');
  if (tgl) tgl.className = 'tgl' + (seekerState.vOnly ? ' on' : '');
  renderListings();
}

function updatePrice(el) {
  const v = parseInt(el.value);
  seekerState.maxPrice = v;
  const pct = ((v - 80000) / (500000 - 80000) * 100).toFixed(1);
  el.style.setProperty('--pct', pct + '%');
  const lbl = document.getElementById('price-val');
  if (lbl) lbl.textContent = 'N' + fmtN(v);
  renderListings();
}

function resetFilters() {
  seekerState.area = 'all';
  seekerState.vOnly = false;
  seekerState.maxPrice = 500000;
  document.querySelectorAll('.area-row').forEach((b, i) => b.classList.toggle('on', i === 0));
  const tgl = document.getElementById('v-toggle'); if (tgl) tgl.className = 'tgl';
  const ps  = document.getElementById('price-slider');
  if (ps) { ps.value = 500000; ps.style.setProperty('--pct', '100%'); }
  const pv  = document.getElementById('price-val'); if (pv) pv.textContent = 'N500,000';
  const aq  = document.getElementById('amenity-q'); if (aq) aq.value = '';
  renderListings();
}

// ── RENDER LISTINGS ──
function renderListings() {
  const q = (document.getElementById('amenity-q')?.value || '').toLowerCase();
  let items = DB.listings.filter(l => l.status !== 'rejected' && l.status !== 'unavailable');
  if (seekerState.vOnly) items = items.filter(l => l.status === 'verified');
  if (seekerState.area !== 'all') items = items.filter(l =>
    (l.area || '').toLowerCase().includes(seekerState.area.toLowerCase())
  );
  if (seekerState.maxPrice < 500000) items = items.filter(l => l.price <= seekerState.maxPrice);
  if (q) items = items.filter(l =>
    l.title.toLowerCase().includes(q) ||
    l.area.toLowerCase().includes(q) ||
    (l.amenities || []).some(a => a.toLowerCase().includes(q)) ||
    (l.description || '').toLowerCase().includes(q)
  );

  const cnt = document.getElementById('list-count');
  if (cnt) cnt.innerHTML = `Showing <strong>${items.length}</strong> Room${items.length !== 1 ? 's' : ''}`;

  const container = document.getElementById('listings-cont');
  if (!container) return;

  if (!items.length) {
    container.innerHTML = `
      <div class="empty">
        <span class="material-symbols-rounded" style="font-size:3rem;color:var(--t4);">search_off</span>
        <p>No rooms found.<br>Try different filters.</p>
      </div>`;
    return;
  }

  container.innerHTML = items.map((l, i) => `
    <div class="lcard" onclick="openDetail('${l.id}')" style="animation-delay:${i * 45}ms">
      <div class="lcard-img">
        ${l.photos && l.photos.length
          ? `<img src="${l.photos[0]}" alt="${l.title}" loading="lazy">`
          : `<div class="lcard-img-ph">
               <span class="material-symbols-rounded" style="font-size:2.5rem;">image_not_supported</span>
               <span>No photo yet</span>
             </div>`}
        <div class="img-overlays">
          <span class="area-tag">${l.area}</span>
          <div class="lcard-actions">
            ${l.status === 'verified'
              ? `<div class="vstamp"><span class="material-symbols-rounded" style="font-size:.75rem;">verified</span>VERIFIED</div>`
              : ''}
            <button class="heart-btn ${seekerState.loved.has(l.id) ? 'loved' : ''}"
              onclick="event.stopPropagation(); toggleLove('${l.id}', this)">
              <span class="material-symbols-rounded" style="font-size:1rem;">${seekerState.loved.has(l.id) ? 'favorite' : 'favorite_border'}</span>
            </button>
          </div>
        </div>
        <div class="price-overlay">
          <div class="price-tag-dark">N${fmtN(l.price)}<span>/yr</span></div>
        </div>
      </div>
      <div class="lcard-body">
        <div class="lcard-title">${l.title}</div>
        <div class="lcard-loc">
          <span class="material-symbols-rounded" style="font-size:.85rem;">location_on</span>
          ${l.distance || l.area}
        </div>
        ${l.amenities && l.amenities.length
          ? `<div class="lcard-tags">
              ${l.amenities.slice(0, 3).map(a =>
                `<span class="ltag"><span class="material-symbols-rounded" style="font-size:.75rem;">check_circle</span>${a}</span>`
              ).join('')}
              ${l.amenities.length > 3 ? `<span class="ltag">+${l.amenities.length - 3} more</span>` : ''}
            </div>`
          : ''}
        <div class="lcard-footer">
          <div class="agent-info">
            <div class="agent-av">${(l.agentName || 'A').charAt(0).toUpperCase()}</div>
            <div class="agent-nm">${l.agentName || 'Agent'}</div>
          </div>
          <div class="rating">
            <span class="material-symbols-rounded" style="font-size:.85rem;">star</span>
            ${(4.5 + Math.random() * 0.4).toFixed(1)}
          </div>
        </div>
      </div>
    </div>`).join('');
}

// ── LOVED / SAVE ──
function toggleLove(id, btn) {
  if (seekerState.loved.has(id)) {
    seekerState.loved.delete(id);
    btn.classList.remove('loved');
    btn.innerHTML = `<span class="material-symbols-rounded" style="font-size:1rem;">favorite_border</span>`;
  } else {
    seekerState.loved.add(id);
    btn.classList.add('loved');
    btn.innerHTML = `<span class="material-symbols-rounded" style="font-size:1rem;">favorite</span>`;
    // heart pop animation
    btn.style.animation = 'none';
    setTimeout(() => { btn.style.animation = 'bounceIn 300ms var(--spring) both'; }, 10);
  }
  saveLoved();
}

// ── DETAIL MODAL ──
function openDetail(id) {
  const l = DB.listings.find(x => x.id === id);
  if (!l) return;
  seekerState.currentListing = l;

  // image
  const dsImg = document.getElementById('ds-img');
  if (dsImg) {
    dsImg.innerHTML = l.photos && l.photos.length
      ? `<img src="${l.photos[0]}" alt="${l.title}">
         <div class="photo-count">
           <span class="material-symbols-rounded" style="font-size:.8rem;">photo_library</span>
           ${l.photos.length} photo${l.photos.length > 1 ? 's' : ''}
         </div>
         <div class="ds-price-row">
           <div class="ds-price">N${fmtN(l.price)}/year</div>
           ${l.status === 'verified' ? `<div class="ds-v-badge"><span class="material-symbols-rounded" style="font-size:.75rem;">verified</span>Verified Lodge</div>` : ''}
         </div>`
      : `<div class="ds-img-ph">
           <span class="material-symbols-rounded" style="font-size:2.5rem;">image_not_supported</span>
         </div>`;
  }

  const dsTitle = document.getElementById('ds-title'); if (dsTitle) dsTitle.textContent = l.title;
  const dsLoc   = document.getElementById('ds-loc');
  if (dsLoc) dsLoc.innerHTML = `<span class="material-symbols-rounded" style="font-size:.9rem;">location_on</span>${l.area}${l.distance ? ' • ' + l.distance : ''}${l.landmark ? ' — ' + l.landmark : ''}`;
  const dsDesc  = document.getElementById('ds-desc');  if (dsDesc) dsDesc.textContent = l.description || 'No description provided.';
  const dsMapLbl= document.getElementById('ds-map-lbl'); if (dsMapLbl) dsMapLbl.textContent = (l.area || 'NSUK') + ', Keffi, Nasarawa';

  // stale warning
  const dsStale = document.getElementById('ds-stale');
  if (dsStale) {
    dsStale.innerHTML = isStale(l.createdAt)
      ? `<div class="stale-warn"><span class="material-symbols-rounded" style="font-size:.85rem;">warning</span>Posted 60+ days ago. Confirm availability with agent before visiting.</div>`
      : '';
  }

  // trust envelope
  const meta = l.photoMetadata && l.photoMetadata[0];
  const dsTrust = document.getElementById('ds-trust');
  if (dsTrust) {
    dsTrust.innerHTML = meta ? `
      <div class="trust-env">
        <div class="te-header">
          <span class="material-symbols-rounded" style="font-size:.85rem;">verified_user</span>
          NSUK TRUST ENVELOPE CHECK
        </div>
        <div class="te-body">
          <strong>Time Sealed:</strong> ${meta.time || '—'}
          <strong>GPS Location:</strong> <span class="${meta.gps_lat ? 'gps-ok' : 'gps-no'}">${meta.gps_lat ? `${meta.gps_lat} N, ${meta.gps_lng} E (${l.area}, Keffi)` : 'GPS not captured'}</span>
          <strong>Hardware Lens:</strong> ${meta.device || 'Unknown'}
          <strong>Photos Attached:</strong> ${l.photos ? l.photos.length : 0} photos
          <strong>Check Status:</strong> ${meta.gps_lat ? 'Secure (GPS Locked)' : 'Limited — verify manually'}
        </div>
      </div>` : '';
  }

  // amenities
  const dsAmenities = document.getElementById('ds-amenities');
  if (dsAmenities) {
    dsAmenities.innerHTML = l.amenities && l.amenities.length
      ? l.amenities.map(a => `
          <div class="amenity-item">
            <span class="material-symbols-rounded" style="font-size:1rem;color:var(--em);">check_circle</span>
            ${a}
          </div>`).join('')
      : `<div style="grid-column:1/-1;font-size:.8rem;color:var(--t4);">No amenities listed</div>`;
  }

  // contact area
  const session = getSession();
  const dsContact = document.getElementById('ds-contact');
  if (dsContact) {
    if (session?.loggedIn) {
      dsContact.innerHTML = `
        <div class="contact-block">
          <div class="cb-top">
            <div class="cb-av">${(l.agentName || 'A').charAt(0).toUpperCase()}</div>
            <div class="cb-info">
              <div class="cb-name">${l.agentName || 'Agent'}</div>
              <div class="cb-role">${l.agentRole || 'Property Agent'}</div>
              <div class="cb-rating">
                <span class="material-symbols-rounded" style="font-size:.8rem;">star</span>
                ${(4.5 + Math.random() * 0.4).toFixed(1)} Rating
              </div>
            </div>
          </div>
          <div class="cb-btns">
            <button class="btn-contact-wa" onclick="contactViaWhatsApp()">
              <span class="material-symbols-rounded" style="font-size:1rem;">chat</span>
              Contact Agent
            </button>
            <button class="btn-call-sm" onclick="callAgent()">
              <span class="material-symbols-rounded" style="font-size:1rem;">call</span>
            </button>
          </div>
        </div>`;
    } else {
      dsContact.innerHTML = `
        <div class="login-gate">
          <div class="gate-icon">
            <span class="material-symbols-rounded" style="font-size:1.5rem;color:var(--teal-l);">lock</span>
          </div>
          <div class="gate-title">Sign in to Contact Agent</div>
          <div class="gate-sub">Create a free account to unlock agent contacts and save listings you love.</div>
          <a href="index.html?auth=seeker" class="btn-gate">Sign In — It's Free</a>
        </div>`;
    }
  }

  const overlay = document.getElementById('detail-overlay');
  if (overlay) {
    overlay.classList.add('open');
    if (window.lucide) lucide.createIcons();
  }
}

function closeDetailModal(e) {
  if (e.target === document.getElementById('detail-overlay') || e.currentTarget.classList.contains('ds-close')) {
    document.getElementById('detail-overlay').classList.remove('open');
  }
}

// ── WHATSAPP CONTACT — MANUAL SETRAPAY FLOW ──
function contactViaWhatsApp() {
  const l = seekerState.currentListing;
  if (!l) return;
  const session = getSession();

  // Message to YOUR WhatsApp (admin/escrow notification)
  // Contains all listing + agent details privately
  const adminMsg = encodeURIComponent(
    `🏠 *KeffiRooms Inquiry Alert*\n\n` +
    `*Listing:* ${l.title}\n` +
    `*Area:* ${l.area}${l.landmark ? ' — ' + l.landmark : ''}\n` +
    `*Distance:* ${l.distance || 'Not specified'}\n` +
    `*Price:* N${fmtN(l.price)}/year\n` +
    `*Type:* ${l.type || 'Not specified'}\n` +
    `*Amenities:* ${(l.amenities || []).join(', ') || 'None listed'}\n\n` +
    `*Agent (PRIVATE):* ${l.agentName}\n` +
    `*Agent Phone:* ${l.agentPhone}\n\n` +
    `*Seeker:* ${session?.phone || 'Guest'}\n\n` +
    `[Setrapay Manual Escrow]\n` +
    `Create WhatsApp group: Seeker + Agent + You\n` +
    `Hold payment. Release when seeker confirms.`
  );

  // Message seeker sends — goes to YOUR WhatsApp with house details
  // Agent info is NOT included here
  const seekerMsg = encodeURIComponent(
    `Hello KeffiRooms,\n\n` +
    `I am interested in this listing:\n\n` +
    `🏠 *${l.title}*\n` +
    `📍 ${l.area}${l.distance ? ' • ' + l.distance : ''}\n` +
    `💰 N${fmtN(l.price)}/year\n` +
    `🛏️ ${l.type || ''}\n` +
    `✅ Amenities: ${(l.amenities || []).slice(0, 4).join(', ') || 'See listing'}\n\n` +
    `Please connect me with the agent.\n` +
    `My name: [your name]\n` +
    `Best time to call: [your preference]`
  );

  // Step 1: Open admin notification silently via hidden link
  const adminLink = document.createElement('a');
  adminLink.href = `https://wa.me/${ADMIN_WA}?text=${adminMsg}`;
  adminLink.target = '_blank';
  adminLink.style.display = 'none';
  document.body.appendChild(adminLink);

  // Step 2: Show seeker the contact interface — directs to YOUR WhatsApp
  document.getElementById('detail-overlay').classList.remove('open');

  // Build chat screen
  document.getElementById('chat-agent-name').textContent = 'KeffiRooms Support';
  document.getElementById('chat-av').textContent = 'KR';

  const chatBody = document.getElementById('chat-body');
  chatBody.innerHTML = `
    <div class="chat-bubble" style="animation-delay:0ms">
      <p>Hello! Thank you for your interest in <strong>${l.title}</strong>.</p>
      <p style="margin-top:8px;font-size:.78rem;color:var(--t3);">We are connecting you with a verified agent. This transaction is protected by <strong style="color:var(--teal-l);">KeffiRooms Trust Protocol.</strong></p>
    </div>
    <div class="chat-bubble" style="animation-delay:800ms;background:var(--teal-p);border-color:var(--teal-b);">
      <p style="font-size:.78rem;color:var(--teal-l);font-weight:600;margin-bottom:12px;">
        <span class="material-symbols-rounded" style="font-size:.9rem;vertical-align:middle;">verified_user</span>
        Secured by KeffiRooms Trust Protocol
      </p>
      <p style="font-size:.8rem;color:var(--t2);margin-bottom:16px;">Tap below to send your inquiry. Our team will connect you with the verified agent and guide the secure transaction.</p>
      <a href="https://wa.me/${ADMIN_WA}?text=${seekerMsg}"
         target="_blank"
         style="display:flex;align-items:center;justify-content:center;gap:8px;
                background:#25D366;color:white;padding:13px;border-radius:14px;
                font-family:Syne,sans-serif;font-size:.9rem;font-weight:700;
                text-decoration:none;margin-bottom:8px;
                box-shadow:0 4px 14px rgba(37,211,102,.35);
                transition:all 200ms;">
        <span class="material-symbols-rounded" style="font-size:1.1rem;">chat</span>
        Message KeffiRooms on WhatsApp
      </a>
      <div style="font-size:.7rem;color:var(--t4);text-align:center;margin-top:6px;display:flex;align-items:center;justify-content:center;gap:4px;">
        <span class="material-symbols-rounded" style="font-size:.75rem;">lock</span>
        Agent details shared securely through KeffiRooms
      </div>
    </div>`;

  // Trigger admin notification
  setTimeout(() => {
    adminLink.click();
    document.body.removeChild(adminLink);
  }, 500);

  // Go to chat screen
  document.body.style.animation = 'pageOut 180ms ease both';
  setTimeout(() => {
    document.body.style.animation = '';
    document.getElementById('scr-seeker').style.display = 'none';
    const chatScr = document.getElementById('scr-chat');
    if (chatScr) { chatScr.style.display = 'flex'; if (window.lucide) lucide.createIcons(); }
  }, 160);
}

function callAgent() {
  const l = seekerState.currentListing;
  if (!l) return;
  // Call goes to YOUR number, not agent directly
  window.location.href = `tel:${ADMIN_PHONE}`;
}

function openMap() {
  const l = seekerState.currentListing;
  if (!l) return;
  const q = encodeURIComponent((l.area || 'NSUK') + ', Keffi, Nasarawa State, Nigeria');
  window.open('https://maps.google.com/?q=' + q, '_blank');
}

function reportListing() {
  const l = seekerState.currentListing;
  const msg = encodeURIComponent(`Report on KeffiRooms: "${l ? l.title : ''}" (${l ? l.id : ''}). Reason: `);
  window.open(`https://wa.me/${ADMIN_WA}?text=${msg}`, '_blank');
}

// ── CHAT ──
function sendChat() {
  const inp = document.getElementById('chat-input');
  const msg = inp?.value.trim();
  if (!msg) return;
  const body = document.getElementById('chat-body');
  body.innerHTML += `<div class="chat-bubble sent" style="animation-delay:0ms"><p>${msg}</p></div>`;
  inp.value = '';
  body.scrollTop = body.scrollHeight;
  // auto reply
  setTimeout(() => {
    body.innerHTML += `
      <div class="chat-bubble" style="animation-delay:0ms">
        <p>Thank you for your message. Our team will connect you with the verified agent shortly via WhatsApp. Please check your WhatsApp for updates.</p>
      </div>`;
    if (window.lucide) lucide.createIcons();
    body.scrollTop = body.scrollHeight;
  }, 1200);
}

function closeChatScreen() {
  const chatScr = document.getElementById('scr-chat');
  const seekerScr = document.getElementById('scr-seeker');
  if (chatScr) chatScr.style.display = 'none';
  if (seekerScr) seekerScr.style.display = 'block';
  if (window.lucide) lucide.createIcons();
}

// ── BOTTOM NAV ──
function skTab(tab, el) {
  document.querySelectorAll('.bn').forEach(b => b.classList.remove('on'));
  el.classList.add('on');
}

// ── THEME ──
function applyTheme() {
  const theme = localStorage.getItem('kr6_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', theme);
}

// ── OPEN CHAT PAGE (passes listing to chat.html) ──
function openChatPage(listing) {
  sessionStorage.setItem('kr6_chat_listing', JSON.stringify(listing));
  goPage('chat.html');
}

// Override contactViaWhatsApp to use dedicated chat page
function contactViaWhatsApp() {
  const l = seekerState.currentListing;
  if (!l) return;
  // close detail modal
  const ov = document.getElementById('detail-overlay');
  if (ov) ov.classList.remove('open');
  // go to dedicated chat page with full listing data
  openChatPage(l);
}
