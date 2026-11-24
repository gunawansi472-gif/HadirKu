import React, { useEffect, useState } from 'react';
import {
  Clock,
  FileText,
  Loader2,
  LogIn,
  LogOut,
  MapPin,
  UserCheck,
} from 'lucide-react';
import { AttendanceRecord, AttendanceStatus, MemberRecord } from '../types/attendance';

interface AttendanceClockCardProps {
  currentUserName: string;
  currentUserEmail: string;
  members: MemberRecord[];
  todayRecords: AttendanceRecord[];
  shiftCutoff: string; // e.g. "08:30"
  isSubmitting: boolean;
  onClockIn: (payload: {
    nama: string;
    email: string;
    status: AttendanceStatus;
    lokasi: string;
    catatan: string;
    tanggal: string;
    jamMasuk: string;
  }) => Promise<void>;
  onRequestClockOut: (record: AttendanceRecord, jamPulang: string) => void;
}

function formatDateID(date: Date): string {
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function getLocalISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getLocalTimeHMS(date: Date): string {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

export const AttendanceClockCard: React.FC<AttendanceClockCardProps> = ({
  currentUserName,
  currentUserEmail,
  members,
  todayRecords,
  shiftCutoff,
  isSubmitting,
  onClockIn,
  onRequestClockOut,
}) => {
  const [now, setNow] = useState<Date>(() => new Date());
  const [selectedPersonKey, setSelectedPersonKey] = useState<string>('self');
  const [mode, setMode] = useState<'hadir' | 'izin' | 'sakit'>('hadir');
  const [catatan, setCatatan] = useState('');
  const [lokasi, setLokasi] = useState<string>('');
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const activeMembers = members.filter((m) => m.aktif);

  const selectedPerson = (() => {
    if (selectedPersonKey === 'self') {
      return {
        nama: currentUserName || 'Pengguna Google',
        email: currentUserEmail || '-',
        jabatan: 'Akun Google Saya',
      };
    }
    const found = activeMembers.find((m) => m.id === selectedPersonKey);
    if (found) {
      return {
        nama: found.nama,
        email: found.email || '-',
        jabatan: found.jabatan || 'Anggota',
      };
    }
    return {
      nama: currentUserName || 'Pengguna Google',
      email: currentUserEmail || '-',
      jabatan: 'Akun Google Saya',
    };
  })();

  const todayISO = getLocalISODate(now);
  const currentTimeStr = getLocalTimeHMS(now);
  const isAfterCutoff = currentTimeStr.slice(0, 5) > shiftCutoff;

  // Check if selected person already has an open or completed record today
  const personTodayRecord = todayRecords.find(
    (r) =>
      r.tanggal === todayISO &&
      (r.nama.trim().toLowerCase() === selectedPerson.nama.trim().toLowerCase() ||
        (selectedPerson.email !== '-' &&
          r.email.trim().toLowerCase() === selectedPerson.email.trim().toLowerCase()))
  );

  const handleCaptureLocation = () => {
    if (!('geolocation' in navigator)) {
      setLocationError('Perangkat tidak mendukung GPS.');
      return;
    }
    setIsLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`;
        setLokasi(coords);
        setIsLocating(false);
      },
      (err) => {
        setLocationError(
          err.code === 1
            ? 'Izin lokasi ditolak. Anda tetap bisa absen tanpa koordinat.'
            : 'Gagal membaca koordinat GPS.'
        );
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleClockInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let computedStatus: AttendanceStatus = 'Hadir';
    if (mode === 'izin') computedStatus = 'Izin';
    else if (mode === 'sakit') computedStatus = 'Sakit';
    else if (isAfterCutoff) computedStatus = 'Terlambat';

    await onClockIn({
      nama: selectedPerson.nama,
      email: selectedPerson.email,
      status: computedStatus,
      lokasi: lokasi.trim() || 'Tidak dicatat',
      catatan: catatan.trim(),
      tanggal: todayISO,
      jamMasuk: currentTimeStr,
    });

    setCatatan('');
  };

  const canClockOut =
    personTodayRecord &&
    !personTodayRecord.jamPulang &&
    (personTodayRecord.status === 'Hadir' || personTodayRecord.status === 'Terlambat');

  const alreadyDoneToday =
    personTodayRecord &&
    (Boolean(personTodayRecord.jamPulang) ||
      personTodayRecord.status === 'Izin' ||
      personTodayRecord.status === 'Sakit');

  return (
    <section className="rounded-2xl bg-white border border-slate-200/90 p-5 sm:p-6 shadow-xs">
      {/* Live Clock Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pb-5 border-b border-slate-100">
        <div>
          <p className="text-sm font-medium text-slate-500">{formatDateID(now)}</p>
          <div className="mt-1 flex items-baseline gap-3">
            <span className="font-mono text-4xl sm:text-5xl font-bold tracking-tight text-slate-900 tabular-nums">
              {currentTimeStr}
            </span>
          </div>
          <p className="mt-1.5 text-xs text-slate-500">
            Batas masuk tepat waktu <span className="font-mono font-semibold text-slate-700 tabular-nums">{shiftCutoff}</span>
            <span className="mx-1.5" aria-hidden="true">·</span>
            <span>{isAfterCutoff ? 'Melewati jam batas masuk' : 'Dalam waktu masuk'}</span>
          </p>
        </div>

        <div className="sm:text-right">
          <p className="text-xs font-medium text-slate-500">Status hari ini</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            {personTodayRecord ? (
              personTodayRecord.jamPulang ? (
                <span className="text-teal-700">
                  Selesai ({personTodayRecord.jamMasuk.slice(0, 5)} – {personTodayRecord.jamPulang.slice(0, 5)})
                </span>
              ) : (
                <span className="text-amber-700">
                  {personTodayRecord.status} · Masuk {personTodayRecord.jamMasuk.slice(0, 5)}
                </span>
              )
            ) : (
              <span className="text-slate-600">Belum absen masuk</span>
            )}
          </p>
        </div>
      </div>

      {/* Person Selector (Personal or Roster) */}
      <form onSubmit={handleClockInSubmit} className="mt-5 space-y-4">
        <div>
          <label htmlFor="person-select" className="block text-xs font-semibold text-slate-700 mb-1.5">
            Nama Pegawai / Anggota
          </label>
          <div className="relative">
            <select
              id="person-select"
              value={selectedPersonKey}
              onChange={(e) => setSelectedPersonKey(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:border-teal-700 focus:bg-white focus:outline-none"
            >
              <option value="self">
                {currentUserName || 'Saya'} ({currentUserEmail})
              </option>
              {activeMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.nama} {member.jabatan ? `— ${member.jabatan}` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Mode Segmented Control */}
        {!personTodayRecord && (
          <>
            <div>
              <span className="block text-xs font-semibold text-slate-700 mb-1.5">
                Jenis Kehadiran
              </span>
              <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-slate-100">
                {(
                  [
                    { key: 'hadir', label: 'Hadir Kerja' },
                    { key: 'izin', label: 'Izin' },
                    { key: 'sakit', label: 'Sakit' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setMode(item.key)}
                    className={`min-h-[40px] rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                      mode === item.key
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* GPS & Note Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Lokasi (Opsional)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={lokasi}
                    onChange={(e) => setLokasi(e.target.value)}
                    placeholder="Kantor / koordinat GPS"
                    className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-700 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleCaptureLocation}
                    disabled={isLocating}
                    title="Ambil titik GPS saat ini"
                    className="min-h-[44px] min-w-[44px] px-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 flex items-center justify-center shrink-0"
                  >
                    {isLocating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <MapPin className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {locationError && (
                  <p className="mt-1 text-xs text-amber-700">{locationError}</p>
                )}
              </div>

              <div>
                <label htmlFor="attendance-note" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Catatan (Opsional)
                </label>
                <div className="relative">
                  <input
                    id="attendance-note"
                    type="text"
                    value={catatan}
                    onChange={(e) => setCatatan(e.target.value)}
                    placeholder={mode === 'hadir' ? 'Shift pagi / keterangan tugas' : 'Alasan izin atau sakit'}
                    className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-700 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </>
        )}

        {/* Primary Thumb-Friendly Action CTA */}
        <div className="pt-1">
          {!personTodayRecord && (
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full min-h-[52px] rounded-xl bg-teal-700 px-5 py-3 text-base font-semibold text-white hover:bg-teal-800 active:scale-[0.99] transition-all flex items-center justify-center gap-2.5 shadow-sm disabled:opacity-60"
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : mode === 'hadir' ? (
                <LogIn className="w-5 h-5" />
              ) : (
                <FileText className="w-5 h-5" />
              )}
              <span>
                {mode === 'hadir'
                  ? `Absen Masuk Sekarang (${currentTimeStr.slice(0, 5)})`
                  : mode === 'izin'
                  ? 'Kirim Catatan Izin'
                  : 'Kirim Catatan Sakit'}
              </span>
            </button>
          )}

          {canClockOut && personTodayRecord && (
            <div className="space-y-3">
              <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {personTodayRecord.nama} sudah masuk
                    </p>
                    <p className="text-xs text-slate-500 font-mono tabular-nums">
                      Masuk {personTodayRecord.jamMasuk} · {personTodayRecord.status}
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => onRequestClockOut(personTodayRecord, currentTimeStr)}
                className="w-full min-h-[52px] rounded-xl bg-slate-900 px-5 py-3 text-base font-semibold text-white hover:bg-slate-800 active:scale-[0.99] transition-all flex items-center justify-center gap-2.5 shadow-sm disabled:opacity-60"
              >
                <LogOut className="w-5 h-5" />
                <span>Absen Pulang Sekarang ({currentTimeStr.slice(0, 5)})</span>
              </button>
            </div>
          )}

          {alreadyDoneToday && personTodayRecord && (
            <div className="rounded-xl bg-teal-50/70 border border-teal-200/80 p-4 flex items-center gap-3">
              <UserCheck className="w-5 h-5 text-teal-700 shrink-0" />
              <div className="text-sm text-teal-950">
                <span className="font-semibold">{personTodayRecord.nama}</span> telah menyelesaikan
                catatan absensi hari ini ({personTodayRecord.status}).
              </div>
            </div>
          )}
        </div>
      </form>
    </section>
  );
};
