// ============================================
// KONFIGURASI
// ============================================
// Ganti dengan URL /exec hasil Deploy > New deployment > Web app di Apps Script.
const GAS_URL = 'https://script.google.com/macros/s/AKfycbxfmdqxpXwOpT0or9uhAgaDimybrfZFZuv0Gr5G2c2O_BQ0jk4UnziuqyXm4GuYjfMxyA/exec';

const Store = {
  getToken() { return localStorage.getItem('eproker_token') || ''; },
  setToken(t) { localStorage.setItem('eproker_token', t); },
  clearToken() { localStorage.removeItem('eproker_token'); },
  getUser() { try { return JSON.parse(localStorage.getItem('eproker_user') || 'null'); } catch (e) { return null; } },
  setUser(u) { localStorage.setItem('eproker_user', JSON.stringify(u)); },
  clearUser() { localStorage.removeItem('eproker_user'); }
};

// ============================================
// PERFORMA (gas-scale-turbo): cache SWR untuk aksi baca, timeout, deteksi respons non-JSON
// ============================================
const _swrCache = {};
// TTL (ms) khusus aksi BACA yang aman di-cache sebentar agar pindah menu terasa instan.
// Aksi TULIS (tidak ada di daftar ini) selalu membersihkan seluruh cache baca setelah sukses.
const SWR_TTL = {
  prokerList: 20000, prokerDetail: 15000,
  dashboardSuperadmin: 20000, dashboardKepsek: 20000, dashboardBendahara: 20000, dashboardPemilik: 20000,
  penggunaList: 20000, penugasanList: 20000, bidangList: 300000, tahunAjaranList: 300000,
  pengaturanGet: 60000, logNotifikasiList: 15000, perubahanAntreanList: 15000, anggaranList: 15000
};

/**
 * Satu kali percobaan fetch ke backend.
 * Mengembalikan { ok:false, retryable:true, ... } untuk kegagalan di level TRANSPORT
 * (fetch gagal / respons bukan JSON) — ini aman dicoba ulang karena kemungkinan besar
 * permintaan belum sempat diproses logika server sama sekali (gejala cold-start GAS).
 * Kegagalan LOGIKA (server sukses merespons tapi success:false, mis. salah kata sandi)
 * selalu ok:true — TIDAK pernah dicoba ulang otomatis.
 */
async function apiSekaliPanggil(action, data) {
  const t0 = (window.performance && performance.now) ? performance.now() : Date.now();
  const controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), 25000) : null;
  try {
    const res = await fetch(GAS_URL, {
      method: 'POST',
      // WAJIB text/plain — JSON memicu CORS preflight yang diblok GAS
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, data: data || {}, token: Store.getToken() }),
      signal: controller ? controller.signal : undefined
    });
    const teks = await res.text();
    try {
      const json = JSON.parse(teks);
      if (window.console && typeof json.ms === 'number') {
        const totalMs = Math.round(((window.performance && performance.now) ? performance.now() : Date.now()) - t0);
        console.debug('[api] ' + action + ' — server ' + json.ms + 'ms, total ' + totalMs + 'ms');
      }
      return { ok: true, json };
    } catch (eParse) {
      console.error('Respons server bukan JSON untuk aksi "' + action + '":', teks.slice(0, 300));
      return { ok: false, retryable: true, pesan: 'Server tidak merespons dengan benar.' };
    }
  } catch (err) {
    const abort = err && err.name === 'AbortError';
    return {
      ok: false,
      retryable: !abort, // timeout 25dtk biasanya berarti server benar-benar berat, tidak perlu diulang otomatis
      pesan: abort ? 'Server lambat merespons (lebih dari 25 detik).' : 'Gagal menghubungi server: ' + err.message
    };
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function tungguSebentar(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

/** Panggil action ke backend — cache SWR untuk aksi baca, timeout, dan 1x percobaan ulang otomatis bila transport gagal. */
async function api(action, data, opts) {
  opts = opts || {};
  const ttl = SWR_TTL[action];
  const cacheKey = ttl ? action + '::' + JSON.stringify(data || {}) : null;
  if (cacheKey && !opts.fresh) {
    const hit = _swrCache[cacheKey];
    if (hit && Date.now() - hit.ts < ttl) return hit.data;
  }

  let hasil = await apiSekaliPanggil(action, data);
  if (!hasil.ok && hasil.retryable) {
    await tungguSebentar(1500); // jeda singkat — beri waktu Apps Script "bangun" dari cold-start
    hasil = await apiSekaliPanggil(action, data);
  }

  if (!hasil.ok) {
    const pesan = hasil.pesan + ' Sudah dicoba ulang otomatis — coba lagi beberapa saat, atau muat ulang halaman (Ctrl+Shift+R).';
    showToast(pesan, 'error');
    return { success: false, message: pesan };
  }

  const json = hasil.json;
  if (json.success === false && /Sesi/.test(json.message || '')) {
    Store.clearToken(); Store.clearUser();
    renderLogin(json.message);
  }

  if (json && json.success !== false) {
    if (cacheKey) _swrCache[cacheKey] = { ts: Date.now(), data: json };
    else if (!ttl) Object.keys(_swrCache).forEach(k => delete _swrCache[k]); // aksi tulis sukses -> cache baca dibersihkan
  }
  return json;
}

/** Ping ringan ke server (tanpa menunggu hasil) agar instance Apps Script tetap hangat — gas-scale-turbo §4.7. */
function warmUpServer() {
  try {
    const terakhir = Number(sessionStorage.getItem('eproker_warm_ts') || 0);
    if (Date.now() - terakhir < 4 * 60 * 1000) return;
    sessionStorage.setItem('eproker_warm_ts', String(Date.now()));
    fetch(GAS_URL + '?w=1', { mode: 'no-cors' }).catch(() => {});
  } catch (e) {}
}

// ============================================
// CACHE DATA MASTER DI SISI KLIEN (Instant UX — hindari fetch berulang)
// ============================================
const AppState = {
  bidang: [], program: [], tahunAjaran: [], pengguna: [],
  async muatMasterData() {
    const cached = localStorage.getItem('eproker_master_cache');
    const cacheTs = Number(localStorage.getItem('eproker_master_cache_ts') || 0);
    if (cached && Date.now() - cacheTs < 5 * 60 * 1000) {
      Object.assign(this, JSON.parse(cached));
      return;
    }
    const [b, t] = await Promise.all([api('bidangList', {}), api('tahunAjaranList', {})]);
    if (b.success) this.bidang = b.data;
    if (t.success) this.tahunAjaran = t.data;
    localStorage.setItem('eproker_master_cache', JSON.stringify({ bidang: this.bidang, tahunAjaran: this.tahunAjaran }));
    localStorage.setItem('eproker_master_cache_ts', String(Date.now()));
  },
  invalidate() { localStorage.removeItem('eproker_master_cache'); }
};

// ============================================
// UI HELPERS
// ============================================
function showToast(message, type) {
  const wrap = document.getElementById('toast-wrap');
  if (!wrap) return;
  const el = document.createElement('div');
  el.className = 'toast ' + (type || 'success');
  el.textContent = message;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

function showLoading(show) {
  let el = document.getElementById('loading-overlay');
  if (show) {
    if (!el) {
      el = document.createElement('div');
      el.id = 'loading-overlay'; el.className = 'loading-overlay';
      el.textContent = 'MEMPROSES...';
      document.body.appendChild(el);
    }
  } else if (el) {
    el.remove();
  }
}

function fmtTanggal(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtRupiah(n) { return 'Rp ' + (Number(n) || 0).toLocaleString('id-ID'); }

function badgeStatus(status) {
  const map = {
    'Draft': 'badge-draft', 'Diajukan': 'badge-diajukan', 'Diterima': 'badge-diterima',
    'Ditolak': 'badge-ditolak', 'Anggaran Disusun': 'badge-anggaran',
    'Disetujui': 'badge-disetujui'
  };
  return '<span class="badge ' + (map[status] || 'badge-draft') + '">' + escapeHtml(status) + '</span>';
}

// ---------- Modal generik ----------
function openModal(title, bodyHtml, footerHtml) {
  closeModal();
  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop'; wrap.id = 'active-modal';
  wrap.innerHTML = `<div class="modal">
    <div class="modal-header"><span>${escapeHtml(title)}</span><span class="close-x" onclick="closeModal()">✕</span></div>
    <div class="modal-body">${bodyHtml}</div>
    ${footerHtml ? `<div class="modal-footer">${footerHtml}</div>` : ''}
  </div>`;
  wrap.addEventListener('click', (e) => { if (e.target === wrap) closeModal(); });
  document.body.appendChild(wrap);
}
function closeModal() { const el = document.getElementById('active-modal'); if (el) el.remove(); }

function escapeHtml(s) {
  return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
