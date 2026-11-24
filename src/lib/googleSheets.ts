import {
  AttendanceRecord,
  AttendanceStatus,
  MemberRecord,
  SheetTabInfo,
  SpreadsheetInfo,
} from '../types/attendance';

const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

export const ATTENDANCE_SHEET_NAME = 'Absensi';
export const MEMBERS_SHEET_NAME = 'Anggota';

const ATTENDANCE_HEADERS = [
  'ID',
  'Tanggal',
  'Nama',
  'Email',
  'Jam Masuk',
  'Jam Pulang',
  'Status',
  'Lokasi / Koordinat',
  'Catatan',
];

const MEMBERS_HEADERS = ['ID', 'Nama', 'Jabatan / Divisi', 'Email', 'Status Aktif'];

export class SheetsApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function sheetsFetch<T>(
  url: string,
  accessToken: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    let message = `Permintaan Google Sheets gagal (${res.status})`;
    try {
      const errBody = await res.json();
      if (errBody?.error?.message) {
        message = errBody.error.message;
      }
    } catch {
      // ignore json parse failure
    }
    throw new SheetsApiError(message, res.status);
  }

  return (await res.json()) as T;
}

export function extractSpreadsheetId(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';
  const urlMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (urlMatch?.[1]) {
    return urlMatch[1];
  }
  return trimmed;
}

function escapeSheetName(name: string): string {
  return `'${name.replace(/'/g, "''")}'`;
}

interface RawSpreadsheetResponse {
  spreadsheetId: string;
  spreadsheetUrl: string;
  properties: {
    title: string;
  };
  sheets: Array<{
    properties: {
      sheetId: number;
      title: string;
      index: number;
    };
  }>;
}

export async function getSpreadsheetMetadata(
  accessToken: string,
  spreadsheetId: string
): Promise<{
  spreadsheetId: string;
  title: string;
  spreadsheetUrl: string;
  sheets: SheetTabInfo[];
}> {
  const fields = 'spreadsheetId,spreadsheetUrl,properties.title,sheets.properties(sheetId,title,index)';
  const data = await sheetsFetch<RawSpreadsheetResponse>(
    `${SHEETS_API_BASE}/${encodeURIComponent(spreadsheetId)}?fields=${encodeURIComponent(fields)}`,
    accessToken
  );

  return {
    spreadsheetId: data.spreadsheetId,
    title: data.properties?.title || 'Spreadsheet Absensi',
    spreadsheetUrl:
      data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${data.spreadsheetId}`,
    sheets: (data.sheets || []).map((s) => ({
      sheetId: s.properties.sheetId,
      title: s.properties.title,
      index: s.properties.index,
    })),
  };
}

export async function createAttendanceSpreadsheet(
  accessToken: string,
  title = 'Database Absensi — HadirKu'
): Promise<SpreadsheetInfo> {
  const created = await sheetsFetch<RawSpreadsheetResponse>(SHEETS_API_BASE, accessToken, {
    method: 'POST',
    body: JSON.stringify({
      properties: {
        title,
        locale: 'id_ID',
      },
      sheets: [
        {
          properties: {
            title: ATTENDANCE_SHEET_NAME,
            index: 0,
            gridProperties: { frozenRowCount: 1 },
          },
        },
        {
          properties: {
            title: MEMBERS_SHEET_NAME,
            index: 1,
            gridProperties: { frozenRowCount: 1 },
          },
        },
      ],
    }),
  });

  const absensiSheet = created.sheets.find((s) => s.properties.title === ATTENDANCE_SHEET_NAME)!;
  const anggotaSheet = created.sheets.find((s) => s.properties.title === MEMBERS_SHEET_NAME)!;

  // Populate headers for both tabs
  await sheetsFetch(
    `${SHEETS_API_BASE}/${created.spreadsheetId}/values:batchUpdate`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: [
          {
            range: `${escapeSheetName(ATTENDANCE_SHEET_NAME)}!A1:I1`,
            values: [ATTENDANCE_HEADERS],
          },
          {
            range: `${escapeSheetName(MEMBERS_SHEET_NAME)}!A1:E1`,
            values: [MEMBERS_HEADERS],
          },
        ],
      }),
    }
  );

  // Style header rows cleanly (bold + subtle teal header tint)
  await sheetsFetch(`${SHEETS_API_BASE}/${created.spreadsheetId}:batchUpdate`, accessToken, {
    method: 'POST',
    body: JSON.stringify({
      requests: [absensiSheet.properties.sheetId, anggotaSheet.properties.sheetId].map((sid) => ({
        repeatCell: {
          range: {
            sheetId: sid,
            startRowIndex: 0,
            endRowIndex: 1,
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.94, green: 0.98, blue: 0.97 },
              textFormat: {
                bold: true,
                foregroundColor: { red: 0.06, green: 0.46, blue: 0.43 },
              },
            },
          },
          fields: 'userEnteredFormat(backgroundColor,textFormat)',
        },
      })),
    }),
  });

  return {
    spreadsheetId: created.spreadsheetId,
    title: created.properties.title,
    spreadsheetUrl: created.spreadsheetUrl,
    sheets: created.sheets.map((s) => s.properties),
    attendanceSheetTitle: ATTENDANCE_SHEET_NAME,
    attendanceSheetId: absensiSheet.properties.sheetId,
    membersSheetTitle: MEMBERS_SHEET_NAME,
    membersSheetId: anggotaSheet.properties.sheetId,
  };
}

export async function connectAndPrepareSpreadsheet(
  accessToken: string,
  rawIdOrUrl: string,
  createMissingTabs = false
): Promise<{
  info: SpreadsheetInfo;
  missingTabs: string[];
}> {
  const spreadsheetId = extractSpreadsheetId(rawIdOrUrl);
  if (!spreadsheetId) {
    throw new Error('Masukkan URL atau ID Google Sheets yang valid.');
  }

  let meta = await getSpreadsheetMetadata(accessToken, spreadsheetId);

  const findTab = (preferredName: string) =>
    meta.sheets.find((s) => s.title.toLowerCase() === preferredName.toLowerCase());

  let absensiTab = findTab(ATTENDANCE_SHEET_NAME);
  let anggotaTab = findTab(MEMBERS_SHEET_NAME);

  const missingTabs: string[] = [];
  if (!absensiTab) missingTabs.push(ATTENDANCE_SHEET_NAME);
  if (!anggotaTab) missingTabs.push(MEMBERS_SHEET_NAME);

  if (missingTabs.length > 0 && !createMissingTabs) {
    // Fallback preview info using existing first sheet if user hasn't confirmed adding tabs yet
    const firstSheet = meta.sheets[0];
    return {
      info: {
        ...meta,
        attendanceSheetTitle: absensiTab?.title || firstSheet?.title || ATTENDANCE_SHEET_NAME,
        attendanceSheetId: absensiTab?.sheetId ?? firstSheet?.sheetId ?? 0,
        membersSheetTitle: anggotaTab?.title || MEMBERS_SHEET_NAME,
        membersSheetId: anggotaTab?.sheetId ?? 0,
      },
      missingTabs,
    };
  }

  if (missingTabs.length > 0 && createMissingTabs) {
    const addRequests = missingTabs.map((title) => ({
      addSheet: {
        properties: {
          title,
          gridProperties: { frozenRowCount: 1 },
        },
      },
    }));

    await sheetsFetch(`${SHEETS_API_BASE}/${spreadsheetId}:batchUpdate`, accessToken, {
      method: 'POST',
      body: JSON.stringify({ requests: addRequests }),
    });

    meta = await getSpreadsheetMetadata(accessToken, spreadsheetId);
    absensiTab = findTab(ATTENDANCE_SHEET_NAME);
    anggotaTab = findTab(MEMBERS_SHEET_NAME);

    const headerWrites: Array<{ range: string; values: string[][] }> = [];
    if (missingTabs.includes(ATTENDANCE_SHEET_NAME) && absensiTab) {
      headerWrites.push({
        range: `${escapeSheetName(absensiTab.title)}!A1:I1`,
        values: [ATTENDANCE_HEADERS],
      });
    }
    if (missingTabs.includes(MEMBERS_SHEET_NAME) && anggotaTab) {
      headerWrites.push({
        range: `${escapeSheetName(anggotaTab.title)}!A1:E1`,
        values: [MEMBERS_HEADERS],
      });
    }

    if (headerWrites.length > 0) {
      await sheetsFetch(`${SHEETS_API_BASE}/${spreadsheetId}/values:batchUpdate`, accessToken, {
        method: 'POST',
        body: JSON.stringify({
          valueInputOption: 'USER_ENTERED',
          data: headerWrites,
        }),
      });
    }
  }

  if (!absensiTab || !anggotaTab) {
    throw new Error('Tab Absensi atau Anggota belum tersedia di spreadsheet ini.');
  }

  return {
    info: {
      ...meta,
      attendanceSheetTitle: absensiTab.title,
      attendanceSheetId: absensiTab.sheetId,
      membersSheetTitle: anggotaTab.title,
      membersSheetId: anggotaTab.sheetId,
    },
    missingTabs: [],
  };
}

interface ValuesResponse {
  range?: string;
  values?: string[][];
}

function normalizeStatus(raw: string | undefined): AttendanceStatus {
  const val = (raw || '').trim().toLowerCase();
  if (val === 'terlambat') return 'Terlambat';
  if (val === 'izin') return 'Izin';
  if (val === 'sakit') return 'Sakit';
  return 'Hadir';
}

export async function fetchAttendanceRecords(
  accessToken: string,
  spreadsheetId: string,
  sheetTitle: string
): Promise<AttendanceRecord[]> {
  const range = `${escapeSheetName(sheetTitle)}!A2:I`;
  const data = await sheetsFetch<ValuesResponse>(
    `${SHEETS_API_BASE}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`,
    accessToken
  );

  const rows = data.values || [];
  const records: AttendanceRecord[] = [];

  rows.forEach((row, idx) => {
    // Skip completely blank rows
    if (!row || row.every((cell) => !String(cell || '').trim())) return;

    records.push({
      id: String(row[0] || `row-${idx + 2}`),
      rowNumber: idx + 2,
      tanggal: String(row[1] || ''),
      nama: String(row[2] || ''),
      email: String(row[3] || ''),
      jamMasuk: String(row[4] || ''),
      jamPulang: String(row[5] || ''),
      status: normalizeStatus(row[6]),
      lokasi: String(row[7] || ''),
      catatan: String(row[8] || ''),
    });
  });

  // Sort newest first by date + jamMasuk
  return records.sort((a, b) => {
    const keyA = `${a.tanggal} ${a.jamMasuk}`;
    const keyB = `${b.tanggal} ${b.jamMasuk}`;
    return keyB.localeCompare(keyA);
  });
}

export async function appendAttendanceRecord(
  accessToken: string,
  spreadsheetId: string,
  sheetTitle: string,
  record: Omit<AttendanceRecord, 'rowNumber'>
): Promise<void> {
  const range = `${escapeSheetName(sheetTitle)}!A:I`;
  await sheetsFetch(
    `${SHEETS_API_BASE}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        values: [
          [
            record.id,
            record.tanggal,
            record.nama,
            record.email,
            record.jamMasuk,
            record.jamPulang,
            record.status,
            record.lokasi,
            record.catatan,
          ],
        ],
      }),
    }
  );
}

export async function updateAttendanceRecord(
  accessToken: string,
  spreadsheetId: string,
  sheetTitle: string,
  record: AttendanceRecord
): Promise<void> {
  const range = `${escapeSheetName(sheetTitle)}!A${record.rowNumber}:I${record.rowNumber}`;
  await sheetsFetch(
    `${SHEETS_API_BASE}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    accessToken,
    {
      method: 'PUT',
      body: JSON.stringify({
        values: [
          [
            record.id,
            record.tanggal,
            record.nama,
            record.email,
            record.jamMasuk,
            record.jamPulang,
            record.status,
            record.lokasi,
            record.catatan,
          ],
        ],
      }),
    }
  );
}

export async function deleteSheetRow(
  accessToken: string,
  spreadsheetId: string,
  numericSheetId: number,
  rowNumber: number
): Promise<void> {
  await sheetsFetch(
    `${SHEETS_API_BASE}/${encodeURIComponent(spreadsheetId)}:batchUpdate`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: numericSheetId,
                dimension: 'ROWS',
                startIndex: rowNumber - 1,
                endIndex: rowNumber,
              },
            },
          },
        ],
      }),
    }
  );
}

export async function fetchMembers(
  accessToken: string,
  spreadsheetId: string,
  sheetTitle: string
): Promise<MemberRecord[]> {
  const range = `${escapeSheetName(sheetTitle)}!A2:E`;
  const data = await sheetsFetch<ValuesResponse>(
    `${SHEETS_API_BASE}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`,
    accessToken
  );

  const rows = data.values || [];
  const members: MemberRecord[] = [];

  rows.forEach((row, idx) => {
    if (!row || row.every((cell) => !String(cell || '').trim())) return;
    const statusRaw = String(row[4] || 'Aktif').trim().toLowerCase();
    members.push({
      id: String(row[0] || `mbr-${idx + 2}`),
      rowNumber: idx + 2,
      nama: String(row[1] || ''),
      jabatan: String(row[2] || ''),
      email: String(row[3] || ''),
      aktif: statusRaw !== 'nonaktif' && statusRaw !== 'false' && statusRaw !== 'tidak',
    });
  });

  return members;
}

export async function appendMember(
  accessToken: string,
  spreadsheetId: string,
  sheetTitle: string,
  member: Omit<MemberRecord, 'rowNumber'>
): Promise<void> {
  const range = `${escapeSheetName(sheetTitle)}!A:E`;
  await sheetsFetch(
    `${SHEETS_API_BASE}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        values: [
          [
            member.id,
            member.nama,
            member.jabatan,
            member.email,
            member.aktif ? 'Aktif' : 'Nonaktif',
          ],
        ],
      }),
    }
  );
}

export async function updateMember(
  accessToken: string,
  spreadsheetId: string,
  sheetTitle: string,
  member: MemberRecord
): Promise<void> {
  const range = `${escapeSheetName(sheetTitle)}!A${member.rowNumber}:E${member.rowNumber}`;
  await sheetsFetch(
    `${SHEETS_API_BASE}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    accessToken,
    {
      method: 'PUT',
      body: JSON.stringify({
        values: [
          [
            member.id,
            member.nama,
            member.jabatan,
            member.email,
            member.aktif ? 'Aktif' : 'Nonaktif',
          ],
        ],
      }),
    }
  );
}
