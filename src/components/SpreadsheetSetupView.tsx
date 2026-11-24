import React, { useState } from 'react';
import {
  CheckCircle2,
  ExternalLink,
  FileSpreadsheet,
  Link2,
  Loader2,
  Plus,
  RefreshCw,
  Smartphone,
} from 'lucide-react';
import { SpreadsheetInfo } from '../types/attendance';
import { PWAInstallButton } from './PWAInstallButton';

interface SpreadsheetSetupViewProps {
  spreadsheetInfo: SpreadsheetInfo | null;
  shiftCutoff: string;
  onChangeShiftCutoff: (value: string) => void;
  onCreateNewSpreadsheet: (title: string) => Promise<void>;
  onConnectSpreadsheet: (urlOrId: string) => Promise<void>;
  onRefreshData: () => Promise<void>;
  onDisconnectSpreadsheet: () => void;
  isBusy: boolean;
}

export const SpreadsheetSetupView: React.FC<SpreadsheetSetupViewProps> = ({
  spreadsheetInfo,
  shiftCutoff,
  onChangeShiftCutoff,
  onCreateNewSpreadsheet,
  onConnectSpreadsheet,
  onRefreshData,
  onDisconnectSpreadsheet,
  isBusy,
}) => {
  const [newTitle, setNewTitle] = useState('Database Absensi — HadirKu');
  const [existingUrl, setExistingUrl] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await onCreateNewSpreadsheet(newTitle.trim() || 'Database Absensi — HadirKu');
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!existingUrl.trim()) return;
    await onConnectSpreadsheet(existingUrl);
    setExistingUrl('');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left: Active Connection & Shift Settings */}
      <div className="lg:col-span-6 space-y-6">
        <section className="rounded-2xl bg-white border border-slate-200/90 p-5 sm:p-6 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold text-slate-900">Database Google Sheets</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Semua catatan masuk, pulang, izin, dan daftar anggota tersimpan langsung di Google
                Spreadsheet milik Anda.
              </p>
            </div>
          </div>

          {spreadsheetInfo ? (
            <div className="mt-5 rounded-xl bg-slate-50 border border-slate-200/80 p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-teal-700">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Terhubung ke Google Sheets</span>
                  </div>
                  <p className="mt-1 text-base font-bold text-slate-900 truncate">
                    {spreadsheetInfo.title}
                  </p>
                  <p className="mt-0.5 text-xs font-mono text-slate-500 truncate">
                    ID: {spreadsheetInfo.spreadsheetId}
                  </p>
                </div>
              </div>

              <div className="text-xs text-slate-600 pt-2 border-t border-slate-200/70">
                Tab aktif: <span className="font-mono font-semibold">{spreadsheetInfo.attendanceSheetTitle}</span>
                <span className="mx-1.5" aria-hidden="true">·</span>
                <span className="font-mono font-semibold">{spreadsheetInfo.membersSheetTitle}</span>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <a
                  href={spreadsheetInfo.spreadsheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[44px] px-4 rounded-xl bg-teal-700 text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-2 hover:bg-teal-800 whitespace-nowrap"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Buka Google Sheet</span>
                </a>
                <button
                  type="button"
                  onClick={onRefreshData}
                  disabled={isBusy}
                  className="min-h-[44px] px-3.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-100 inline-flex items-center gap-2 whitespace-nowrap disabled:opacity-60"
                >
                  <RefreshCw className={`w-4 h-4 ${isBusy ? 'animate-spin' : ''}`} />
                  <span>Sinkronkan</span>
                </button>
                <button
                  type="button"
                  onClick={onDisconnectSpreadsheet}
                  className="min-h-[44px] px-3.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-medium text-rose-700 hover:bg-rose-50 whitespace-nowrap"
                >
                  Ganti Sheet
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-xl bg-amber-50/70 border border-amber-200/80 p-4 text-sm text-amber-900">
              Belum ada spreadsheet yang terhubung. Buat spreadsheet baru otomatis atau tempel URL
              Google Sheets Anda di panel sebelah.
            </div>
          )}

          {/* Shift Time Configuration */}
          <div className="mt-5 pt-5 border-t border-slate-100">
            <label htmlFor="shift-cutoff" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Batas Jam Masuk Tepat Waktu
            </label>
            <div className="flex items-center gap-3">
              <input
                id="shift-cutoff"
                type="time"
                value={shiftCutoff}
                onChange={(e) => onChangeShiftCutoff(e.target.value)}
                className="min-h-[44px] rounded-xl border border-slate-200 px-3.5 text-sm font-mono text-slate-900 focus:border-teal-700 focus:outline-none"
              />
              <span className="text-xs text-slate-500">
                Absen masuk setelah jam ini otomatis tercatat sebagai Terlambat.
              </span>
            </div>
          </div>
        </section>

        {/* Android PWA Installation Card */}
        <section className="rounded-2xl bg-white border border-slate-200/90 p-5 sm:p-6 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Gunakan Seperti Aplikasi Android</h3>
              <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                Buka tautan aplikasi ini di Google Chrome pada HP Android Anda, lalu pasang ke Layar
                Utama agar tampil layar penuh tanpa bilah browser.
              </p>
              <div className="mt-3">
                <PWAInstallButton />
              </div>
              <ol className="mt-3 space-y-1 text-xs text-slate-500 list-decimal list-inside">
                <li>Buka menu titik tiga di kanan atas Google Chrome Android.</li>
                <li>Pilih Tambahkan ke layar utama (Install app).</li>
                <li>Ikon HadirKu akan muncul di daftar aplikasi Android Anda.</li>
              </ol>
            </div>
          </div>
        </section>
      </div>

      {/* Right: Create or Connect Spreadsheet */}
      <div className="lg:col-span-6 space-y-6">
        <section className="rounded-2xl bg-white border border-slate-200/90 p-5 sm:p-6 shadow-xs">
          <h3 className="text-base font-bold text-slate-900">1. Buat Spreadsheet Absensi Baru</h3>
          <p className="mt-1 text-xs text-slate-500 leading-relaxed">
            Otomatis membuat file Google Sheets baru di Google Drive Anda lengkap dengan tab{' '}
            <span className="font-mono text-slate-700">Absensi</span> dan{' '}
            <span className="font-mono text-slate-700">Anggota</span> beserta judul kolomnya.
          </p>

          <form onSubmit={handleCreate} className="mt-4 space-y-3">
            <div>
              <label htmlFor="new-sheet-title" className="block text-xs font-semibold text-slate-700 mb-1">
                Nama File Google Sheets
              </label>
              <input
                id="new-sheet-title"
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-slate-200 px-3.5 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={isBusy}
              className="w-full min-h-[48px] rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 inline-flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              <span>Buat Spreadsheet Baru</span>
            </button>
          </form>
        </section>

        <section className="rounded-2xl bg-white border border-slate-200/90 p-5 sm:p-6 shadow-xs">
          <h3 className="text-base font-bold text-slate-900">2. Hubungkan Spreadsheet yang Sudah Ada</h3>
          <p className="mt-1 text-xs text-slate-500 leading-relaxed">
            Sudah punya file Google Sheets? Tempel tautan (URL) atau ID Spreadsheet Anda di bawah ini.
          </p>

          <form onSubmit={handleConnect} className="mt-4 space-y-3">
            <div>
              <label htmlFor="existing-sheet-url" className="block text-xs font-semibold text-slate-700 mb-1">
                URL atau ID Google Sheets
              </label>
              <input
                id="existing-sheet-url"
                type="text"
                value={existingUrl}
                onChange={(e) => setExistingUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0..."
                className="w-full min-h-[44px] rounded-xl border border-slate-200 px-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-700 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={isBusy || !existingUrl.trim()}
              className="w-full min-h-[48px] rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 inline-flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
              <span>Hubungkan Spreadsheet</span>
            </button>
          </form>
        </section>
      </div>
    </div>
  );
};
