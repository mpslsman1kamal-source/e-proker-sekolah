async function renderDashboard(user, content) {
  showLoading(true);
  let html = '';

  if (user.peran === 'Superadmin') {
    const res = await api('dashboardSuperadmin', {});
    showLoading(false);
    if (!res.success) return (content.innerHTML = errBox(res.message));
    const d = res.data;
    html += statGrid([
      ['Total Proker', d.total_proker],
      ['Draft (Belum Dikerjakan)', d.rekap_status['Draft'] || 0],
      ['Diajukan', d.rekap_status['Diajukan'] || 0],
      ['Diterima', d.rekap_status['Diterima'] || 0],
      ['Ditolak', d.rekap_status['Ditolak'] || 0],
      ['Anggaran Disusun', d.rekap_status['Anggaran Disusun'] || 0]
    ]);
    html += cardTable('Rekap Proker per Bidang', ['Bidang', 'Total', 'Belum Dikerjakan', 'Selesai Divalidasi'],
      d.per_bidang.map(b => [escapeHtml(b.nama_bidang), b.total, b.belum_dikerjakan, b.selesai_divalidasi]));
    if (d.bidang_belum_mulai.length) {
      html += `<div class="card"><div class="card-header"><h3>Bidang Belum Mulai Menyusun</h3></div>
        <div class="card-body">${d.bidang_belum_mulai.map(b => `<span class="badge badge-ditolak" style="margin-right:6px;">${escapeHtml(b)}</span>`).join('')}</div></div>`;
    }
  } else if (user.peran === 'Kepala Sekolah') {
    const res = await api('dashboardKepsek', {});
    showLoading(false);
    if (!res.success) return (content.innerHTML = errBox(res.message));
    const d = res.data;
    html += statGrid([
      ['Menunggu Validasi', d.antrean_validasi],
      ['Menunggu Persetujuan Perubahan', d.antrean_perubahan]
    ]);
    html += cardTable('Jumlah Proker & Anggaran per Bidang', ['Bidang', 'Jumlah Proker', 'Total Anggaran'],
      d.per_bidang.map(b => [escapeHtml(b.nama_bidang), b.jumlah_proker, fmtRupiah(b.total_anggaran)]));
  } else if (user.peran === 'Bendahara') {
    const res = await api('dashboardBendahara', {});
    showLoading(false);
    if (!res.success) return (content.innerHTML = errBox(res.message));
    const d = res.data;
    html += statGrid([['Proker Belum Dianggarkan', d.proker_belum_dianggarkan]]);
    html += cardTable('Total Anggaran per Bidang', ['Bidang', 'Total Anggaran'],
      d.per_bidang.map(b => [escapeHtml(b.nama_bidang), fmtRupiah(b.total_anggaran)]));
  } else {
    const res = await api('dashboardPemilik', {});
    showLoading(false);
    if (!res.success) return (content.innerHTML = errBox(res.message));
    const d = res.data;
    const rekap = d.rekap_status;
    html += statGrid(Object.keys(rekap).length ? Object.entries(rekap).map(([k, v]) => [k, v]) : [['Belum ada proker', 0]]);
    html += cardTable('Status Proker Terbaru', ['Judul', 'Status', 'Revisi', 'Diubah'],
      d.daftar.slice(0, 10).map(p => [escapeHtml(p.judul), badgeStatus(p.status), p.jumlah_revisi || 0, fmtTanggal(p.diubah_pada)]));
  }

  content.innerHTML = html || '<div class="empty-state">Belum ada data.</div>';
}

const STAT_PALETTE = ['#2563EB', '#D97706', '#059669', '#DC2626', '#0D9488', '#7C3AED'];

function statGrid(pairs) {
  return '<div class="stat-grid" style="margin-bottom:var(--space-lg);">' +
    pairs.map(([label, val], i) => {
      const warna = STAT_PALETTE[i % STAT_PALETTE.length];
      return `<div class="stat-card">
        <div class="stat-strip" style="background:${warna};"></div>
        <div class="stat-body">
          <span class="stat-label" style="background:${warna}1A;color:${warna};">${escapeHtml(label)}</span>
          <span class="stat-value" style="color:var(--ink);">${val}</span>
        </div>
        <div class="stat-footer" style="background:var(--surface-1);color:#434655;"><span>UNIT</span><span>REALTIME</span></div>
      </div>`;
    }).join('') +
    '</div>';
}

function cardTable(title, headers, rows) {
  // Setiap sel dianggap HTML siap-tampil; caller wajib escapeHtml() nilai teks bebas sebelum dikirim ke sini.
  return `<div class="card"><div class="card-header"><h3>${escapeHtml(title)}</h3></div>
    <div class="table-wrap"><table class="data-table">
      <thead><tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
      <tbody>${rows.length ? rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${headers.length}" class="empty-state">Belum ada data.</td></tr>`}</tbody>
    </table></div></div>`;
}

function errBox(message) {
  return `<div class="login-error">${escapeHtml(message || 'Terjadi kesalahan.')}</div>`;
}
