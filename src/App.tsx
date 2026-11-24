import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  Database,
  FileSpreadsheet,
  History,
  LogOut,
  RefreshCw,
  Users,
  WifiOff,
} from 'lucide-react';
import {
  clearAccessToken,
  getAccessToken,
  googleSignIn,
  initAuth,
  logout,
} from './lib/firebaseAuth';
import {
  appendAttendanceRecord,
  appendMember,
  connectAndPrepareSpreadsheet,
  createAttendanceSpreadsheet,
  deleteSheetRow,
  fetchAttendanceRecords,
  fetchMembers,
  SheetsApiError,
  updateAttendanceRecord,
  updateMember,
} from './lib/googleSheets';
import {
  AttendanceRecord,
  AttendanceStatus,
  ConfirmationState,
  MemberRecord,
  SpreadsheetInfo,
} from './types/attendance';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { GoogleSignInButton } from './components/GoogleSignInButton';
import { PWAInstallButton } from './components/PWAInstallButton';
import { ConfirmDialog } from './components/ConfirmDialog';
import { AttendanceClockCard } from './components/AttendanceClockCard';
import { AttendanceHistoryView } from './components/AttendanceHistoryView';
import { MembersView } from './components/MembersView';
import { SpreadsheetSetupView } from './components/SpreadsheetSetupView';

type ActiveTab = 'absen' | 'riwayat' | 'anggota' | 'spreadsheet';

const STORAGE_SHEET_ID_KEY = 'hadirku_spreadsheet_id';
const STORAGE_CUTOFF_KEY = 'hadirku_shift_cutoff';

function getTodayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

export default function App() {
  const isOnline = useOnlineStatus();

  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [activeTab, setActiveTab] = useState<ActiveTab>('absen');
  const [spreadsheetInfo, setSpreadsheetInfo] = useState<SpreadsheetInfo | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [shiftCutoff, setShiftCutoff] = useState<string>(() => {
    return localStorage.getItem(STORAGE_CUTOFF_KEY) || '08:30';
  });

  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmationState | null>(null);

  const showNotice = useCallback((type: 'success' | 'error', text: string) => {
    setNotice({ type, text });
  }, []);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(t);
  }, [notice]);

  const handleApiError = useCallback(
    (err: unknown, fallbackMessage: string) => {
      if (err instanceof SheetsApiError && err.status === 401) {
        clearAccessToken();
        setToken(null);
        setNeedsAuth(true);
        showNotice('error', 'Sesi Google Sheets berakhir. Silakan masuk kembali dengan Google.');
        return;
      }
      const message = err instanceof Error ? err.message : fallbackMessage;
      showNotice('error', message || fallbackMessage);
    },
    [showNotice]
  );

  const loadAllSheetData = useCallback(
    async (accessToken: string, info: SpreadsheetInfo) => {
      setIsLoadingData(true);
      try {
        const [attendanceRows, memberRows] = await Promise.all([
          fetchAttendanceRecords(accessToken, info.spreadsheetId, info.attendanceSheetTitle),
          info.membersSheetId
            ? fetchMembers(accessToken, info.spreadsheetId, info.membersSheetTitle)
            : Promise.resolve([]),
        ]);
        setRecords(attendanceRows);
        setMembers(memberRows);
      } catch (err) {
        handleApiError(err, 'Gagal membaca data dari Google Sheets.');
      } finally {
        setIsLoadingData(false);
      }
    },
    [handleApiError]
  );

  const handleConnectSpreadsheet = useCallback(
    async (urlOrId: string, accessTokenOverride?: string) => {
      const activeToken = accessTokenOverride || token || getAccessToken();
      if (!activeToken) {
        setNeedsAuth(true);
        return;
      }

      setIsMutating(true);
      try {
        const { info, missingTabs } = await connectAndPrepareSpreadsheet(
          activeToken,
          urlOrId,
          false
        );

        if (missingTabs.length > 0) {
          setIsMutating(false);
          setConfirmState({
            isOpen: true,
            title: 'Siapkan Tab Absensi di Spreadsheet?',
            description: `Spreadsheet "${info.title}" belum memiliki tab ${missingTabs.join(
              ' dan '
            )}. Apakah Anda ingin menambahkan tab tersebut otomatis?`,
            details: [
              `Spreadsheet: ${info.title}`,
              `Tab yang akan dibuat: ${missingTabs.join(', ')}`,
            ],
            confirmLabel: 'Tambahkan Tab',
            variant: 'primary',
            onConfirm: async () => {
              const prepared = await connectAndPrepareSpreadsheet(activeToken, urlOrId, true);
              localStorage.setItem(STORAGE_SHEET_ID_KEY, prepared.info.spreadsheetId);
              setSpreadsheetInfo(prepared.info);
              await loadAllSheetData(activeToken, prepared.info);
              showNotice('success', `Terhubung ke "${prepared.info.title}".`);
            },
          });
          return;
        }

        localStorage.setItem(STORAGE_SHEET_ID_KEY, info.spreadsheetId);
        setSpreadsheetInfo(info);
        await loadAllSheetData(activeToken, info);
        showNotice('success', `Terhubung ke "${info.title}".`);
      } catch (err) {
        handleApiError(err, 'Gagal menghubungkan spreadsheet.');
      } finally {
        setIsMutating(false);
      }
    },
    [token, loadAllSheetData, showNotice, handleApiError]
  );

  // Auth listener
  useEffect(() => {
    const unsubscribe = initAuth(
      (authedUser, accessToken) => {
        setUser(authedUser);
        setToken(accessToken);
        setNeedsAuth(false);
      },
      (existingUser) => {
        setUser(existingUser);
        setToken(null);
        setNeedsAuth(true);
      }
    );
    return () => unsubscribe();
  }, []);

  // Reconnect saved spreadsheet once token is ready
  useEffect(() => {
    if (!token || spreadsheetInfo) return;
    const savedId = localStorage.getItem(STORAGE_SHEET_ID_KEY);
    if (savedId) {
      handleConnectSpreadsheet(savedId, token);
    }
  }, [token, spreadsheetInfo, handleConnectSpreadsheet]);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setNotice(null);
    try {
      const result = await googleSignIn();
      setUser(result.user);
      setToken(result.accessToken);
      setNeedsAuth(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal masuk dengan Google.';
      showNotice('error', msg);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setToken(null);
    setNeedsAuth(true);
    setSpreadsheetInfo(null);
    setRecords([]);
    setMembers([]);
  };

  const handleCreateNewSpreadsheet = async (title: string) => {
    const activeToken = token || getAccessToken();
    if (!activeToken) {
      setNeedsAuth(true);
      return;
    }

    setIsMutating(true);
    try {
      const created = await createAttendanceSpreadsheet(activeToken, title);
      localStorage.setItem(STORAGE_SHEET_ID_KEY, created.spreadsheetId);
      setSpreadsheetInfo(created);
      setRecords([]);
      setMembers([]);
      showNotice('success', `Spreadsheet "${created.title}" berhasil dibuat di Google Drive Anda.`);
      setActiveTab('absen');
    } catch (err) {
      handleApiError(err, 'Gagal membuat spreadsheet baru.');
    } finally {
      setIsMutating(false);
    }
  };

  const handleDisconnectSpreadsheet = () => {
    localStorage.removeItem(STORAGE_SHEET_ID_KEY);
    setSpreadsheetInfo(null);
    setRecords([]);
    setMembers([]);
    showNotice('success', 'Koneksi spreadsheet dilepas. Anda dapat memilih atau membuat file lain.');
  };

  const handleChangeShiftCutoff = (val: string) => {
    setShiftCutoff(val);
    localStorage.setItem(STORAGE_CUTOFF_KEY, val);
  };

  const handleRefreshData = async () => {
    const activeToken = token || getAccessToken();
    if (!activeToken || !spreadsheetInfo) return;
    await loadAllSheetData(activeToken, spreadsheetInfo);
    showNotice('success', 'Data berhasil disinkronkan dari Google Sheets.');
  };

  // Clock In (append new row)
  const handleClockIn = async (payload: {
    nama: string;
    email: string;
    status: AttendanceStatus;
    lokasi: string;
    catatan: string;
    tanggal: string;
    jamMasuk: string;
  }) => {
    const activeToken = token || getAccessToken();
    if (!activeToken || !spreadsheetInfo) {
      setNeedsAuth(true);
      return;
    }

    setIsMutating(true);
    try {
      await appendAttendanceRecord(
        activeToken,
        spreadsheetInfo.spreadsheetId,
        spreadsheetInfo.attendanceSheetTitle,
        {
          id: `ABS-${Date.now().toString(36).toUpperCase()}`,
          tanggal: payload.tanggal,
          nama: payload.nama,
          email: payload.email,
          jamMasuk: payload.jamMasuk,
          jamPulang: '',
          status: payload.status,
          lokasi: payload.lokasi,
          catatan: payload.catatan,
        }
      );
      await loadAllSheetData(activeToken, spreadsheetInfo);
      showNotice('success', `Absen ${payload.status} untuk ${payload.nama} tersimpan ke Google Sheets.`);
    } catch (err) {
      handleApiError(err, 'Gagal menyimpan absen ke Google Sheets.');
    } finally {
      setIsMutating(false);
    }
  };

  // Clock Out (mutates existing row -> requires explicit Confirmation Dialog)
  const handleRequestClockOut = (record: AttendanceRecord, jamPulang: string) => {
    const activeToken = token || getAccessToken();
    if (!activeToken || !spreadsheetInfo) {
      setNeedsAuth(true);
      return;
    }

    setConfirmState({
      isOpen: true,
      title: 'Catat Jam Pulang?',
      description: `Perbarui baris absensi di tab "${spreadsheetInfo.attendanceSheetTitle}" pada Google Sheets dengan jam pulang saat ini?`,
      details: [
        `Nama: ${record.nama}`,
        `Tanggal: ${record.tanggal}`,
        `Masuk: ${record.jamMasuk} -> Pulang: ${jamPulang}`,
      ],
      confirmLabel: 'Konfirmasi Pulang',
      variant: 'primary',
      onConfirm: async () => {
        try {
          await updateAttendanceRecord(
            activeToken,
            spreadsheetInfo.spreadsheetId,
            spreadsheetInfo.attendanceSheetTitle,
            { ...record, jamPulang }
          );
          await loadAllSheetData(activeToken, spreadsheetInfo);
          showNotice('success', `Jam pulang ${record.nama} (${jamPulang}) berhasil disimpan.`);
        } catch (err) {
          handleApiError(err, 'Gagal mencatat jam pulang.');
        }
      },
    });
  };

  // Edit Attendance Record (requires Confirmation Dialog)
  const handleRequestEditRecord = (updated: AttendanceRecord) => {
    const activeToken = token || getAccessToken();
    if (!activeToken || !spreadsheetInfo) {
      setNeedsAuth(true);
      return;
    }

    setConfirmState({
      isOpen: true,
      title: 'Simpan Perubahan di Google Sheets?',
      description: `Data absensi baris ke-${updated.rowNumber} pada tab "${spreadsheetInfo.attendanceSheetTitle}" akan diperbarui.`,
      details: [
        `Nama: ${updated.nama}`,
        `Tanggal: ${updated.tanggal} · Status: ${updated.status}`,
        `Jam: ${updated.jamMasuk || '-'} s/d ${updated.jamPulang || '-'}`,
      ],
      confirmLabel: 'Simpan ke Sheet',
      variant: 'primary',
      onConfirm: async () => {
        try {
          await updateAttendanceRecord(
            activeToken,
            spreadsheetInfo.spreadsheetId,
            spreadsheetInfo.attendanceSheetTitle,
            updated
          );
          await loadAllSheetData(activeToken, spreadsheetInfo);
          showNotice('success', `Catatan ${updated.nama} diperbarui di Google Sheets.`);
        } catch (err) {
          handleApiError(err, 'Gagal memperbarui catatan absensi.');
        }
      },
    });
  };

  // Delete Attendance Record (requires Confirmation Dialog)
  const handleRequestDeleteRecord = (record: AttendanceRecord) => {
    const activeToken = token || getAccessToken();
    if (!activeToken || !spreadsheetInfo) {
      setNeedsAuth(true);
      return;
    }

    setConfirmState({
      isOpen: true,
      title: 'Hapus Catatan dari Google Sheets?',
      description: `Baris ini akan dihapus permanen dari tab "${spreadsheetInfo.attendanceSheetTitle}". Tindakan ini tidak dapat dibatalkan.`,
      details: [
        `Nama: ${record.nama}`,
        `Tanggal: ${record.tanggal} · Masuk: ${record.jamMasuk || '-'}`,
        `Status: ${record.status}`,
      ],
      confirmLabel: 'Hapus Baris',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await deleteSheetRow(
            activeToken,
            spreadsheetInfo.spreadsheetId,
            spreadsheetInfo.attendanceSheetId,
            record.rowNumber
          );
          await loadAllSheetData(activeToken, spreadsheetInfo);
          showNotice('success', `Catatan absensi ${record.nama} dihapus.`);
        } catch (err) {
          handleApiError(err, 'Gagal menghapus catatan absensi.');
        }
      },
    });
  };

  // Add Member (append new row)
  const handleAddMember = async (member: Omit<MemberRecord, 'rowNumber'>) => {
    const activeToken = token || getAccessToken();
    if (!activeToken || !spreadsheetInfo) {
      setNeedsAuth(true);
      return;
    }

    try {
      await appendMember(
        activeToken,
        spreadsheetInfo.spreadsheetId,
        spreadsheetInfo.membersSheetTitle,
        member
      );
      await loadAllSheetData(activeToken, spreadsheetInfo);
      showNotice('success', `Anggota "${member.nama}" ditambahkan ke Google Sheets.`);
    } catch (err) {
      handleApiError(err, 'Gagal menambahkan anggota.');
    }
  };

  // Update Member (requires Confirmation Dialog)
  const handleRequestUpdateMember = (updated: MemberRecord) => {
    const activeToken = token || getAccessToken();
    if (!activeToken || !spreadsheetInfo) {
      setNeedsAuth(true);
      return;
    }

    setConfirmState({
      isOpen: true,
      title: 'Perbarui Data Anggota?',
      description: `Baris ke-${updated.rowNumber} di tab "${spreadsheetInfo.membersSheetTitle}" akan diperbarui.`,
      details: [
        `Nama: ${updated.nama}`,
        `Jabatan: ${updated.jabatan} · Status: ${updated.aktif ? 'Aktif' : 'Nonaktif'}`,
      ],
      confirmLabel: 'Simpan Perubahan',
      variant: 'primary',
      onConfirm: async () => {
        try {
          await updateMember(
            activeToken,
            spreadsheetInfo.spreadsheetId,
            spreadsheetInfo.membersSheetTitle,
            updated
          );
          await loadAllSheetData(activeToken, spreadsheetInfo);
          showNotice('success', `Data anggota "${updated.nama}" diperbarui.`);
        } catch (err) {
          handleApiError(err, 'Gagal memperbarui data anggota.');
        }
      },
    });
  };

  // Delete Member (requires Confirmation Dialog)
  const handleRequestDeleteMember = (member: MemberRecord) => {
    const activeToken = token || getAccessToken();
    if (!activeToken || !spreadsheetInfo) {
      setNeedsAuth(true);
      return;
    }

    setConfirmState({
      isOpen: true,
      title: 'Hapus Anggota dari Google Sheets?',
      description: `Anggota ini akan dihapus dari tab "${spreadsheetInfo.membersSheetTitle}". Catatan absensi lamanya tetap aman di tab Absensi.`,
      details: [`Nama: ${member.nama}`, `Jabatan: ${member.jabatan || '-'}`],
      confirmLabel: 'Hapus Anggota',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await deleteSheetRow(
            activeToken,
            spreadsheetInfo.spreadsheetId,
            spreadsheetInfo.membersSheetId,
            member.rowNumber
          );
          await loadAllSheetData(activeToken, spreadsheetInfo);
          showNotice('success', `Anggota "${member.nama}" dihapus.`);
        } catch (err) {
          handleApiError(err, 'Gagal menghapus anggota.');
        }
      },
    });
  };

  const todayISO = getTodayISO();
  const todayRecords = useMemo(
    () => records.filter((r) => r.tanggal === todayISO),
    [records, todayISO]
  );

  const todayStats = useMemo(() => {
    const hadir = todayRecords.filter((r) => r.status === 'Hadir').length;
    const terlambat = todayRecords.filter((r) => r.status === 'Terlambat').length;
    const izinSakit = todayRecords.filter((r) => r.status === 'Izin' || r.status === 'Sakit').length;
    const belumPulang = todayRecords.filter(
      (r) => !r.jamPulang && (r.status === 'Hadir' || r.status === 'Terlambat')
    ).length;
    return { hadir, terlambat, izinSakit, belumPulang };
  }, [todayRecords]);

  // Unauthenticated / Token Refresh Screen
  if (needsAuth) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <header className="w-full border-b border-slate-200/80 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
            <span className="font-display text-xl font-extrabold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
              HadirKu
            </span>
            <div className="flex items-center gap-3 shrink-0">
              <PWAInstallButton compact />
            </div>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center px-4 py-10">
          <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-5">
              <p className="text-xs font-semibold text-teal-700 tracking-wide">
                Absensi Mobile Android · Database Google Sheets
              </p>
              <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-slate-900 leading-tight text-balance">
                Catat absensi dari HP Android langsung ke Google Sheets Anda.
              </h1>
              <p className="text-base text-slate-600 leading-relaxed max-w-xl">
                Semua data hadir, terlambat, izin, jam pulang, hingga koordinat lokasi otomatis
                tersimpan ke spreadsheet Google Drive Anda tanpa biaya server tambahan.
              </p>
              <div className="pt-1 flex flex-wrap items-center gap-3">
                <GoogleSignInButton
                  onClick={handleLogin}
                  disabled={isLoggingIn}
                  label={isLoggingIn ? 'Menghubungkan...' : 'Masuk dengan Google'}
                />
                <PWAInstallButton />
              </div>
              {notice && (
                <p
                  className={`text-sm font-medium ${
                    notice.type === 'error' ? 'text-rose-700' : 'text-teal-700'
                  }`}
                >
                  {notice.text}
                </p>
              )}
            </div>

            <div className="lg:col-span-5 rounded-2xl bg-white border border-slate-200/90 p-6 shadow-xs space-y-4">
              <h2 className="text-base font-bold text-slate-900">Yang Anda Dapatkan</h2>
              <ul className="space-y-3.5 text-sm text-slate-600">
                <li className="flex items-start gap-3">
                  <FileSpreadsheet className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-slate-900">Langsung ke Google Sheets</strong> — buat file
                    baru otomatis atau sambungkan spreadsheet yang sudah ada.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <ClipboardCheck className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-slate-900">Absen Masuk & Pulang</strong> — pencatatan jam
                    otomatis, deteksi keterlambatan, izin/sakit, dan titik GPS.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <Users className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-slate-900">Mode Pribadi atau Tim</strong> — cocok untuk
                    absensi individu, kantor, toko, maupun kelas.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20 md:pb-10">
      {/* Desktop 3-Zone Top Bar */}
      <header className="hidden md:block sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('absen');
            }}
            className="font-display text-xl font-extrabold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            HadirKu
          </a>

          <nav className="flex items-center gap-6 text-sm font-medium" aria-label="Navigasi utama">
            {(
              [
                { id: 'absen', label: 'Absen' },
                { id: 'riwayat', label: 'Riwayat' },
                { id: 'anggota', label: 'Anggota' },
                { id: 'spreadsheet', label: 'Spreadsheet' },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`py-1.5 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === item.id
                    ? 'border-teal-700 text-slate-900 font-semibold'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={handleLogout}
              className="min-h-[40px] px-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Keluar ({user?.displayName?.split(' ')[0] || 'Akun'})</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Compact Top App Bar (<= 52px) */}
      <header className="md:hidden sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 h-13 px-4 flex items-center justify-between gap-3">
        <span className="font-display text-lg font-extrabold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
          HadirKu
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <PWAInstallButton compact />
          <button
            type="button"
            onClick={handleLogout}
            aria-label="Keluar dari akun"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-5 sm:pt-7 space-y-6">
        {/* Feedback Notice */}
        {notice && (
          <div
            role="status"
            className={`rounded-xl border px-4 py-3 text-sm font-medium flex items-center gap-2.5 ${
              notice.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : 'bg-teal-50 border-teal-200 text-teal-900'
            }`}
          >
            {notice.type === 'error' ? (
              <AlertCircle className="w-4 h-4 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            )}
            <span>{notice.text}</span>
          </div>
        )}

        {/* First-time Spreadsheet Connection Prompt if none connected */}
        {!spreadsheetInfo ? (
          <div className="space-y-4">
            <div className="rounded-2xl bg-white border border-slate-200/90 p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-xl font-bold text-slate-900">
                  Halo, {user?.displayName || user?.email}
                </h1>
                <p className="mt-1 text-sm text-slate-600">
                  Pilih untuk membuat file Google Sheets baru otomatis atau hubungkan spreadsheet
                  absensi Anda yang sudah ada.
                </p>
              </div>
              <PWAInstallButton />
            </div>

            <SpreadsheetSetupView
              spreadsheetInfo={null}
              shiftCutoff={shiftCutoff}
              onChangeShiftCutoff={handleChangeShiftCutoff}
              onCreateNewSpreadsheet={handleCreateNewSpreadsheet}
              onConnectSpreadsheet={(id) => handleConnectSpreadsheet(id)}
              onRefreshData={handleRefreshData}
              onDisconnectSpreadsheet={handleDisconnectSpreadsheet}
              isBusy={isMutating || isLoadingData}
            />
          </div>
        ) : (
          <>
            {/* Context Bar & Quick Sync */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 truncate">
                  {activeTab === 'absen' && 'Absensi Hari Ini'}
                  {activeTab === 'riwayat' && 'Catatan & Ekspor Absensi'}
                  {activeTab === 'anggota' && 'Manajemen Anggota'}
                  {activeTab === 'spreadsheet' && 'Pengaturan Google Sheets'}
                </h1>
                <p className="mt-0.5 text-xs text-slate-500 truncate">
                  Spreadsheet: <span className="font-medium text-slate-700">{spreadsheetInfo.title}</span>
                  <span className="mx-1.5" aria-hidden="true">·</span>
                  <span>{user?.email}</span>
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="hidden md:block">
                  <PWAInstallButton compact />
                </div>
                <button
                  type="button"
                  onClick={handleRefreshData}
                  disabled={isLoadingData}
                  className="min-h-[44px] px-3.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 inline-flex items-center gap-2 whitespace-nowrap disabled:opacity-60"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingData ? 'animate-spin' : ''}`} />
                  <span>Muat Ulang</span>
                </button>
              </div>
            </div>

            {/* 4-Column KPI Strip (shown on Absen tab) */}
            {activeTab === 'absen' && (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  <div className="rounded-2xl bg-white border border-slate-200/90 p-4">
                    <p className="text-xs font-medium text-slate-500">Hadir Tepat Waktu</p>
                    <p className="mt-1.5 font-mono text-2xl font-bold text-teal-700 tabular-nums">
                      {todayStats.hadir}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white border border-slate-200/90 p-4">
                    <p className="text-xs font-medium text-slate-500">Terlambat</p>
                    <p className="mt-1.5 font-mono text-2xl font-bold text-amber-700 tabular-nums">
                      {todayStats.terlambat}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white border border-slate-200/90 p-4">
                    <p className="text-xs font-medium text-slate-500">Izin / Sakit</p>
                    <p className="mt-1.5 font-mono text-2xl font-bold text-slate-800 tabular-nums">
                      {todayStats.izinSakit}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white border border-slate-200/90 p-4">
                    <p className="text-xs font-medium text-slate-500">Belum Absen Pulang</p>
                    <p className="mt-1.5 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                      {todayStats.belumPulang}
                    </p>
                  </div>
                </div>

                {/* Main 2-column workspace on desktop, stacked on mobile */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  <div className="lg:col-span-5">
                    <AttendanceClockCard
                      currentUserName={user?.displayName || 'Pengguna'}
                      currentUserEmail={user?.email || '-'}
                      members={members}
                      todayRecords={todayRecords}
                      shiftCutoff={shiftCutoff}
                      isSubmitting={isMutating}
                      onClockIn={handleClockIn}
                      onRequestClockOut={handleRequestClockOut}
                    />
                  </div>
                  <div className="lg:col-span-7">
                    <AttendanceHistoryView
                      records={records}
                      isLoading={isLoadingData}
                      onRequestClockOut={handleRequestClockOut}
                      onRequestEdit={handleRequestEditRecord}
                      onRequestDelete={handleRequestDeleteRecord}
                    />
                  </div>
                </div>
              </>
            )}

            {activeTab === 'riwayat' && (
              <AttendanceHistoryView
                records={records}
                isLoading={isLoadingData}
                onRequestClockOut={handleRequestClockOut}
                onRequestEdit={handleRequestEditRecord}
                onRequestDelete={handleRequestDeleteRecord}
              />
            )}

            {activeTab === 'anggota' && (
              <MembersView
                members={members}
                spreadsheetUrl={spreadsheetInfo.spreadsheetUrl}
                isLoading={isLoadingData}
                onAddMember={handleAddMember}
                onRequestUpdateMember={handleRequestUpdateMember}
                onRequestDeleteMember={handleRequestDeleteMember}
              />
            )}

            {activeTab === 'spreadsheet' && (
              <SpreadsheetSetupView
                spreadsheetInfo={spreadsheetInfo}
                shiftCutoff={shiftCutoff}
                onChangeShiftCutoff={handleChangeShiftCutoff}
                onCreateNewSpreadsheet={handleCreateNewSpreadsheet}
                onConnectSpreadsheet={(id) => handleConnectSpreadsheet(id)}
                onRefreshData={handleRefreshData}
                onDisconnectSpreadsheet={handleDisconnectSpreadsheet}
                isBusy={isMutating || isLoadingData}
              />
            )}
          </>
        )}
      </main>

      {/* Mobile Fixed Bottom Thumb Navigation Bar */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200/90 pb-safe"
        aria-label="Navigasi bawah"
      >
        <div className="grid grid-cols-4 h-14 items-center">
          {(
            [
              { id: 'absen', label: 'Absen', icon: ClipboardCheck },
              { id: 'riwayat', label: 'Riwayat', icon: History },
              { id: 'anggota', label: 'Anggota', icon: Users },
              { id: 'spreadsheet', label: 'Sheet', icon: Database },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 transition-colors ${
                  isActive ? 'text-teal-700 font-semibold' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[11px] tracking-tight leading-none">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Real Offline Mode Indicator */}
      {!isOnline && (
        <div className="fixed bottom-18 md:bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-medium text-white shadow-lg">
          <WifiOff className="w-4 h-4 shrink-0" />
          <span>Mode Offline — Koneksi internet diperlukan untuk sinkronisasi Google Sheets.</span>
        </div>
      )}

      {/* Mandatory Confirmation Modal for All Mutations / Deletions */}
      <ConfirmDialog state={confirmState} onClose={() => setConfirmState(null)} />
    </div>
  );
}
