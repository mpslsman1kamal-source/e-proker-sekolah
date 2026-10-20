async function bukaModalAnggaran(idProker, idKegiatanDefault) {
  const epoch = renderEpochSaatIni();
  const det = await api('prokerDetail', { id_proker: idProker });
  if (!masihRenderAktif(epoch)) return; // pengguna sudah pindah halaman — jangan munculkan modal basi
  if (!det.success) return showToast(det.message, 'error');
  const opsiKegiatan = det.data.kegiatan.map(k => `<option value="${k.id_kegiatan}" ${k.id_kegiatan === idKegiatanDefault ? 'selected' : ''}>${escapeHtml(k.nama_kegiatan)}</option>`).join('');

  openModal('Tambah Rincian Anggaran', `
    <div class="field"><label>Kegiatan <span class="req">[WAJIB]</span></label><select id="m-ang-kegiatan">${opsiKegiatan}</select></div>
    <div class="field"><label>Uraian <span class="req">[WAJIB]</span></label><input id="m-ang-uraian"></div>
    <div class="field-row">
      <div class="field"><label>Volume <span class="req">[WAJIB]</span></label><input type="number" min="1" id="m-ang-volume" value="1"></div>
      <div class="field"><label>Satuan</label><input id="m-ang-satuan" placeholder="unit/paket/orang"></div>
      <div class="field"><label>Harga Satuan (Rp) <span class="req">[WAJIB]</span></label><input type="number" min="0" id="m-ang-harga" value="0"></div>
    </div>
    <div class="field"><label>Sumber Dana</label><input id="m-ang-sumber" placeholder="BOS / Komite / lainnya"></div>
  `, `<button class="btn btn-secondary" onclick="closeModal()">Batal</button>
      <button class="btn btn-primary" onclick="simpanAnggaranModal('${idProker}')">Simpan</button>`);
}

async function simpanAnggaranModal(idProker) {
  const payload = {
    id_proker: idProker,
    id_kegiatan: document.getElementById('m-ang-kegiatan').value,
    uraian: document.getElementById('m-ang-uraian').value.trim(),
    volume: Number(document.getElementById('m-ang-volume').value),
    satuan: document.getElementById('m-ang-satuan').value.trim(),
    harga_satuan: Number(document.getElementById('m-ang-harga').value),
    sumber_dana: document.getElementById('m-ang-sumber').value.trim()
  };
  if (!payload.uraian || !(payload.volume > 0)) return showToast('Uraian dan volume wajib diisi dengan benar.', 'error');

  showLoading(true);
  const res = await api('anggaranSimpan', payload);
  showLoading(false);
  closeModal();
  showToast(res.message, res.success ? 'success' : 'error');
  if (res.success) navigateTo('proker-detail', idProker);
}

async function hapusAnggaran(idAnggaran, idProker) {
  if (!confirm('Hapus rincian anggaran ini?')) return;
  showLoading(true);
  const res = await api('anggaranHapus', { id_anggaran: idAnggaran });
  showLoading(false);
  showToast(res.message, res.success ? 'success' : 'error');
  if (res.success) navigateTo('proker-detail', idProker);
}
