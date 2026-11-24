export type AttendanceStatus = 'Hadir' | 'Terlambat' | 'Izin' | 'Sakit';

export interface AttendanceRecord {
  id: string;
  rowNumber: number; // 1-indexed row in Google Sheet (data starts at row 2)
  tanggal: string; // YYYY-MM-DD
  nama: string;
  email: string;
  jamMasuk: string; // HH:mm:ss
  jamPulang: string; // HH:mm:ss or ''
  status: AttendanceStatus;
  lokasi: string;
  catatan: string;
}

export interface MemberRecord {
  id: string;
  rowNumber: number;
  nama: string;
  jabatan: string;
  email: string;
  aktif: boolean;
}

export interface SheetTabInfo {
  sheetId: number;
  title: string;
  index: number;
}

export interface SpreadsheetInfo {
  spreadsheetId: string;
  title: string;
  spreadsheetUrl: string;
  sheets: SheetTabInfo[];
  attendanceSheetTitle: string;
  attendanceSheetId: number;
  membersSheetTitle: string;
  membersSheetId: number;
}

export interface ConfirmationState {
  isOpen: boolean;
  title: string;
  description: string;
  details?: string[];
  confirmLabel: string;
  variant: 'primary' | 'danger';
  onConfirm: () => Promise<void>;
}
