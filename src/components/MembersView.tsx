import React, { useState } from 'react';
import { Check, Copy, Edit3, Loader2, Plus, Trash2, UserCheck, UserX, Users, X } from 'lucide-react';
import { MemberRecord } from '../types/attendance';

interface MembersViewProps {
  members: MemberRecord[];
  spreadsheetUrl?: string;
  isLoading: boolean;
  onAddMember: (member: Omit<MemberRecord, 'rowNumber'>) => Promise<void>;
  onRequestUpdateMember: (member: MemberRecord) => void;
  onRequestDeleteMember: (member: MemberRecord) => void;
}

export const MembersView: React.FC<MembersViewProps> = ({
  members,
  spreadsheetUrl,
  isLoading,
  onAddMember,
  onRequestUpdateMember,
  onRequestDeleteMember,
}) => {
  const [nama, setNama] = useState('');
  const [jabatan, setJabatan] = useState('');
  const [email, setEmail] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingMember, setEditingMember] = useState<MemberRecord | null>(null);
  const [copiedGuide, setCopiedGuide] = useState(false);

  const handleCopyGuide = async () => {
    const appUrl = window.location.origin;
    const sheetLine = spreadsheetUrl
      ? `3. Buka menu Spreadsheet/Sheet lalu tempel tautan ini:\n${spreadsheetUrl}`
      : '3. Buka menu Spreadsheet/Sheet lalu tempel tautan Google Sheets dari Admin.';
    const text = [
      '*Panduan Absensi HadirKu (Android)*',
      `1. Buka aplikasi di Chrome Android: ${appUrl}`,
      '   (Opsional: Ketuk titik tiga Chrome > Tambahkan ke layar utama)',
      '2. Klik "Masuk dengan Google" memakai akun Google Anda.',
      sheetLine,
      '4. Di menu Absen, pilih nama Anda lalu tekan "Absen Masuk Sekarang" (atau pilih Izin/Sakit jika berhalangan).',
      '5. Saat jam pulang selesai, buka kembali aplikasi dan tekan "Absen Pulang Sekarang".',
    ].join('\n');

    try {
      await navigator.clipboard.writeText(text);
      setCopiedGuide(true);
      window.setTimeout(() => setCopiedGuide(false), 2500);
    } catch {
      // Fallback ignored if clipboard permission unavailable
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nama.trim()) return;
    setIsAdding(true);
    try {
      await onAddMember({
        id: `MBR-${Date.now().toString(36).toUpperCase()}`,
        nama: nama.trim(),
        jabatan: jabatan.trim() || 'Staf',
        email: email.trim() || '-',
        aktif: true,
      });
      setNama('');
      setJabatan('');
      setEmail('');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Column: Add Member + Panduan Anggota */}
      <div className="lg:col-span-5 space-y-6">
        <section className="rounded-2xl bg-white border border-slate-200/90 p-5 sm:p-6 shadow-xs">
          <h2 className="text-lg font-bold text-slate-900">Tambah Anggota / Pegawai</h2>
          <p className="mt-1 text-xs text-slate-500 leading-relaxed">
            Data anggota disimpan pada tab <span className="font-mono text-slate-700">Anggota</span> di
            Google Sheets agar bisa dipilih saat absen bersama.
          </p>

          <form onSubmit={handleAdd} className="mt-4 space-y-3.5">
            <div>
              <label htmlFor="member-name" className="block text-xs font-semibold text-slate-700 mb-1">
                Nama Lengkap
              </label>
              <input
                id="member-name"
                type="text"
                required
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                placeholder="Contoh: Budi Santoso"
                className="w-full min-h-[44px] rounded-xl border border-slate-200 px-3.5 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="member-role" className="block text-xs font-semibold text-slate-700 mb-1">
                Jabatan / Kelas / Divisi
              </label>
              <input
                id="member-role"
                type="text"
                value={jabatan}
                onChange={(e) => setJabatan(e.target.value)}
                placeholder="Contoh: Operasional / Gudang"
                className="w-full min-h-[44px] rounded-xl border border-slate-200 px-3.5 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="member-email" className="block text-xs font-semibold text-slate-700 mb-1">
                Email (Opsional)
              </label>
              <input
                id="member-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="budi@perusahaan.com"
                className="w-full min-h-[44px] rounded-xl border border-slate-200 px-3.5 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={isAdding || !nama.trim()}
              className="w-full min-h-[48px] rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 active:scale-[0.99] transition-all inline-flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              <span>Simpan ke Google Sheets</span>
            </button>
          </form>
        </section>

        <section className="rounded-2xl bg-white border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-3.5">
          <h3 className="text-base font-bold text-slate-900">Petunjuk untuk Anggota</h3>
          <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
            <div>
              <p className="font-semibold text-slate-900">A. Jika absen dari HP masing-masing</p>
              <ol className="mt-1 space-y-1 list-decimal list-inside">
                <li>Bagikan file Google Sheets kepada email anggota dengan akses <strong>Editor</strong>.</li>
                <li>Anggota membuka link HadirKu di Chrome Android lalu masuk memakai akun Google.</li>
                <li>Anggota menempel link Google Sheets di menu Spreadsheet, lalu absen di menu Absen.</li>
              </ol>
            </div>
            <div className="pt-2 border-t border-slate-100">
              <p className="font-semibold text-slate-900">B. Jika absen bergantian di 1 HP / Tablet</p>
              <ol className="mt-1 space-y-1 list-decimal list-inside">
                <li>Cukup Admin yang login dan menautkan Google Sheets pada perangkat tersebut.</li>
                <li>Setiap anggota tinggal memilih namanya di daftar dropdown lalu menekan Absen Masuk / Pulang.</li>
              </ol>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCopyGuide}
            className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs sm:text-sm font-semibold text-slate-800 hover:bg-slate-100 inline-flex items-center justify-center gap-2 transition-colors"
          >
            {copiedGuide ? (
              <>
                <Check className="w-4 h-4 text-teal-700" />
                <span className="text-teal-700">Petunjuk & Link Tersalin</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Salin Petunjuk untuk Grup WhatsApp</span>
              </>
            )}
          </button>
        </section>
      </div>

      {/* Member List */}
      <section className="lg:col-span-7 rounded-2xl bg-white border border-slate-200/90 p-5 sm:p-6 shadow-xs">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Daftar Anggota</h2>
            <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
              {members.filter((m) => m.aktif).length} aktif · {members.length} total terdaftar
            </p>
          </div>
        </div>

        <div className="mt-4">
          {isLoading && members.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500">Memuat daftar anggota...</div>
          ) : members.length === 0 ? (
            <div className="py-10 text-center border border-dashed border-slate-200 rounded-xl">
              <Users className="w-6 h-6 text-slate-400 mx-auto" />
              <p className="mt-2 text-sm font-medium text-slate-700">Belum ada data anggota</p>
              <p className="mt-0.5 text-xs text-slate-500 max-w-xs mx-auto">
                Anda bisa langsung absen dengan akun Google Anda, atau tambahkan daftar pegawai/siswa di sini.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {members.map((member) => (
                <div
                  key={`${member.id}-${member.rowNumber}`}
                  className="py-3.5 first:pt-1 last:pb-1 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900 truncate">{member.nama}</p>
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-medium ${
                          member.aktif ? 'text-teal-700' : 'text-slate-400'
                        }`}
                      >
                        {member.aktif ? (
                          <UserCheck className="w-3.5 h-3.5" />
                        ) : (
                          <UserX className="w-3.5 h-3.5" />
                        )}
                        <span>{member.aktif ? 'Aktif' : 'Nonaktif'}</span>
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500 truncate">
                      {member.jabatan || 'Staf'}
                      {member.email && member.email !== '-' ? ` · ${member.email}` : ''}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        onRequestUpdateMember({ ...member, aktif: !member.aktif })
                      }
                      className="min-h-[40px] px-3 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                    >
                      {member.aktif ? 'Nonaktifkan' : 'Aktifkan'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingMember({ ...member })}
                      aria-label={`Ubah ${member.nama}`}
                      className="min-h-[40px] min-w-[40px] rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 flex items-center justify-center"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onRequestDeleteMember(member)}
                      aria-label={`Hapus ${member.nama}`}
                      className="min-h-[40px] min-w-[40px] rounded-xl border border-slate-200 text-rose-700 hover:bg-rose-50 flex items-center justify-center"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Edit Member Modal */}
      {editingMember && (
        <div
          className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-slate-950/50 backdrop-blur-xs p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-lg font-bold text-slate-900">Ubah Data Anggota</h3>
              <button
                type="button"
                onClick={() => setEditingMember(null)}
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
                  value={editingMember.nama}
                  onChange={(e) => setEditingMember({ ...editingMember, nama: e.target.value })}
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 px-3.5 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Jabatan / Divisi
                </label>
                <input
                  type="text"
                  value={editingMember.jabatan}
                  onChange={(e) => setEditingMember({ ...editingMember, jabatan: e.target.value })}
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 px-3.5 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={editingMember.email === '-' ? '' : editingMember.email}
                  onChange={(e) => setEditingMember({ ...editingMember, email: e.target.value || '-' })}
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 px-3.5 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setEditingMember(null)}
                className="min-h-[44px] px-4 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = editingMember;
                  setEditingMember(null);
                  onRequestUpdateMember(target);
                }}
                className="min-h-[44px] px-5 rounded-xl bg-teal-700 text-sm font-semibold text-white hover:bg-teal-800"
              >
                Simpan Perubahan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
