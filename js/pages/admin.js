// ============================================
// KELOLA PENGGUNA — US-01
// ============================================
async function renderPengguna(user, content) {
  showLoading(true);
  const res = await api('penggunaList', {});
  showLoading(false);
  if (!res.success) return (content.innerHTML = errBox(res.message));

  content.innerHTML = `<div class="card">
    <div class="card-header"><h3>Kelola Pengguna</h3><button class="btn btn-primary btn-sm" onclick="bukaModalPengguna()"><span class="mi" style="font-size:14px;">person_add</span>Akun Baru</button></div>
    <div class="table-wrap"><table class="data-table">
      <thead><tr><th>Nama</th><th>Username</th><th>Peran</th><th>Nomor WA</th><th>Status</th><th></th></tr></thead>
      <tbody>${res.data.map(u => `<tr>
        <td>${escapeHtml(u.nama)}</td><td class="mono">${escapeHtml(u.username)}</td><td><span class="role-chip" style="border-color:${warnaPeran(u.peran)};">${escapeHtml(u.peran)}</span></td>
        <td class="mono">${escapeHtml(u.nomor_wa)}</td>
        <td>${(u.status_aktif === true || String(u.status_aktif).toUpperCase() === 'TRUE') ? '<span class="badge badge-diterima">AKTIF</span>' : '<span class="badge badge-ditolak">NONAKTIF</span>'}</td>
        <td class="flex gap-sm">
          <button class="btn btn-secondary btn-sm" onclick='bukaModalPengguna(${JSON.stringify(u).replace(/'/g, "&#39;")})'>Ubah</button>
          <button class="btn btn-danger btn-sm" onclick="toggleAktifPengguna('${u.id_pengguna}')">Aktif/Nonaktif</button>
        </td></tr>`).join('')}</tbody>
    </table></div></div>`;
}

function warnaPeran(peran) {
  const map = { 'Superadmin': 'var(--rbac-superadmin)', 'Kepala Sekolah': 'var(--rbac-kepsek)', 'Bendahara': 'var(--rbac-bendahara)', 'Staf': 'var(--rbac-staf)', 'Waka/Koordinator': 'var(--rbac-waka)' };
  return map[peran] || 'var(--ink)';
}

function bukaModalPengguna(u) {
  const peranOpsi = ['Superadmin', 'Kepala Sekolah', 'Bendahara', 'Staf', 'Waka/Koordinator']
    .map(p => `<option value="${p}" ${u && u.peran === p ? 'selected' : ''}>${p}</option>`).join('');
  openModal(u ? 'Ubah Pengguna' : 'Akun Baru', `
    <div class="field"><label>Nama Lengkap <span class="req">[WAJIB]</span></label><input id="m-u-nama" value="${escapeHtml(u ? u.nama : '')}"></div>
    <div class="field"><label>Username <span class="req">[WAJIB]</span></label><input id="m-u-username" value="${escapeHtml(u ? u.username : '')}" ${u ? 'disabled' : ''}></div>
    <div class="field"><label>Peran <span class="req">[WAJIB]</span></label><select id="m-u-peran">${peranOpsi}</select></div>
    <div class="field"><label>Nomor WhatsApp</label><input id="m-u-wa" value="${escapeHtml(u ? u.nomor_wa : '')}" placeholder="628xxxxxxxxxx"></div>
    <div class="field"><label>${u ? 'Kata Sandi Baru (kosongkan jika tidak diubah)' : 'Kata Sandi Awal (kosongkan = Sekolah#2026)'}</label><input type="password" id="m-u-sandi"></div>
  `, `<button class="btn btn-secondary" onclick="closeModal()">Batal</button>
      <button class="btn btn-primary" onclick="simpanPenggunaModal('${u ? u.id_pengguna : ''}')">Simpan</button>`);
}

async function simpanPenggunaModal(idPengguna) {
  const payload = {
    nama: document.getElementById('m-u-nama').value.trim(),
    username: document.getElementById('m-u-username').value.trim(),
    peran: document.getElementById('m-u-peran').value,
    nomor_wa: document.getElementById('m-u-wa').value.trim(),
    kata_sandi_baru: document.getElementById('m-u-sandi').value
  };
  if (idPengguna) payload.id_pengguna = idPengguna;
  if (!payload.nama || !payload.username) return showToast('Nama dan username wajib diisi.', 'error');

  showLoading(true);
  const res = await api('penggunaSimpan', payload);
  showLoading(false);
  closeModal();
  showToast(res.message, res.success ? 'success' : 'error');
  if (res.success) navigateTo('pengguna');
}

async function toggleAktifPengguna(id) {
  if (!confirm('Ubah status aktif akun ini?')) return;
  showLoading(true);
  const res = await api('penggunaNonaktifkan', { id_pengguna: id });
  showLoading(false);
  showToast(res.message, res.success ? 'success' : 'error');
  if (res.success) navigateTo('pengguna');
}

// ============================================
// PENUGASAN STAF — US-02
// ============================================
async function renderPenugasan(user, content) {
  showLoading(true);
  const [penugasan, pengguna] = await Promise.all([api('penugasanList', {}), api('penggunaList', {})]);
  showLoading(false);
  if (!penugasan.success) return (content.innerHTML = errBox(penugasan.message));

  const stafOpsi = pengguna.data.filter(p => p.peran === 'Staf').map(p => `<option value="${p.id_pengguna}">${escapeHtml(p.nama)}</option>`).join('');
  const wakaOpsi = pengguna.data.filter(p => p.peran === 'Waka/Koordinator').map(p => `<option value="${p.id_pengguna}">${escapeHtml(p.nama)}</option>`).join('');
  const tahunOpsi = AppState.tahunAjaran.map(t => `<option value="${t.id_tahun_ajaran}">${escapeHtml(t.nama)}</option>`).join('');

  content.innerHTML = `<div class="card">
    <div class="card-header"><h3>Tambah Penugasan</h3></div>
    <div class="card-body">
      <div class="field-row">
        <div class="field"><label>Staf</label><select id="p-staf">${stafOpsi}</select></div>
        <div class="field"><label>Waka / Koordinator</label><select id="p-pemilik">${wakaOpsi}</select></div>
        <div class="field"><label>Tahun Ajaran</label><select id="p-tahun">${tahunOpsi}</select></div>
      </div>
      <button class="btn btn-primary" onclick="simpanPenugasanBaru()">Simpan Penugasan</button>
    </div>
  </div>
  ${cardTable('Daftar Penugasan Aktif', ['Staf', 'Bertugas untuk', 'Tahun Ajaran', 'Status'],
    penugasan.data.map(t => [escapeHtml(t.nama_staf), escapeHtml(t.nama_pemilik), escapeHtml(t.tahun_ajaran), badgeStatus(t.status === 'Aktif' ? 'Diterima' : t.status)]))}`;
}

async function simpanPenugasanBaru() {
  const payload = {
    id_staf: document.getElementById('p-staf').value,
    id_pemilik: document.getElementById('p-pemilik').value,
    tahun_ajaran: document.getElementById('p-tahun').value
  };
  showLoading(true);
  const res = await api('penugasanSimpan', payload);
  showLoading(false);
  showToast(res.message, res.success ? 'success' : 'error');
  if (res.success) navigateTo('penugasan');
}

// ============================================
// PENGATURAN — tahun ajaran, bidang, program, templat WA (PRD 2.3)
// ============================================
async function renderPengaturan(user, content) {
  showLoading(true);
  const [pengaturan, bidang] = await Promise.all([api('pengaturanGet', {}), api('bidangList', {})]);
  showLoading(false);
  if (!pengaturan.success) return (content.innerHTML = errBox(pengaturan.message));
  const nilai = pengaturan.data;

  content.innerHTML = `
    <div class="card"><div class="card-header"><h3>Umum & Gateway WhatsApp</h3></div>
      <div class="card-body">
        <div class="field"><label>Nama Sekolah (kop dokumen cetak)</label><input id="s-nama-sekolah" value="${escapeHtml(nilai.nama_sekolah || '')}"></div>
        <div class="field"><label>Batas Maksimal Revisi</label><input type="number" id="s-batas-revisi" value="${escapeHtml(nilai.batas_revisi || '3')}"></div>
        <div class="field"><label>Penyedia Gateway WhatsApp</label><input id="s-wa-provider" value="${escapeHtml(nilai.wa_provider || '')}" placeholder="Fonnte / Wablas / lainnya"></div>
        <p class="field-hint">Token &amp; endpoint gateway WA disimpan terpisah di Script Properties (WA_TOKEN, WA_ENDPOINT) — tidak melalui formulir ini demi keamanan.</p>
        <button class="btn btn-primary" onclick="simpanPengaturanUmum()">Simpan</button>
      </div>
    </div>

    <div class="card"><div class="card-header"><h3>Templat Pesan WhatsApp</h3></div>
      <div class="card-body">
        ${['templat_wa_diajukan', 'templat_wa_keputusan', 'templat_wa_anggaran', 'templat_wa_perubahan', 'templat_wa_keputusan_perubahan'].map(k => `
          <div class="field"><label>${escapeHtml(k)}</label><textarea id="s-${k}">${escapeHtml(nilai[k] || '')}</textarea></div>`).join('')}
        <button class="btn btn-primary" onclick="simpanTemplatWA()">Simpan Templat</button>
      </div>
    </div>

    <div class="card"><div class="card-header"><h3>Bidang</h3></div>
      <div class="card-body">
        <div class="field-row">
          <div class="field"><label>Nama Bidang</label><input id="b-nama"></div>
          <div class="field"><label>Kode Bidang</label><input id="b-kode" placeholder="mis. KUR"></div>
        </div>
        <button class="btn btn-secondary" onclick="tambahBidangBaru()">Tambah Bidang</button>
      </div>
      <div class="table-wrap"><table class="data-table"><thead><tr><th>Nama Bidang</th><th>Kode</th><th>Pemilik</th></tr></thead>
        <tbody>${bidang.data.map(b => `<tr><td>${escapeHtml(b.nama_bidang)}</td><td class="mono">${escapeHtml(b.kode_bidang)}</td><td>${escapeHtml(b.nama_pemilik)}</td></tr>`).join('')}</tbody>
      </table></div>
    </div>`;
}

async function simpanPengaturanUmum() {
  const items = [
    { kunci: 'nama_sekolah', nilai: document.getElementById('s-nama-sekolah').value },
    { kunci: 'batas_revisi', nilai: document.getElementById('s-batas-revisi').value },
    { kunci: 'wa_provider', nilai: document.getElementById('s-wa-provider').value }
  ];
  showLoading(true);
  const res = await api('pengaturanSimpan', { items });
  showLoading(false);
  showToast(res.message, res.success ? 'success' : 'error');
}

async function simpanTemplatWA() {
  const kunciList = ['templat_wa_diajukan', 'templat_wa_keputusan', 'templat_wa_anggaran', 'templat_wa_perubahan', 'templat_wa_keputusan_perubahan'];
  const items = kunciList.map(k => ({ kunci: k, nilai: document.getElementById('s-' + k).value }));
  showLoading(true);
  const res = await api('pengaturanSimpan', { items });
  showLoading(false);
  showToast(res.message, res.success ? 'success' : 'error');
}

async function tambahBidangBaru() {
  const nama_bidang = document.getElementById('b-nama').value.trim();
  const kode_bidang = document.getElementById('b-kode').value.trim();
  if (!nama_bidang || !kode_bidang) return showToast('Nama dan kode bidang wajib diisi.', 'error');
  showLoading(true);
  const res = await api('bidangSimpan', { nama_bidang, kode_bidang });
  showLoading(false);
  showToast(res.message, res.success ? 'success' : 'error');
  if (res.success) { AppState.invalidate(); await AppState.muatMasterData(); navigateTo('pengaturan'); }
}

// ============================================
// LOG NOTIFIKASI WHATSAPP
// ============================================
async function renderLogNotif(user, content) {
  showLoading(true);
  const res = await api('logNotifikasiList', {});
  showLoading(false);
  if (!res.success) return (content.innerHTML = errBox(res.message));

  content.innerHTML = `<div class="card"><div class="card-header"><h3>Log Notifikasi WhatsApp (500 terbaru)</h3></div>
    <div class="table-wrap"><table class="data-table">
      <thead><tr><th>Waktu</th><th>Penerima</th><th>Pesan</th><th>Status</th><th></th></tr></thead>
      <tbody>${res.data.length ? res.data.map(n => `<tr>
        <td>${fmtTanggal(n.waktu)}</td><td class="mono">${escapeHtml(n.penerima)}</td><td>${escapeHtml(n.pesan)}</td>
        <td>${String(n.status_kirim).indexOf('TERKIRIM') === 0 ? '<span class="badge badge-diterima">TERKIRIM</span>' : '<span class="badge badge-ditolak">' + escapeHtml(n.status_kirim) + '</span>'}</td>
        <td>${String(n.status_kirim).indexOf('TERKIRIM') !== 0 ? `<button class="btn btn-secondary btn-sm" onclick="kirimUlangNotif('${n.id_notif}')">Kirim Ulang</button>` : ''}</td>
        </tr>`).join('') : '<tr><td colspan="5" class="empty-state">Belum ada log.</td></tr>'}</tbody>
    </table></div></div>`;
}

async function kirimUlangNotif(idNotif) {
  showLoading(true);
  const res = await api('notifikasiKirimUlang', { id_notif: idNotif });
  showLoading(false);
  showToast(res.message, res.success ? 'success' : 'error');
  navigateTo('lognotif');
}
