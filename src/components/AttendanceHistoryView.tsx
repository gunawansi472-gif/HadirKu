import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  Edit3,
  FileText,
  LogOut,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { AttendanceRecord, AttendanceStatus } from '../types/attendance';

interface AttendanceHistoryViewProps {
  records: AttendanceRecord[];
  isLoading: boolean;
  onRequestClockOut: (record: AttendanceRecord, jamPulang: string) => void;
  onRequestEdit: (updatedRecord: AttendanceRecord) => void;
  onRequestDelete: (record: AttendanceRecord) => void;
}

function StatusLabel({ status }: { status: AttendanceStatus }) {
  if (status === 'Hadir') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
        <span>Hadir</span>
      </span>
    );
  }
  if (status === 'Terlambat') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700">
        <Clock className="w-3.5 h-3.5 shrink-0" />
        <span>Terlambat</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
      <FileText className="w-3.5 h-3.5 shrink-0" />
      <span>{status}</span>
    </span>
  );
}

export const AttendanceHistoryView: React.FC<AttendanceHistoryViewProps> = ({
  records,
  isLoading,
  onRequestClockOut,
  onRequestEdit,
  onRequestDelete,
}) => {
  const [statusFilter, setStatusFilter] = useState<'semua' | 'hadir' | 'terlambat' | 'izin'>('semua');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);

  const filtered = useMemo(() => {
    return records.filter((r) => {
      if (statusFilter === 'hadir' && r.status !== 'Hadir') return false;
      if (statusFilter === 'terlambat' && r.status !== 'Terlambat') return false;
      if (statusFilter === 'izin' && r.status !== 'Izin' && r.status !== 'Sakit') return false;
      if (dateFilter && r.tanggal !== dateFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          r.nama.toLowerCase().includes(q) ||
          r.email.toLowerCase().includes(q) ||
          r.catatan.toLowerCase().includes(q) ||
          r.lokasi.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [records, statusFilter, dateFilter, searchQuery]);

  const handleExportCSV = () => {
    const header = ['ID', 'Tanggal', 'Nama', 'Email', 'Jam Masuk', 'Jam Pulang', 'Status', 'Lokasi', 'Catatan'];
    const escapeCSV = (val: string) => `"${String(val || '').replace(/"/g, '""')}"`;
    const rows = filtered.map((r) =>
      [r.id, r.tanggal, r.nama, r.email, r.jamMasuk, r.jamPulang, r.status, r.lokasi, r.catatan]
        .map(escapeCSV)
        .join(',')
    );
    const csv = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `absensi-${dateFilter || 'semua'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getCurrentHMS = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(
      d.getSeconds()
    ).padStart(2, '0')}`;
  };

  return (
    <section className="rounded-2xl bg-white border border-slate-200/90 p-5 sm:p-6 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Riwayat Absensi</h2>
          <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
            Menampilkan {filtered.length} dari {records.length} catatan di Google Sheets
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportCSV}
          disabled={filtered.length === 0}
          className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap shrink-0"
        >
          <Download className="w-4 h-4" />
          <span>Unduh CSV</span>
        </button>
      </div>

      {/* Filters */}
      <div className="mt-4 space-y-3">
        <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-slate-100">
          {(
            [
              { key: 'semua', label: 'Semua' },
              { key: 'hadir', label: 'Hadir' },
              { key: 'terlambat', label: 'Terlambat' },
              { key: 'izin', label: 'Izin / Sakit' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatusFilter(tab.key)}
              className={`min-h-[38px] rounded-lg px-2 text-xs font-semibold transition-colors whitespace-nowrap truncate ${
                statusFilter === tab.key
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
          <div className="sm:col-span-8 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama, email, lokasi, atau catatan..."
              className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-slate-50/70 pl-10 pr-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-700 focus:bg-white focus:outline-none"
            />
          </div>
          <div className="sm:col-span-4 flex gap-2">
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              aria-label="Filter tanggal"
              className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-sm font-mono text-slate-800 focus:border-teal-700 focus:bg-white focus:outline-none"
            />
            {dateFilter && (
              <button
                type="button"
                onClick={() => setDateFilter('')}
                aria-label="Reset tanggal"
                className="min-h-[44px] min-w-[44px] rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-slate-900 flex items-center justify-center shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mt-5">
        {isLoading && records.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500">
            Memuat data dari Google Sheets...
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center border border-dashed border-slate-200 rounded-xl">
            <AlertCircle className="w-6 h-6 text-slate-400 mx-auto" />
            <p className="mt-2 text-sm font-medium text-slate-700">Belum ada catatan absensi</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Data baru yang Anda catat akan muncul di sini dan langsung tersimpan ke Google Sheets.
            </p>
          </div>
        ) : (
          <>
            {/* Mobile List View */}
            <div className="divide-y divide-slate-100 lg:hidden">
              {filtered.map((rec) => (
                <div key={`${rec.id}-${rec.rowNumber}`} className="py-4 first:pt-1 last:pb-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{rec.nama}</p>
                      <p className="mt-0.5 text-xs text-slate-500 font-mono tabular-nums">
                        {rec.tanggal}
                        <span className="mx-1.5" aria-hidden="true">·</span>
                        Masuk {rec.jamMasuk || '-'}
                        {rec.jamPulang ? ` · Pulang ${rec.jamPulang}` : ''}
                      </p>
                    </div>
                    <StatusLabel status={rec.status} />
                  </div>

                  {(rec.lokasi || rec.catatan) && (
                    <p className="mt-1.5 text-xs text-slate-600 line-clamp-2">
                      {rec.lokasi && rec.lokasi !== 'Tidak dicatat' ? `Lokasi: ${rec.lokasi}` : ''}
                      {rec.lokasi && rec.lokasi !== 'Tidak dicatat' && rec.catatan ? ' · ' : ''}
                      {rec.catatan}
                    </p>
                  )}

                  <div className="mt-2.5 flex items-center gap-2">
                    {!rec.jamPulang && (rec.status === 'Hadir' || rec.status === 'Terlambat') && (
                      <button
                        type="button"
                        onClick={() => onRequestClockOut(rec, getCurrentHMS())}
                        className="min-h-[40px] px-3 rounded-lg bg-slate-900 text-white text-xs font-medium inline-flex items-center gap-1.5 hover:bg-slate-800 whitespace-nowrap"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Catat Pulang</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setEditingRecord({ ...rec })}
                      className="min-h-[40px] px-3 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-medium inline-flex items-center gap-1.5 hover:bg-slate-50 whitespace-nowrap"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Ubah</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onRequestDelete(rec)}
                      aria-label={`Hapus catatan ${rec.nama}`}
                      className="min-h-[40px] min-w-[40px] rounded-lg border border-slate-200 bg-white text-rose-700 hover:bg-rose-50 inline-flex items-center justify-center"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                    <th className="py-3 pr-4">Tanggal</th>
                    <th className="py-3 px-4">Nama</th>
                    <th className="py-3 px-4">Masuk</th>
                    <th className="py-3 px-4">Pulang</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Keterangan</th>
                    <th className="py-3 pl-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filtered.map((rec) => (
                    <tr key={`${rec.id}-${rec.rowNumber}`} className="hover:bg-slate-50/70">
                      <td className="py-3.5 pr-4 font-mono text-xs text-slate-700 tabular-nums whitespace-nowrap">
                        {rec.tanggal}
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-slate-900">{rec.nama}</p>
                        <p className="text-xs text-slate-500">{rec.email}</p>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-800 tabular-nums whitespace-nowrap">
                        {rec.jamMasuk || '-'}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-800 tabular-nums whitespace-nowrap">
                        {rec.jamPulang || '-'}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <StatusLabel status={rec.status} />
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-600 max-w-xs truncate">
                        {rec.catatan || (rec.lokasi !== 'Tidak dicatat' ? rec.lokasi : '-')}
                      </td>
                      <td className="py-3.5 pl-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {!rec.jamPulang &&
                            (rec.status === 'Hadir' || rec.status === 'Terlambat') && (
                              <button
                                type="button"
                                onClick={() => onRequestClockOut(rec, getCurrentHMS())}
                                className="min-h-[36px] px-2.5 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800"
                              >
                                Pulang
                              </button>
                            )}
                          <button
                            type="button"
                            onClick={() => setEditingRecord({ ...rec })}
                            title="Ubah catatan"
                            className="min-h-[36px] min-w-[36px] rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 inline-flex items-center justify-center"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onRequestDelete(rec)}
                            title="Hapus baris dari Google Sheets"
                            className="min-h-[36px] min-w-[36px] rounded-lg border border-slate-200 text-rose-700 hover:bg-rose-50 inline-flex items-center justify-center"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Edit Modal (triggers ConfirmDialog before writing to Google Sheets) */}
      {editingRecord && (
        <div
          className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-slate-950/50 backdrop-blur-xs p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-lg font-bold text-slate-900">Ubah Catatan Absensi</h3>
              <button
                type="button"
                onClick={() => setEditingRecord(null)}
                aria-label="Tutup"
                className="min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nama</label>
                <input
                  type="text"
                  value={editingRecord.nama}
                  onChange={(e) => setEditingRecord({ ...editingRecord, nama: e.target.value })}
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 px-3.5 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Jam Masuk</label>
                  <input
                    type="text"
                    value={editingRecord.jamMasuk}
                    onChange={(e) =>
                      setEditingRecord({ ...editingRecord, jamMasuk: e.target.value })
                    }
                    className="w-full min-h-[44px] rounded-xl border border-slate-200 px-3.5 text-sm font-mono text-slate-900 focus:border-teal-700 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Jam Pulang</label>
                  <input
                    type="text"
                    value={editingRecord.jamPulang}
                    onChange={(e) =>
                      setEditingRecord({ ...editingRecord, jamPulang: e.target.value })
                    }
                    placeholder="HH:mm:ss"
                    className="w-full min-h-[44px] rounded-xl border border-slate-200 px-3.5 text-sm font-mono text-slate-900 focus:border-teal-700 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                <select
                  value={editingRecord.status}
                  onChange={(e) =>
                    setEditingRecord({
                      ...editingRecord,
                      status: e.target.value as AttendanceStatus,
                    })
                  }
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 px-3.5 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
                >
                  <option value="Hadir">Hadir</option>
                  <option value="Terlambat">Terlambat</option>
                  <option value="Izin">Izin</option>
                  <option value="Sakit">Sakit</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Catatan</label>
                <input
                  type="text"
                  value={editingRecord.catatan}
                  onChange={(e) => setEditingRecord({ ...editingRecord, catatan: e.target.value })}
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 px-3.5 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setEditingRecord(null)}
                className="min-h-[44px] px-4 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = editingRecord;
                  setEditingRecord(null);
                  onRequestEdit(target);
                }}
                className="min-h-[44px] px-5 rounded-xl bg-teal-700 text-sm font-semibold text-white hover:bg-teal-800"
              >
                Simpan Perubahan
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
