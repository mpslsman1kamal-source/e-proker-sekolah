// ============================================
// WAKA — Tambah Rincian RAB (kegiatan + uraian + volume + satuan, TANPA harga)
// Satu kegiatan boleh punya banyak baris uraian (lihat contoh RAB).
// ============================================
async function bukaModalRab(idProker) {
  const epoch = renderEpochSaatIni();
  const det = await api('prokerDetail', { id_proker: idProker });
  if (!masihRenderAktif(epoch)) return;
  if (!det.success) return showToast(det.message, 'error');
  if (!det.data.kegiatan.length) return showToast('Proker ini belum memiliki kegiatan. Tambahkan kegiatan terlebih dahulu.', 'error');

  const opsiKegiatan = det.data.kegiatan.map(k => `<option value="${k.id_kegiatan}">${escapeHtml(k.nama_kegiatan)}</option>`).join('');
  openModal('Tambah Rincian Anggaran (RAB)', `
    <div class="field"><label>Kegiatan <span class="req">[WAJIB]</span></label><select id="m-rab-kegiatan">${opsiKegiatan}</select></div>
    <div class="field"><label>Uraian / Komponen Belanja <span class="req">[WAJIB]</span></label>
      <textarea id="m-rab-uraian" placeholder="mis. Konsumsi Panitia & Pemateri"></textarea></div>
    <div class="field-row">
      <div class="field"><label>Volume <span class="req">[WAJIB]</span></label><input type="number" min="1" id="m-rab-volume" value="1"></div>
      <div class="field"><label>Satuan</label><input id="m-rab-satuan" placeholder="unit/paket/orang/kotak/buah/pcs"></div>
    </div>
    <p class="field-hint">Harga satuan akan diisi oleh Bendahara setelah rincian ini diajukan. Anda bisa menambahkan beberapa uraian untuk kegiatan yang sama.</p>
  `, `<button class="btn btn-secondary" onclick="closeModal()">Batal</button>
      <button class="btn btn-primary" onclick="simpanRabModal('${idProker}')">Simpan</button>`);
}

async function simpanRabModal(idProker) {
  const payload = {
    id_proker: idProker,
    id_kegiatan: document.getElementById('m-rab-kegiatan').value,
    uraian: document.getElementById('m-rab-uraian').value.trim(),
    volume: Number(document.getElementById('m-rab-volume').value),
    satuan: document.getElementById('m-rab-satuan').value.trim()
  };
  if (!payload.uraian || !(payload.volume > 0)) return showToast('Uraian dan volume wajib diisi dengan benar.', 'error');
  showLoading(true);
  const res = await api('anggaranRabSimpan', payload);
  showLoading(false);
  closeModal();
  showToast(res.message, res.success ? 'success' : 'error');
  if (res.success) navigateTo('proker-detail', idProker);
}

async function hapusAnggaranRab(idAnggaran, idProker) {
  if (!confirm('Hapus rincian RAB ini?')) return;
  showLoading(true);
  const res = await api('anggaranRabHapus', { id_anggaran: idAnggaran });
  showLoading(false);
  showToast(res.message, res.success ? 'success' : 'error');
  if (res.success) navigateTo('proker-detail', idProker);
}

// ============================================
// BENDAHARA — Isi Harga: pilih uraian dari dropdown (hasil RAB Waka), isi harga satuan,
// jumlah total terhitung otomatis. Tidak lagi mengetik ulang uraian/volume/satuan.
// ============================================
async function bukaModalHargaBendahara(idProker) {
  const epoch = renderEpochSaatIni();
  const det = await api('prokerDetail', { id_proker: idProker });
  if (!masihRenderAktif(epoch)) return;
  if (!det.success) return showToast(det.message, 'error');

  const belumDihargai = det.data.anggaran.filter(a => a.status_harga === 'Menunggu Harga');
  if (!belumDihargai.length) {
    return showToast('Belum ada rincian RAB yang menunggu harga. Minta Waka/Koordinator menambahkan rincian terlebih dahulu.', 'error');
  }

  const kegById = {}; det.data.kegiatan.forEach(k => kegById[k.id_kegiatan] = k.nama_kegiatan);
  const opsiUraian = belumDihargai.map(a => `<option value="${a.id_anggaran}" data-volume="${a.volume}" data-satuan="${escapeHtml(a.satuan || '')}">
    ${escapeHtml((kegById[a.id_kegiatan] || '-') + ' — ' + a.uraian + ' (' + a.volume + ' ' + (a.satuan || '') + ')')}</option>`).join('');
  const pertama = belumDihargai[0];

  openModal('Isi Harga Rincian Anggaran', `
    <div class="field"><label>Uraian (dari RAB Waka) <span class="req">[WAJIB]</span></label>
      <select id="m-harga-uraian" onchange="perbaruiRingkasanHarga()">${opsiUraian}</select></div>
    <p class="field-hint">Volume: <strong id="m-harga-volume">${pertama.volume}</strong> <span id="m-harga-satuan-label">${escapeHtml(pertama.satuan || '')}</span> — data ini diisi oleh Waka dan tidak dapat diubah di sini.</p>
    <div class="field"><label>Harga Satuan (Rp) <span class="req">[WAJIB]</span></label>
      <input type="number" min="0" id="m-harga-satuan" value="0" oninput="perbaruiRingkasanHarga()"></div>
    <div class="field"><label>Jumlah Total (otomatis)</label><input type="text" id="m-harga-total" value="Rp 0" disabled></div>
    <div class="field"><label>Sumber Dana</label><input id="m-harga-sumber" placeholder="BOS / Komite / lainnya"></div>
  `, `<button class="btn btn-secondary" onclick="closeModal()">Batal</button>
      <button class="btn btn-primary" onclick="simpanHargaModal('${idProker}')">Simpan</button>`);
  perbaruiRingkasanHarga();
}

/** Hitung ulang Volume/Satuan/Jumlah Total secara langsung saat dropdown atau harga berubah. */
function perbaruiRingkasanHarga() {
  const sel = document.getElementById('m-harga-uraian');
  if (!sel) return;
  const opt = sel.options[sel.selectedIndex];
  const volume = Number(opt.dataset.volume || 0);
  const satuan = opt.dataset.satuan || '';
  const harga = Number(document.getElementById('m-harga-satuan').value) || 0;
  document.getElementById('m-harga-volume').textContent = volume;
  document.getElementById('m-harga-satuan-label').textContent = satuan;
  document.getElementById('m-harga-total').value = fmtRupiah(volume * harga);
}

async function simpanHargaModal(idProker) {
  const payload = {
    id_anggaran: document.getElementById('m-harga-uraian').value,
    harga_satuan: Number(document.getElementById('m-harga-satuan').value),
    sumber_dana: document.getElementById('m-harga-sumber').value.trim()
  };
  if (!(payload.harga_satuan >= 0)) return showToast('Harga satuan wajib diisi dengan benar.', 'error');
  showLoading(true);
  const res = await api('anggaranSimpan', payload);
  showLoading(false);
  closeModal();
  showToast(res.message, res.success ? 'success' : 'error');
  if (res.success) navigateTo('proker-detail', idProker);
}

// ============================================
// BENDAHARA — hapus rincian yang sudah ia hargai sendiri
// ============================================
async function hapusAnggaran(idAnggaran, idProker) {
  if (!confirm('Hapus rincian anggaran ini (termasuk harga yang sudah diisi)?')) return;
  showLoading(true);
  const res = await api('anggaranHapus', { id_anggaran: idAnggaran });
  showLoading(false);
  showToast(res.message, res.success ? 'success' : 'error');
  if (res.success) navigateTo('proker-detail', idProker);
}
