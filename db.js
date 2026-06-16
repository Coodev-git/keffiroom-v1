/* ═══════════════════════════════════════
   KEFFIROOMS — DB.JS
   localStorage + IndexedDB data layer
═══════════════════════════════════════ */

// ── CONSTANTS ──
const ADMIN_PHONE = '07066068160';
const ADMIN_EMAIL = 'Setrapaybusiness@gmail.com';
const ADMIN_PIN   = '121217';
const ADMIN_WA    = '2347066068160'; // international format for wa.me

// ── IN-MEMORY DATABASE ──
const DB = {
  listings: JSON.parse(localStorage.getItem('kr6_listings') || '[]'),
  agents:   JSON.parse(localStorage.getItem('kr6_agents')   || '[]'),
  seekers:  JSON.parse(localStorage.getItem('kr6_seekers')  || '[]'),
};

function saveDB() {
  localStorage.setItem('kr6_listings', JSON.stringify(DB.listings));
  localStorage.setItem('kr6_agents',   JSON.stringify(DB.agents));
  localStorage.setItem('kr6_seekers',  JSON.stringify(DB.seekers));
}

// ── INDEXEDDB FOR OFFLINE PHOTO QUEUE ──
let idb;

function initIDB() {
  return new Promise(resolve => {
    const req = indexedDB.open('KeffiRooms6', 1);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('photoQueue')) {
        db.createObjectStore('photoQueue', { keyPath: 'id' });
      }
    };
    req.onsuccess = e => { idb = e.target.result; resolve(); };
    req.onerror   = ()  => resolve(); // fail silently
  });
}

function idbPut(obj) {
  if (!idb) return;
  try {
    idb.transaction('photoQueue', 'readwrite').objectStore('photoQueue').put(obj);
  } catch(e) {}
}

function idbDelete(id) {
  if (!idb) return;
  try {
    idb.transaction('photoQueue', 'readwrite').objectStore('photoQueue').delete(id);
  } catch(e) {}
}

function idbGetAll() {
  return new Promise(resolve => {
    if (!idb) return resolve([]);
    const req = idb.transaction('photoQueue', 'readonly').objectStore('photoQueue').getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror   = () => resolve([]);
  });
}

async function flushPhotoQueue() {
  const queued = await idbGetAll();
  const pending = queued.filter(p => p.metadata?.status === 'pending_upload');
  if (!pending.length) return;
  pending.forEach(p => {
    p.metadata.status = 'uploaded';
    idbPut(p);
  });
}

window.addEventListener('online', flushPhotoQueue);

// ── UTILITY ──
function fmtN(n) { return Number(n).toLocaleString('en-NG'); }

function fmtDate(ts) {
  const d = new Date(ts);
  return d.getFullYear()
    + '-' + String(d.getMonth()+1).padStart(2,'0')
    + '-' + String(d.getDate()).padStart(2,'0');
}

function fmtDateTime(ts) {
  const d = new Date(ts);
  return fmtDate(ts)
    + ' ' + String(d.getHours()).padStart(2,'0')
    + ':' + String(d.getMinutes()).padStart(2,'0');
}

function nowStr() {
  return fmtDateTime(Date.now());
}

function isStale(ts) {
  return (Date.now() - ts) > 60 * 24 * 60 * 60 * 1000; // 60 days
}

// ── GPS ──
function getGPS() {
  return new Promise(resolve => {
    if (!navigator.geolocation) return resolve({ lat:null, lng:null, acc:null });
    navigator.geolocation.getCurrentPosition(
      p => resolve({
        lat: p.coords.latitude.toFixed(6),
        lng: p.coords.longitude.toFixed(6),
        acc: Math.round(p.coords.accuracy) + 'm'
      }),
      () => resolve({ lat:null, lng:null, acc:null }),
      { timeout: 5500, maximumAge: 60000 }
    );
  });
}

function getDevice() {
  if (/android/i.test(navigator.userAgent)) return 'Android';
  if (/iphone|ipad/i.test(navigator.userAgent)) return 'iOS';
  return 'Desktop';
}
