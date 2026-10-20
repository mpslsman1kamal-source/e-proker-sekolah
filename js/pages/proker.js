// ============================================
// DAFTAR PROKER (US-13: cari & filter)
// ============================================
let _prokerCache = [];

async function renderProkerList(user, content, filterAwal) {
  const epoch = renderEpochSaatIni();
  showLoading(true);
  const res = await api('prokerList', filterAwal || {});
  showLoading(false);
  if (!masihRenderAktif(epoch)) return; // pengguna sudah pindah halaman — batalkan render basi
  if (!res.success) return (content.innerHTML = errBox(res.message));
  _prokerCache = res.data;

  const bisaBuat = user.peran === 'Waka/Koordinator';
  const bidangOpsi = AppState.bidang.map(b => `<option value="${b.id_bidang}">${escapeHtml(b.nama_bidang)}</option>`).join('');
  const adaYangBisaDiajukan = bisaBuat && _prokerCache.some(p => ['Draft', 'Ditolak'].indexOf(p.status) !== -1 && !p.terkunci);

  content.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h3>${escapeHtml(PAGE_TITLE[currentRoute] || 'Daftar Proker')}</h3>
        <div class="flex gap-sm">
          ${adaYangBisaDiajukan ? `<button class="btn btn-secondary btn-sm" onclick="ajukanSemuaProker()"><span class="mi" style="font-size:14px;">forward_to_inbox</span>Ajukan Semua ke Kepala Sekolah</button>` : ''}
          ${bisaBuat ? `<button class="btn btn-primary btn-sm" onclick="navigateTo('proker-form')"><span class="mi" style="font-size:14px;">add</span>Proker Baru</button>` : ''}
        </div>
      </div>
      <div class="table-toolbar">
        <input type="text" id="filter-cari" placeholder="Cari judul proker...">
        <select id="filter-status">
          <option value="">Semua Status</option>
          ${['Draft', 'Diajukan', 'Diterima', 'Ditolak', 'Anggaran Disusun'].map(s => `<option value="${s}" ${filterAwal && filterAwal.status === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
        <select id="filter-bidang"><option value="">Semua Bidang</option>${bidangOpsi}</select>
      </div>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Judul</th><th>Bidang</th><th>Pemilik</th><th>Semester</th><th>Status</th><th>Revisi</th><th>Diubah</th><th></th></tr></thead>
        <tbody id="proker-table-body"></tbody>
      </table></div>
    </div>`;

  renderProkerRows(_prokerCache);
  document.getElementById('filter-cari').addEventListener('input', terapkanFilterProker);
  document.getElementById('filter-status').addEventListener('change', terapkanFilterProker);
  document.getElementById('filter-bidang').addEventListener('change', terapkanFilterProker);
}

function terapkanFilterProker() {
  const q = document.getElementById('filter-cari').value.toLowerCase();
  const status = document.getElementById('filter-status').value;
  const bidang = document.getElementById('filter-bidang').value;
  const hasil = _prokerCache.filter(p =>
    (!q || p.judul.toLowerCase().includes(q)) &&
    (!status || p.status === status) &&
    (!bidang || p.id_bidang === bidang)
  );
  renderProkerRows(hasil);
}

function renderProkerRows(list) {
  const tbody = document.getElementById('proker-table-body');
  if (!list.length) { tbody.innerHTML = '<tr><td colspan="8" class="empty-state">Belum ada proker.</td></tr>'; return; }
  tbody.innerHTML = list.map(p => `
    <tr style="cursor:pointer;" onclick="navigateTo('proker-detail','${p.id_proker}')">
      <td>${escapeHtml(p.judul)}${p.terkunci ? ' <span class="badge badge-ditolak">TERKUNCI</span>' : ''}</td>
      <td>${escapeHtml(p.nama_bidang)}</td>
      <td>${escapeHtml(p.nama_pemilik)}</td>
      <td>${escapeHtml(p.semester)}</td>
      <td>${badgeStatus(p.status)}</td>
      <td class="num">${p.jumlah_revisi || 0}</td>
      <td>${fmtTanggal(p.diubah_pada)}</td>
      <td><button class="btn btn-secondary btn-sm">Buka</button></td>
    </tr>`).join('');
}

// ============================================
// FORM PROKER (buat/ubah draft + kegiatan) — US-04, US-05
// Autosave draft lokal (Optimistic UI, prinsip 2 gas-instant-ux)
// ============================================
let _kegiatanRows = [];

async function renderProkerForm(user, content, idProker) {
  const epoch = renderEpochSaatIni();
  let proker = null, kegiatanAwal = [];
  const draftKey = 'eproker_draft_' + (idProker || 'baru');

  if (idProker) {
    showLoading(true);
    const res = await api('prokerDetail', { id_proker: idProker });
    showLoading(false);
    if (!masihRenderAktif(epoch)) return;
    if (!res.success) return (content.innerHTML = errBox(res.message));
    proker = res.data.proker; kegiatanAwal = res.data.kegiatan;
    if (['Draft', 'Ditolak'].indexOf(proker.status) === -1) {
      content.innerHTML = errBox('Proker hanya dapat diubah saat berstatus Draft atau Ditolak.');
      return;
    }
  } else {
    const draft = localStorage.getItem(draftKey);
    if (draft) { try { const d = JSON.parse(draft); kegiatanAwal = d.kegiatan || []; } catch (e) {} }
  }

  _kegiatanRows = kegiatanAwal.length ? kegiatanAwal : [];
  const bidangOpsi = AppState.bidang.map(b => `<option value="${b.id_bidang}" ${proker && proker.id_bidang === b.id_bidang ? 'selected' : ''}>${escapeHtml(b.nama_bidang)}</option>`).join('');
  const tahunOpsi = AppState.tahunAjaran.map(t => `<option value="${t.id_tahun_ajaran}" ${proker && proker.id_tahun_ajaran === t.id_tahun_ajaran ? 'selected' : ''}>${escapeHtml(t.nama)}</option>`).join('');

  content.innerHTML = `
    <div class="card"><div class="card-header"><h3>${idProker ? 'Ubah Draft Proker' : 'Proker Baru'}</h3></div>
      <div class="card-body">
        <div class="field-row">
          <div class="field"><label>Bidang <span class="req">[WAJIB]</span></label><select id="f-bidang">${bidangOpsi}</select></div>
          <div class="field"><label>Tahun Ajaran <span class="req">[WAJIB]</span></label><select id="f-tahun">${tahunOpsi}</select></div>
          <div class="field"><label>Semester <span class="req">[WAJIB]</span></label>
            <select id="f-semester"><option ${proker && proker.semester === 'Ganjil' ? 'selected' : ''}>Ganjil</option><option ${proker && proker.semester === 'Genap' ? 'selected' : ''}>Genap</option></select>
          </div>
        </div>
        <div class="field"><label>Judul Proker <span class="req">[WAJIB]</span></label><input type="text" id="f-judul" value="${escapeHtml(proker ? proker.judul : '')}"></div>
        <div class="field"><label>Ringkasan Tujuan</label><textarea id="f-ringkasan">${escapeHtml(proker ? proker.ringkasan_tujuan : '')}</textarea></div>
      </div>
    </div>

    <div class="card">
      <div class="card-header"><h3>Tabel Kegiatan (format baku)</h3><button class="btn btn-secondary btn-sm" onclick="tambahBarisKegiatan()"><span class="mi" style="font-size:14px;">add</span>Tambah Kegiatan</button></div>
      <div class="card-body" id="kegiatan-list"></div>
    </div>

    <div class="flex gap-sm">
      <button class="btn btn-primary" onclick="simpanDraftProker('${idProker || ''}')">SIMPAN DRAFT</button>
      <button class="btn btn-secondary" onclick="navigateTo('proker-list')">BATAL</button>
    </div>`;

  renderBarisKegiatan();
  ['f-bidang', 'f-tahun', 'f-semester', 'f-judul', 'f-ringkasan'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => autosaveDraftLokal(draftKey));
  });
}

function tambahBarisKegiatan() {
  _kegiatanRows.push({ nama_program: '', nama_kegiatan: '', tujuan: '', waktu: '', frekuensi_angka: 1, frekuensi_satuan: 'per tahun', durasi_angka: 1, durasi_satuan: 'jam', personel_jumlah: 1, personel_rincian: '', penanggung_jawab: '', indikator_keberhasilan: '' });
  renderBarisKegiatan();
}

function hapusBarisKegiatan(idx) { _kegiatanRows.splice(idx, 1); renderBarisKegiatan(); }

function renderBarisKegiatan() {
  const wrap = document.getElementById('kegiatan-list');
  if (!_kegiatanRows.length) { wrap.innerHTML = '<p class="text-muted">Belum ada kegiatan. Klik "Tambah Kegiatan".</p>'; return; }
  wrap.innerHTML = _kegiatanRows.map((k, i) => `
    <div class="kegiatan-row">
      <button class="btn btn-danger btn-sm remove-btn" onclick="hapusBarisKegiatan(${i})">✕</button>
      <div class="field-row">
        <div class="field"><label>Program</label><input data-i="${i}" data-f="nama_program" value="${escapeHtml(k.nama_program)}"></div>
        <div class="field"><label>Kegiatan <span class="req">[WAJIB]</span></label><input data-i="${i}" data-f="nama_kegiatan" value="${escapeHtml(k.nama_kegiatan)}"></div>
        <div class="field"><label>Waktu (bulan)</label><input data-i="${i}" data-f="waktu" value="${escapeHtml(k.waktu)}" placeholder="mis. Juli–Agustus"></div>
      </div>
      <div class="field"><label>Tujuan Kegiatan <span class="req">[WAJIB]</span></label><textarea data-i="${i}" data-f="tujuan">${escapeHtml(k.tujuan)}</textarea></div>
      <div class="field-row">
        <div class="field"><label>Frekuensi</label><input type="number" min="1" data-i="${i}" data-f="frekuensi_angka" value="${k.frekuensi_angka}"></div>
        <div class="field"><label>Satuan Frekuensi</label>
          <select data-i="${i}" data-f="frekuensi_satuan">${['per tahun', 'per semester', 'per bulan'].map(s => `<option ${k.frekuensi_satuan === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
        </div>
        <div class="field"><label>Durasi</label><input type="number" min="1" data-i="${i}" data-f="durasi_angka" value="${k.durasi_angka}"></div>
        <div class="field"><label>Satuan Durasi</label>
          <select data-i="${i}" data-f="durasi_satuan">${['jam', 'hari', 'minggu'].map(s => `<option ${k.durasi_satuan === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
        </div>
      </div>
      <div class="field-row">
        <div class="field"><label>Jumlah Personel</label><input type="number" min="1" data-i="${i}" data-f="personel_jumlah" value="${k.personel_jumlah}"></div>
        <div class="field"><label>Rincian Peran Personel</label><input data-i="${i}" data-f="personel_rincian" value="${escapeHtml(k.personel_rincian)}"></div>
        <div class="field"><label>Penanggung Jawab</label><input data-i="${i}" data-f="penanggung_jawab" value="${escapeHtml(k.penanggung_jawab)}"></div>
      </div>
      <div class="field"><label>Indikator Keberhasilan <span class="req">[WAJIB]</span></label><textarea data-i="${i}" data-f="indikator_keberhasilan">${escapeHtml(k.indikator_keberhasilan)}</textarea></div>
    </div>`).join('');

  wrap.querySelectorAll('[data-f]').forEach(el => el.addEventListener('input', (e) => {
    const i = Number(e.target.dataset.i), f = e.target.dataset.f;
    _kegiatanRows[i][f] = e.target.type === 'number' ? Number(e.target.value) : e.target.value;
  }));
}

function kumpulkanFormProker() {
  return {
    id_bidang: document.getElementById('f-bidang').value,
    id_tahun_ajaran: document.getElementById('f-tahun').value,
    semester: document.getElementById('f-semester').value,
    judul: document.getElementById('f-judul').value.trim(),
    ringkasan_tujuan: document.getElementById('f-ringkasan').value.trim(),
    kegiatan: _kegiatanRows
  };
}

function autosaveDraftLokal(key) {
  localStorage.setItem(key, JSON.stringify({ kegiatan: _kegiatanRows, waktu: Date.now() }));
}

async function simpanDraftProker(idProker) {
  const payload = kumpulkanFormProker();
  if (idProker) payload.id_proker = idProker;
  if (!payload.judul) return showToast('Judul proker wajib diisi.', 'error');

  showLoading(true);
  const res = await api('prokerSimpanDraft', payload);
  showLoading(false);
  if (!res.success) return showToast(res.message, 'error');
  localStorage.removeItem('eproker_draft_' + (idProker || 'baru'));
  showToast(res.message, 'success');
  navigateTo('proker-detail', res.id_proker);
}

// ============================================
// DETAIL PROKER — alur ajukan / validasi / revisi / perubahan / cetak
// ============================================
async function renderProkerDetail(user, content, idProker) {
  const epoch = renderEpochSaatIni();
  showLoading(true);
  const res = await api('prokerDetail', { id_proker: idProker });
  showLoading(false);
  if (!masihRenderAktif(epoch)) return;
  if (!res.success) return (content.innerHTML = errBox(res.message));
  const d = res.data, p = d.proker;
  const bidang = AppState.bidang.find(b => b.id_bidang === p.id_bidang);

  let aksiHtml = '';
  if (user.peran === 'Waka/Koordinator' && p.id_pemilik === user.id_pengguna) {
    if (['Draft', 'Ditolak'].indexOf(p.status) !== -1 && !p.terkunci) {
      aksiHtml += `<button class="btn btn-secondary" onclick="navigateTo('proker-form','${p.id_proker}')">UBAH DRAFT</button>`;
      if (p.status === 'Ditolak') aksiHtml += `<button class="btn btn-primary" onclick="bukaModalRevisi('${p.id_proker}')">AJUKAN REVISI</button>`;
      else aksiHtml += `<button class="btn btn-primary" onclick="ajukanProker('${p.id_proker}')">AJUKAN KE KEPALA SEKOLAH</button>`;
    }
    if (['Diterima', 'Anggaran Disusun'].indexOf(p.status) !== -1) {
      aksiHtml += `<button class="btn btn-secondary" onclick="bukaModalPerubahan('${p.id_proker}')">AJUKAN PERUBAHAN</button>`;
    }
  }
  if (user.peran === 'Kepala Sekolah' && p.status === 'Diajukan') {
    aksiHtml += `<button class="btn btn-primary" onclick="bukaModalValidasi('${p.id_proker}','Diterima')">TERIMA</button>
                 <button class="btn btn-danger" onclick="bukaModalValidasi('${p.id_proker}','Ditolak')">TOLAK</button>`;
  }
  if (['Diterima', 'Anggaran Disusun', 'Ditolak'].indexOf(p.status) !== -1 || user.peran === 'Superadmin') {
    aksiHtml += `<button class="btn btn-secondary" onclick="cetakDokumenProker('${p.id_proker}','pdf')">CETAK PDF</button>
                 <button class="btn btn-secondary" onclick="cetakDokumenProker('${p.id_proker}','docx')">CETAK WORD</button>`;
  }

  content.innerHTML = `
    <div class="card">
      <div class="card-header"><h3>${escapeHtml(p.judul)}</h3>${badgeStatus(p.status)}</div>
      <div class="card-body">
        <div class="field-row" style="margin-bottom:var(--space-md);">
          <div><span class="field-hint">BIDANG</span><div>${escapeHtml(bidang ? bidang.nama_bidang : '-')}</div></div>
          <div><span class="field-hint">SEMESTER / TAHUN AJARAN</span><div>${escapeHtml(p.semester)} — ${escapeHtml((AppState.tahunAjaran.find(t => t.id_tahun_ajaran === p.id_tahun_ajaran) || {}).nama || '-')}</div></div>
          <div><span class="field-hint">REVISI</span><div>${p.jumlah_revisi || 0} dari ${3}x${p.terkunci ? ' — <strong>TERKUNCI</strong>' : ''}</div></div>
        </div>
        <p>${escapeHtml(p.ringkasan_tujuan || '-')}</p>
        ${p.catatan_terakhir ? `<div class="login-error" style="margin-top:var(--space-md);"><strong>Catatan terakhir:</strong> ${escapeHtml(p.catatan_terakhir)}</div>` : ''}
        <div class="flex gap-sm" style="margin-top:var(--space-md);flex-wrap:wrap;">${aksiHtml}</div>
      </div>
    </div>

    ${cardTable('Tabel Kegiatan', ['Program', 'Kegiatan', 'Waktu', 'Frekuensi', 'Durasi', 'Penanggung Jawab', 'Indikator'],
      d.kegiatan.map(k => [escapeHtml(k.nama_program), escapeHtml(k.nama_kegiatan), escapeHtml(k.waktu), k.frekuensi_angka + ' ' + escapeHtml(k.frekuensi_satuan), k.durasi_angka + ' ' + escapeHtml(k.durasi_satuan), escapeHtml(k.penanggung_jawab), escapeHtml(k.indikator_keberhasilan)]))}

    ${d.ringkasan_program.length ? cardTable('Ringkasan Jumlah Kegiatan per Program', ['Program', 'Jumlah Kegiatan', 'Total Pelaksanaan / Tahun'],
      d.ringkasan_program.map(r => [escapeHtml(r.nama_program), r.jumlah_kegiatan, r.total_pelaksanaan_per_tahun])) : ''}

    ${['Diterima', 'Anggaran Disusun'].indexOf(p.status) !== -1 && ['Bendahara', 'Kepala Sekolah', 'Superadmin', 'Waka/Koordinator'].indexOf(user.peran) !== -1
      ? renderPanelAnggaran(d, user) : ''}

    ${d.perubahan.length ? cardTable('Riwayat Pengajuan Perubahan', ['Uraian', 'Alasan', 'Status', 'Catatan Kepsek', 'Waktu'],
      d.perubahan.map(c => [escapeHtml(c.uraian_perubahan), escapeHtml(c.alasan), badgeStatus(c.status), escapeHtml(c.catatan_kepsek), fmtTanggal(c.waktu)])) : ''}

    ${d.revisi.length ? cardTable('Riwayat Revisi', ['Putaran', 'Catatan Perbaikan', 'Waktu'],
      d.revisi.map(r => [r.putaran, escapeHtml(r.catatan_perbaikan), fmtTanggal(r.waktu)])) : ''}

    ${d.validasi.length ? cardTable('Riwayat Validasi', ['Putaran', 'Keputusan', 'Catatan', 'Waktu'],
      d.validasi.map(v => [v.putaran, badgeStatus(v.keputusan), escapeHtml(v.catatan), fmtTanggal(v.waktu)])) : ''}

    ${d.audit.length ? cardTable('Jejak Audit', ['Aksi', 'Nilai Lama', 'Nilai Baru', 'Pelaku', 'Waktu'],
      d.audit.map(a => [escapeHtml(a.aksi), escapeHtml(a.nilai_lama), escapeHtml(a.nilai_baru), escapeHtml(a.pelaku), fmtTanggal(a.waktu)])) : ''}
  `;

  wireModalAksiProker();
}

// ============================================
// AKSI ALUR KERJA — ajukan, validasi, revisi, perubahan
// ============================================
function wireModalAksiProker() { /* tombol aksi sudah pakai onclick inline, tidak perlu wiring tambahan */ }

async function ajukanProker(idProker) {
  if (!confirm('Ajukan proker ini ke Kepala Sekolah?')) return;
  showLoading(true);
  const res = await api('prokerAjukan', { id_proker: idProker });
  showLoading(false);
  showToast(res.message, res.success ? 'success' : 'error');
  if (res.success) navigateTo('proker-detail', idProker);
}

/** FITUR BARU: ajukan sekaligus semua proker milik Waka yang berstatus Draft/Ditolak (selain ajukan per-proker). */
async function ajukanSemuaProker() {
  if (!confirm('Ajukan SEMUA proker Anda yang berstatus Draft/Ditolak sekaligus ke Kepala Sekolah?\n\nProker tanpa kegiatan atau yang sedang terkunci akan dilewati otomatis.')) return;
  showLoading(true);
  const res = await api('prokerAjukanSemua', {});
  showLoading(false);
  showToast(res.message, res.success ? 'success' : 'error');
  if (res.success) navigateTo('proker-list');
}

function bukaModalValidasi(idProker, keputusan) {
  openModal(keputusan === 'Diterima' ? 'Terima Proker' : 'Tolak Proker', `
    <div class="field"><label>Catatan ${keputusan === 'Ditolak' ? '<span class="req">[WAJIB]</span>' : '(opsional)'}</label>
      <textarea id="modal-catatan-validasi" placeholder="Tulis catatan untuk pemilik proker..."></textarea></div>
  `, `<button class="btn btn-secondary" onclick="closeModal()">Batal</button>
      <button class="btn ${keputusan === 'Diterima' ? 'btn-primary' : 'btn-danger'}" onclick="kirimValidasi('${idProker}','${keputusan}')">Simpan Keputusan</button>`);
}

async function kirimValidasi(idProker, keputusan) {
  const catatan = document.getElementById('modal-catatan-validasi').value.trim();
  if (keputusan === 'Ditolak' && !catatan) return showToast('Catatan wajib diisi saat menolak.', 'error');
  showLoading(true);
  const res = await api('prokerValidasi', { id_proker: idProker, keputusan, catatan });
  showLoading(false);
  closeModal();
  showToast(res.message, res.success ? 'success' : 'error');
  if (res.success) navigateTo('proker-detail', idProker);
}

function bukaModalRevisi(idProker) {
  openModal('Ajukan Revisi', `
    <div class="field"><label>Catatan Perbaikan <span class="req">[WAJIB]</span></label>
      <textarea id="modal-catatan-revisi" placeholder="Jelaskan perbaikan yang sudah dilakukan..."></textarea></div>
    <p class="field-hint">Perbarui juga tabel kegiatan melalui tombol "Ubah Draft" sebelum mengajukan revisi jika diperlukan.</p>
  `, `<button class="btn btn-secondary" onclick="closeModal()">Batal</button>
      <button class="btn btn-primary" onclick="kirimRevisi('${idProker}')">Ajukan Ulang</button>`);
}

async function kirimRevisi(idProker) {
  const catatan_perbaikan = document.getElementById('modal-catatan-revisi').value.trim();
  if (!catatan_perbaikan) return showToast('Catatan perbaikan wajib diisi.', 'error');
  showLoading(true);
  const res = await api('prokerRevisi', { id_proker: idProker, catatan_perbaikan });
  showLoading(false);
  closeModal();
  showToast(res.message, res.success ? 'success' : 'error');
  if (res.success) navigateTo('proker-detail', idProker);
}

function bukaModalPerubahan(idProker) {
  openModal('Ajukan Perubahan Proker', `
    <div class="field"><label>Uraian Perubahan <span class="req">[WAJIB]</span></label><textarea id="modal-uraian-perubahan"></textarea></div>
    <div class="field"><label>Alasan <span class="req">[WAJIB]</span></label><textarea id="modal-alasan-perubahan"></textarea></div>
  `, `<button class="btn btn-secondary" onclick="closeModal()">Batal</button>
      <button class="btn btn-primary" onclick="kirimPerubahan('${idProker}')">Kirim ke Kepala Sekolah</button>`);
}

async function kirimPerubahan(idProker) {
  const uraian_perubahan = document.getElementById('modal-uraian-perubahan').value.trim();
  const alasan = document.getElementById('modal-alasan-perubahan').value.trim();
  if (!uraian_perubahan || !alasan) return showToast('Uraian dan alasan wajib diisi.', 'error');
  showLoading(true);
  const res = await api('prokerAjukanPerubahan', { id_proker: idProker, uraian_perubahan, alasan });
  showLoading(false);
  closeModal();
  showToast(res.message, res.success ? 'success' : 'error');
  if (res.success) navigateTo('proker-detail', idProker);
}

// ============================================
// ANTREAN PERUBAHAN (Kepala Sekolah) — US-11
// PERFORMA: dulu memanggil prokerDetail() berulang per proker (N+1 — gas-scale-turbo gejala I).
// Sekarang 1x panggilan server lewat route gabungan perubahanAntreanList.
// ============================================
async function renderAntreanPerubahan(user, content) {
  const epoch = renderEpochSaatIni();
  showLoading(true);
  const res = await api('perubahanAntreanList', {});
  showLoading(false);
  if (!masihRenderAktif(epoch)) return;
  if (!res.success) return (content.innerHTML = errBox(res.message));

  content.innerHTML = `<div class="card"><div class="card-header"><h3>Antrean Pengajuan Perubahan</h3></div>
    <div class="table-wrap"><table class="data-table">
      <thead><tr><th>Proker</th><th>Uraian Perubahan</th><th>Alasan</th><th>Waktu</th><th></th></tr></thead>
      <tbody>${res.data.length ? res.data.map(c => `
        <tr><td>${escapeHtml(c.judul_proker)}</td><td>${escapeHtml(c.uraian_perubahan)}</td><td>${escapeHtml(c.alasan)}</td><td>${fmtTanggal(c.waktu)}</td>
        <td class="flex gap-sm">
          <button class="btn btn-primary btn-sm" onclick="putuskanPerubahan('${c.id_perubahan}','Disetujui')">Setujui</button>
          <button class="btn btn-danger btn-sm" onclick="putuskanPerubahan('${c.id_perubahan}','Ditolak')">Tolak</button>
        </td></tr>`).join('') : '<tr><td colspan="5" class="empty-state">Tidak ada pengajuan perubahan menunggu.</td></tr>'}</tbody>
    </table></div></div>`;
}

async function putuskanPerubahan(idPerubahan, keputusan) {
  const catatan_kepsek = keputusan === 'Ditolak' ? (prompt('Catatan penolakan (opsional):') || '') : '';
  showLoading(true);
  const res = await api('prokerKeputusanPerubahan', { id_perubahan: idPerubahan, keputusan, catatan_kepsek });
  showLoading(false);
  showToast(res.message, res.success ? 'success' : 'error');
  if (res.success) navigateTo('antrean-perubahan');
}

function renderPanelAnggaran(d, user) {
  const total = d.anggaran.reduce((s, a) => s + Number(a.total || 0), 0);
  const bisaUbah = user.peran === 'Bendahara';
  return `<div class="card">
    <div class="card-header"><h3>Rincian Anggaran</h3>${bisaUbah ? `<button class="btn btn-secondary btn-sm" onclick="bukaModalAnggaran('${d.proker.id_proker}','${d.proker.id_proker && d.kegiatan[0] ? d.kegiatan[0].id_kegiatan : ''}')"><span class="mi" style="font-size:14px;">add</span>Tambah Rincian</button>` : ''}</div>
    <div class="table-wrap"><table class="data-table">
      <thead><tr><th>Kegiatan</th><th>Uraian</th><th class="num">Volume</th><th>Satuan</th><th class="num">Harga Satuan</th><th class="num">Total</th><th>Sumber Dana</th>${bisaUbah ? '<th></th>' : ''}</tr></thead>
      <tbody>${d.anggaran.length ? d.anggaran.map(a => {
        const keg = d.kegiatan.find(k => k.id_kegiatan === a.id_kegiatan);
        return `<tr><td>${escapeHtml(keg ? keg.nama_kegiatan : '-')}</td><td>${escapeHtml(a.uraian)}</td><td class="num">${a.volume}</td><td>${escapeHtml(a.satuan)}</td><td class="num">${fmtRupiah(a.harga_satuan)}</td><td class="num">${fmtRupiah(a.total)}</td><td>${escapeHtml(a.sumber_dana)}</td>${bisaUbah ? `<td><button class="btn btn-danger btn-sm" onclick="hapusAnggaran('${a.id_anggaran}','${d.proker.id_proker}')">Hapus</button></td>` : ''}</tr>`;
      }).join('') : `<tr><td colspan="8" class="empty-state">Anggaran belum disusun.</td></tr>`}</tbody>
      <tfoot><tr><td colspan="${bisaUbah ? 5 : 5}" style="text-align:right;font-weight:700;">TOTAL</td><td class="num" style="font-weight:700;">${fmtRupiah(total)}</td><td colspan="2"></td></tr></tfoot>
    </table></div>
  </div>`;
}
