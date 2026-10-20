// ============================================
// LOGIN
// ============================================
document.getElementById('form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true; btn.textContent = 'MEMERIKSA...';
  document.getElementById('login-error').classList.add('hidden');

  const res = await api('login', {
    username: document.getElementById('login-username').value.trim(),
    password: document.getElementById('login-password').value
  });

  btn.disabled = false; btn.textContent = 'MASUK SISTEM →';
  if (!res.success) {
    const err = document.getElementById('login-error');
    err.textContent = res.message || 'Login gagal.';
    err.classList.remove('hidden');
    return;
  }
  Store.setToken(res.token); Store.setUser(res.user);
  await bootApp();
});

function logout() {
  api('logout', {});
  Store.clearToken(); Store.clearUser(); AppState.invalidate();
  document.getElementById('view-app').classList.add('hidden');
  document.getElementById('view-login').classList.remove('hidden');
}

// ============================================
// MENU PER PERAN (PRD 7.2)
// ============================================
const MENU_BY_ROLE = {
  'Superadmin': [
    { id: 'dashboard', label: 'Dashboard Pemantauan', icon: 'monitoring' },
    { id: 'pengguna', label: 'Kelola Pengguna', icon: 'group' },
    { id: 'penugasan', label: 'Penugasan Staf', icon: 'assignment_ind' },
    { id: 'pengaturan', label: 'Pengaturan', icon: 'tune' },
    { id: 'lognotif', label: 'Log Notifikasi', icon: 'forum' }
  ],
  'Kepala Sekolah': [
    { id: 'dashboard', label: 'Dashboard & Grafik', icon: 'bar_chart' },
    { id: 'antrean-validasi', label: 'Antrean Validasi', icon: 'fact_check' },
    { id: 'antrean-perubahan', label: 'Antrean Perubahan', icon: 'history_edu' },
    { id: 'proker-list', label: 'Semua Proker', icon: 'folder_open' }
  ],
  'Bendahara': [
    { id: 'dashboard', label: 'Dashboard Anggaran', icon: 'payments' },
    { id: 'proker-list', label: 'Proker Diterima', icon: 'request_quote' }
  ],
  'Waka/Koordinator': [
    { id: 'dashboard', label: 'Dashboard Saya', icon: 'dashboard' },
    { id: 'proker-list', label: 'Proker Saya', icon: 'description' }
  ],
  'Staf': [
    { id: 'proker-list', label: 'Proker Pemberi Tugas', icon: 'edit_note' }
  ]
};

const PAGE_TITLE = {
  'dashboard': 'Dashboard', 'pengguna': 'Kelola Pengguna', 'penugasan': 'Penugasan Staf',
  'pengaturan': 'Pengaturan', 'lognotif': 'Log Notifikasi WhatsApp',
  'antrean-validasi': 'Antrean Validasi Proker', 'antrean-perubahan': 'Antrean Pengajuan Perubahan',
  'proker-list': 'Daftar Proker', 'proker-form': 'Form Proker', 'proker-detail': 'Detail Proker'
};

let currentRoute = 'dashboard';
let currentRouteParam = null;

function renderSidebarMenu(user) {
  const nav = document.getElementById('sidebar-nav');
  const items = MENU_BY_ROLE[user.peran] || [];
  nav.innerHTML = items.map(m => `
    <a class="nav-item" data-route="${m.id}" onclick="navigateTo('${m.id}')">
      <span class="mi">${m.icon}</span><span>${escapeHtml(m.label)}</span>
    </a>`).join('');
}

const ROLE_INISIAL = { 'Superadmin': 'SA', 'Kepala Sekolah': 'KS', 'Bendahara': 'BN', 'Staf': 'ST', 'Waka/Koordinator': 'WK' };
function inisialAvatar(user) {
  const bagian = (user.nama || '').trim().split(/\s+/);
  return (bagian[0] ? bagian[0][0] : '') + (bagian[1] ? bagian[1][0] : (bagian[0] ? bagian[0][1] || '' : ''));
}

function navigateTo(route, param) {
  currentRoute = route; currentRouteParam = param || null;
  document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.route === route));
  document.getElementById('sidebar').classList.remove('open');
  renderPage(route, param);
}

/** Bar judul halaman di dalam konten (meniru "TOP BAR CONTROL" tiap layar Stitch). */
function pageHeaderBar(title) {
  return `<div class="flex items-center justify-between" style="background:var(--surface);padding:var(--space-md) var(--space-lg);box-shadow:var(--shadow-sm);margin-bottom:var(--space-lg);flex-wrap:wrap;gap:8px;">
    <h2 style="font-size:22px;font-weight:800;color:var(--ink);letter-spacing:-0.01em;">${escapeHtml(title)}</h2>
    <span class="field-hint" style="background:var(--surface-1);padding:3px 8px;">[SYS.RUNNING: ${escapeHtml((currentRoute || '').toUpperCase())}]</span>
  </div>`;
}

/**
 * PENJAGA RENDER BASI (perbaikan bug race condition — bukan perubahan tampilan):
 * Setiap pindah halaman menaikkan _renderEpoch. Halaman async (fetch lama yang baru
 * selesai setelah pengguna sudah pindah menu) wajib mengecek masihRenderAktif(epoch)
 * sebelum menyentuh DOM — kalau sudah basi, batalkan render tanpa error alih-alih
 * menulis ke elemen yang sudah tidak ada ("Cannot set properties of null").
 */
let _renderEpoch = 0;
function renderEpochSaatIni() { return _renderEpoch; }
function masihRenderAktif(epoch) { return epoch === _renderEpoch; }

function renderPage(route, param) {
  const user = Store.getUser();
  _renderEpoch++;
  const content = document.getElementById('page-content');
  content.innerHTML = pageHeaderBar(PAGE_TITLE[route] || route) + '<div id="page-body"><div class="empty-state">Memuat...</div></div>';
  const bodyEl = document.getElementById('page-body');
  return renderPageBody(route, param, user, bodyEl);
}

function renderPageBody(route, param, user, content) {

  switch (route) {
    case 'dashboard': return renderDashboard(user, content);
    case 'proker-list': return renderProkerList(user, content);
    case 'proker-form': return renderProkerForm(user, content, param);
    case 'proker-detail': return renderProkerDetail(user, content, param);
    case 'antrean-validasi': return renderProkerList(user, content, { status: 'Diajukan' });
    case 'antrean-perubahan': return renderAntreanPerubahan(user, content);
    case 'pengguna': return renderPengguna(user, content);
    case 'penugasan': return renderPenugasan(user, content);
    case 'pengaturan': return renderPengaturan(user, content);
    case 'lognotif': return renderLogNotif(user, content);
    default: content.innerHTML = '<div class="empty-state">Halaman tidak ditemukan.</div>';
  }
}

// ============================================
// BOOT
// ============================================
async function bootApp() {
  const user = Store.getUser();
  if (!user || !Store.getToken()) return renderLogin();

  document.getElementById('view-login').classList.add('hidden');
  document.getElementById('view-app').classList.remove('hidden');
  document.getElementById('sidebar-user-nama').textContent = user.nama;
  document.getElementById('sidebar-user-avatar').textContent = inisialAvatar(user).toUpperCase();
  document.getElementById('sidebar-user-avatar').style.background = warnaPeran(user.peran);
  document.getElementById('sidebar-user-role').innerHTML = '<span class="role-tag">' + escapeHtml(user.peran) + '</span>';
  renderSidebarMenu(user);

  await AppState.muatMasterData();
  const tahunAktif = AppState.tahunAjaran.find(t => t.aktif === true || String(t.aktif).toUpperCase() === 'TRUE');
  document.getElementById('topbar-tahun').textContent = 'TA ' + (tahunAktif ? tahunAktif.nama + ' — ' + tahunAktif.semester : '-');

  const defaultRoute = (MENU_BY_ROLE[user.peran] && MENU_BY_ROLE[user.peran][0].id) || 'proker-list';
  navigateTo(defaultRoute);
}

function renderLogin(message) {
  document.getElementById('view-app').classList.add('hidden');
  document.getElementById('view-login').classList.remove('hidden');
  if (message) { const err = document.getElementById('login-error'); err.textContent = message; err.classList.remove('hidden'); }
}

document.addEventListener('DOMContentLoaded', () => {
  warmUpServer(); // jaga instance Apps Script tetap hangat sebelum pengguna menekan tombol apa pun
  if (Store.getUser() && Store.getToken()) bootApp();
});
