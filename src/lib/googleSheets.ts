/**
 * googleSheets.ts
 * Google Sheets REST API helpers (v4).
 * Also uses Drive API to list spreadsheets.
 */

import { getAuthHeader } from './googleAuth';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';

export interface GoogleSheet {
  id: string;
  name: string;
  modifiedTime?: string;
  webViewLink?: string;
  owners?: { displayName: string }[];
  lastModifyingUser?: { displayName: string };
}

export interface SheetValues {
  range: string;
  values: string[][];
}

/**
 * List Google Sheets accessible to the user.
 */
export async function listSheets(): Promise<GoogleSheet[]> {
  const params = new URLSearchParams({
    q: `mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`,
    fields: 'files(id,name,modifiedTime,webViewLink,owners,lastModifyingUser)',
    orderBy: 'modifiedTime desc',
    pageSize: '30',
  });

  const res = await fetch(`${DRIVE_API}/files?${params}`, {
    headers: { Authorization: getAuthHeader() },
  });

  if (!res.ok) throw new Error(`Sheets listSheets failed: ${res.status} ${res.statusText}`);
  const data = await res.json();
  return data.files ?? [];
}

/**
 * Create a new Google Spreadsheet.
 * @param title    - Spreadsheet title
 * @param headers  - Optional array of column headers for the first sheet
 */
export async function createSheet(
  title: string,
  headers?: string[]
): Promise<GoogleSheet> {
  const body: Record<string, unknown> = { properties: { title } };

  if (headers && headers.length > 0) {
    body.sheets = [
      {
        properties: { title: 'Ark1', sheetId: 0 },
        data: [
          {
            startRow: 0,
            startColumn: 0,
            rowData: [
              {
                values: headers.map(h => ({
                  userEnteredValue: { stringValue: h },
                  userEnteredFormat: { textFormat: { bold: true } },
                })),
              },
            ],
          },
        ],
      },
    ];
  }

  const res = await fetch(SHEETS_API, {
    method: 'POST',
    headers: {
      Authorization: getAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Sheets createSheet failed: ${res.status}`);
  const created = await res.json();
  return {
    id: created.spreadsheetId,
    name: title,
    webViewLink: created.spreadsheetUrl,
  };
}

/**
 * Get the Google Sheets URL for a spreadsheet.
 */
export function getSheetUrl(sheetId: string): string {
  return `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;
}

/**
 * Read values from a range in a spreadsheet.
 * @param sheetId - Spreadsheet ID
 * @param range   - A1 notation range, e.g. 'Sheet1!A1:D10'
 */
export async function readRange(
  sheetId: string,
  range: string
): Promise<SheetValues> {
  const res = await fetch(
    `${SHEETS_API}/${sheetId}/values/${encodeURIComponent(range)}`,
    { headers: { Authorization: getAuthHeader() } }
  );

  if (!res.ok) throw new Error(`Sheets readRange failed: ${res.status}`);
  return res.json();
}

/**
 * Append rows to a spreadsheet.
 * @param sheetId - Spreadsheet ID
 * @param range   - Target range, e.g. 'Sheet1!A:Z'
 * @param rows    - Array of row arrays to append
 */
export async function appendRows(
  sheetId: string,
  range: string,
  rows: string[][]
): Promise<void> {
  const params = new URLSearchParams({ valueInputOption: 'USER_ENTERED' });
  const res = await fetch(
    `${SHEETS_API}/${sheetId}/values/${encodeURIComponent(range)}:append?${params}`,
    {
      method: 'POST',
      headers: {
        Authorization: getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: rows }),
    }
  );
  if (!res.ok) throw new Error(`Sheets appendRows failed: ${res.status}`);
}

/** Get header row of a sheet's first tab */
export async function getHeaders(sheetId: string): Promise<string[]> {
  const data = await readRange(sheetId, 'A1:Z1');
  return data.values?.[0] ?? [];
}

/** Get author display name from a sheet object */
export function getSheetAuthor(sheet: GoogleSheet): string {
  return sheet.lastModifyingUser?.displayName ?? sheet.owners?.[0]?.displayName ?? '—';
}
