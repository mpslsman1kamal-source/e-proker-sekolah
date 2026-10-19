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

/** Panggil action ke backend (GET untuk data publik 'login'/'ping', selain itu lewat POST+token). */
async function api(action, data) {
  try {
    const res = await fetch(GAS_URL, {
      method: 'POST',
      // WAJIB text/plain — JSON memicu CORS preflight yang diblok GAS
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, data: data || {}, token: Store.getToken() })
    });
    const json = await res.json();
    if (json.success === false && /Sesi/.test(json.message || '')) {
      Store.clearToken(); Store.clearUser();
      renderLogin(json.message);
    }
    return json;
  } catch (err) {
    showToast('Gagal menghubungi server: ' + err.message, 'error');
    return { success: false, message: err.message };
  }
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
