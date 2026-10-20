async function cetakDokumenProker(idProker, format) {
  showLoading(true);
  const res = await api('cetakProker', { id_proker: idProker, format });
  showLoading(false);
  if (!res.success) return showToast(res.message, 'error');
  showToast('Dokumen berhasil dibuat: ' + res.nama_file, 'success');
  window.open(res.url, '_blank');
}
