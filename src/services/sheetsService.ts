import type {
  AppUser,
  AuthEventLog,
  ListeningLogEntry,
  LiveUserSession,
  SearchLogEntry,
} from '../types';

const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

export interface SpreadsheetMetadata {
  spreadsheetId: string;
  title: string;
  spreadsheetUrl: string;
  sheetNames: string[];
  sheetIdsByName: Record<string, number>;
}

export type SheetTabName =
  | 'Users'
  | 'AuthLogs'
  | 'SearchLogs'
  | 'ListeningLogs'
  | 'LiveSessions';

export interface SheetPreviewData {
  spreadsheetTitle: string;
  tabs: Record<
    SheetTabName,
    {
      headers: string[];
      rows: string[][];
    }
  >;
}

const REQUIRED_TABS: SheetTabName[] = [
  'Users',
  'AuthLogs',
  'SearchLogs',
  'ListeningLogs',
  'LiveSessions',
];

const USERS_HEADERS = [
  'ID',
  'Email',
  'Name',
  'Provider',
  'Role',
  'Created At',
  'Last Login At',
  'Login Count',
  'Status',
  'Current Song',
  'Current Artist',
  'Playback State',
  'Last Search',
];

const LOGS_HEADERS = [
  'Log ID',
  'Timestamp',
  'Event',
  'Email',
  'Name',
  'Provider',
  'Role',
  'Details',
];

const SEARCH_LOGS_HEADERS = [
  'Log ID',
  'Timestamp',
  'User ID',
  'User Name',
  'Email',
  'Search Query',
  'Result Count',
  'Session ID',
];

const LISTENING_LOGS_HEADERS = [
  'Log ID',
  'Timestamp',
  'User ID',
  'User Name',
  'Email',
  'Track Title',
  'Artist',
  'YouTube ID',
  'Duration',
  'Action',
  'Position (s)',
  'Session ID',
];

const LIVE_SESSIONS_HEADERS = [
  'Session ID',
  'User ID',
  'User Name',
  'Email',
  'Role',
  'Active Screen',
  'Playback State',
  'Current Track',
  'Artist',
  'Position / Duration',
  'Last Search',
  'Last Seen At',
];

async function sheetsFetch<T>(
  url: string,
  accessToken: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const rawText = await res.text();
  let parsed: unknown = null;
  if (rawText) {
    try {
      parsed = JSON.parse(rawText);
    } catch {
      const trimmed = rawText.trim().toLowerCase();
      if (trimmed.startsWith('<!doctype') || trimmed.startsWith('<html')) {
        throw new Error(
          `Google Sheets API가 JSON 대신 HTML 페이지를 반환했습니다 (${res.status}). 스프레드시트 ID와 Google 로그인 상태를 확인해 주세요.`,
        );
      }
      throw new Error(`Google Sheets 응답 파싱 오류 (${res.status})`);
    }
  }

  if (!res.ok) {
    let message = `Google Sheets API 오류 (${res.status})`;
    if (
      parsed &&
      typeof parsed === 'object' &&
      'error' in parsed &&
      (parsed as { error?: { message?: string } }).error?.message
    ) {
      message = (parsed as { error: { message: string } }).error.message;
    }
    throw new Error(message);
  }

  return (parsed ?? {}) as T;
}

export async function inspectSpreadsheet(
  accessToken: string,
  spreadsheetId: string,
): Promise<SpreadsheetMetadata> {
  const data = await sheetsFetch<{
    spreadsheetId: string;
    spreadsheetUrl: string;
    properties: { title: string };
    sheets: Array<{ properties: { title: string; sheetId: number } }>;
  }>(
    `${SHEETS_API_BASE}/${encodeURIComponent(spreadsheetId)}?fields=spreadsheetId,spreadsheetUrl,properties.title,sheets.properties`,
    accessToken,
  );

  const sheetIdsByName: Record<string, number> = {};
  for (const s of data.sheets) {
    sheetIdsByName[s.properties.title] = s.properties.sheetId;
  }

  return {
    spreadsheetId: data.spreadsheetId,
    title: data.properties.title,
    spreadsheetUrl: data.spreadsheetUrl,
    sheetNames: data.sheets.map((s) => s.properties.title),
    sheetIdsByName,
  };
}

async function formatHeaderRows(
  accessToken: string,
  spreadsheetId: string,
  sheetIds: number[],
) {
  if (sheetIds.length === 0) return;
  await sheetsFetch(
    `${SHEETS_API_BASE}/${encodeURIComponent(spreadsheetId)}:batchUpdate`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        requests: sheetIds.map((sheetId) => ({
          repeatCell: {
            range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.1, green: 0.1, blue: 0.12 },
                textFormat: {
                  bold: true,
                  foregroundColor: { red: 1, green: 1, blue: 1 },
                },
              },
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat)',
          },
        })),
      }),
    },
  );
}

async function ensureRequiredTabs(
  accessToken: string,
  spreadsheetId: string,
): Promise<SpreadsheetMetadata> {
  const meta = await inspectSpreadsheet(accessToken, spreadsheetId);
  const requests: Array<{
    addSheet: {
      properties: {
        title: string;
        gridProperties: { frozenRowCount: number };
      };
    };
  }> = [];

  for (const tab of REQUIRED_TABS) {
    if (!meta.sheetNames.includes(tab)) {
      requests.push({
        addSheet: {
          properties: {
            title: tab,
            gridProperties: { frozenRowCount: 1 },
          },
        },
      });
    }
  }

  if (requests.length > 0) {
    await sheetsFetch(
      `${SHEETS_API_BASE}/${encodeURIComponent(spreadsheetId)}:batchUpdate`,
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify({ requests }),
      },
    );
    const updated = await inspectSpreadsheet(accessToken, spreadsheetId);
    const addedIds = requests
      .map((r) => updated.sheetIdsByName[r.addSheet.properties.title])
      .filter((id): id is number => typeof id === 'number');
    await formatHeaderRows(accessToken, spreadsheetId, addedIds);
    return updated;
  }

  return meta;
}

export async function createUsersSpreadsheet(
  accessToken: string,
  title: string,
): Promise<SpreadsheetMetadata> {
  const created = await sheetsFetch<{
    spreadsheetId: string;
    spreadsheetUrl: string;
    properties: { title: string };
    sheets: Array<{ properties: { title: string; sheetId: number } }>;
  }>(SHEETS_API_BASE, accessToken, {
    method: 'POST',
    body: JSON.stringify({
      properties: { title },
      sheets: REQUIRED_TABS.map((tab) => ({
        properties: {
          title: tab,
          gridProperties: { frozenRowCount: 1 },
        },
      })),
    }),
  });

  const sheetIdsByName: Record<string, number> = {};
  const sheetIds: number[] = [];
  for (const s of created.sheets) {
    sheetIdsByName[s.properties.title] = s.properties.sheetId;
    sheetIds.push(s.properties.sheetId);
  }

  await formatHeaderRows(accessToken, created.spreadsheetId, sheetIds);

  return {
    spreadsheetId: created.spreadsheetId,
    title: created.properties.title,
    spreadsheetUrl: created.spreadsheetUrl,
    sheetNames: created.sheets.map((s) => s.properties.title),
    sheetIdsByName,
  };
}

export async function resetAndInitializeSpreadsheet(
  accessToken: string,
  spreadsheetId: string,
): Promise<SpreadsheetMetadata> {
  const meta = await ensureRequiredTabs(accessToken, spreadsheetId);

  // Clear ALL existing tabs in the spreadsheet cleanly
  const clearRanges = meta.sheetNames.map((name) => `'${name}'!A1:Z5000`);
  if (clearRanges.length > 0) {
    await sheetsFetch(
      `${SHEETS_API_BASE}/${encodeURIComponent(spreadsheetId)}/values:batchClear`,
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify({ ranges: clearRanges }),
      },
    );
  }

  // Format header rows on all 5 required tabs
  const reqIds = REQUIRED_TABS.map((t) => meta.sheetIdsByName[t]).filter(
    (id): id is number => typeof id === 'number',
  );
  await formatHeaderRows(accessToken, spreadsheetId, reqIds);

  // Write clean header rows across all 5 tabs
  await sheetsFetch(
    `${SHEETS_API_BASE}/${encodeURIComponent(spreadsheetId)}/values:batchUpdate`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: [
          { range: 'Users!A1', values: [USERS_HEADERS] },
          { range: 'AuthLogs!A1', values: [LOGS_HEADERS] },
          { range: 'SearchLogs!A1', values: [SEARCH_LOGS_HEADERS] },
          { range: 'ListeningLogs!A1', values: [LISTENING_LOGS_HEADERS] },
          { range: 'LiveSessions!A1', values: [LIVE_SESSIONS_HEADERS] },
        ],
      }),
    },
  );

  return meta;
}

export async function syncAllToSheets(
  accessToken: string,
  spreadsheetId: string,
  users: AppUser[],
  logs: AuthEventLog[],
  searchLogs: SearchLogEntry[] = [],
  listeningLogs: ListeningLogEntry[] = [],
  liveSessions: LiveUserSession[] = [],
): Promise<SpreadsheetMetadata> {
  const meta = await ensureRequiredTabs(accessToken, spreadsheetId);

  const userRows = users.map((u) => [
    u.id,
    u.email,
    u.name,
    u.provider === 'google' ? 'Google Social' : 'Email / Password',
    u.role,
    u.createdAt,
    u.lastLoginAt,
    String(u.loginCount),
    u.role === 'suspended' ? 'Suspended' : 'Active',
    u.currentTrackTitle || '',
    u.currentTrackArtist || '',
    u.isPlaying ? 'Playing' : u.currentTrackTitle ? 'Paused' : 'Idle',
    u.lastSearchQuery || '',
  ]);

  const logRows = logs.slice(0, 500).map((l) => [
    l.id,
    l.timestamp,
    l.event,
    l.email,
    l.name,
    l.provider === 'google' ? 'Google Social' : 'Email / Password',
    l.role,
    l.details,
  ]);

  const searchRows = searchLogs.slice(0, 500).map((s) => [
    s.id,
    s.timestamp,
    s.userId,
    s.userName,
    s.userEmail,
    s.query,
    String(s.resultCount),
    s.sessionId,
  ]);

  const listenRows = listeningLogs.slice(0, 500).map((lst) => [
    lst.id,
    lst.timestamp,
    lst.userId,
    lst.userName,
    lst.userEmail,
    lst.trackTitle,
    lst.artist,
    lst.youtubeId,
    lst.duration,
    lst.action,
    String(lst.positionSec),
    lst.sessionId,
  ]);

  const liveRows = liveSessions.slice(0, 200).map((sess) => [
    sess.sessionId,
    sess.userId,
    sess.userName,
    sess.userEmail,
    sess.userRole,
    sess.activeTab,
    sess.isPlaying ? 'Playing' : sess.currentTrack ? 'Paused' : 'Browsing',
    sess.currentTrack?.title || '-',
    sess.currentTrack?.artist || '-',
    sess.currentTrack
      ? `${Math.floor(sess.currentTime)}s / ${Math.floor(sess.duration || sess.currentTrack.durationSec)}s`
      : '-',
    sess.lastSearchQuery || '-',
    sess.lastSeenAt,
  ]);

  // Clear existing ranges cleanly first so removed/reset rows don't leave stale trailing rows
  await sheetsFetch(
    `${SHEETS_API_BASE}/${encodeURIComponent(spreadsheetId)}/values:batchClear`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        ranges: [
          'Users!A1:M1000',
          'AuthLogs!A1:H1000',
          'SearchLogs!A1:H1000',
          'ListeningLogs!A1:L1000',
          'LiveSessions!A1:L1000',
        ],
      }),
    },
  );

  await sheetsFetch(
    `${SHEETS_API_BASE}/${encodeURIComponent(spreadsheetId)}/values:batchUpdate`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: [
          { range: 'Users!A1', values: [USERS_HEADERS, ...userRows] },
          { range: 'AuthLogs!A1', values: [LOGS_HEADERS, ...logRows] },
          { range: 'SearchLogs!A1', values: [SEARCH_LOGS_HEADERS, ...searchRows] },
          {
            range: 'ListeningLogs!A1',
            values: [LISTENING_LOGS_HEADERS, ...listenRows],
          },
          {
            range: 'LiveSessions!A1',
            values: [LIVE_SESSIONS_HEADERS, ...liveRows],
          },
        ],
      }),
    },
  );

  return meta;
}

export async function readSheetPreview(
  accessToken: string,
  spreadsheetId: string,
): Promise<SheetPreviewData> {
  const meta = await ensureRequiredTabs(accessToken, spreadsheetId);

  const ranges = [
    'Users!A1:M200',
    'AuthLogs!A1:H200',
    'SearchLogs!A1:H200',
    'ListeningLogs!A1:L200',
    'LiveSessions!A1:L200',
  ];
  const query = ranges.map((r) => `ranges=${encodeURIComponent(r)}`).join('&');

  const res = await sheetsFetch<{
    valueRanges: Array<{ values?: string[][] }>;
  }>(
    `${SHEETS_API_BASE}/${encodeURIComponent(spreadsheetId)}/values:batchGet?${query}`,
    accessToken,
  );

  const vUsers = res.valueRanges[0]?.values ?? [];
  const vAuth = res.valueRanges[1]?.values ?? [];
  const vSearch = res.valueRanges[2]?.values ?? [];
  const vListen = res.valueRanges[3]?.values ?? [];
  const vLive = res.valueRanges[4]?.values ?? [];

  return {
    spreadsheetTitle: meta.title,
    tabs: {
      Users: {
        headers: vUsers[0] ?? USERS_HEADERS,
        rows: vUsers.slice(1),
      },
      AuthLogs: {
        headers: vAuth[0] ?? LOGS_HEADERS,
        rows: vAuth.slice(1),
      },
      SearchLogs: {
        headers: vSearch[0] ?? SEARCH_LOGS_HEADERS,
        rows: vSearch.slice(1),
      },
      ListeningLogs: {
        headers: vListen[0] ?? LISTENING_LOGS_HEADERS,
        rows: vListen.slice(1),
      },
      LiveSessions: {
        headers: vLive[0] ?? LIVE_SESSIONS_HEADERS,
        rows: vLive.slice(1),
      },
    },
  };
}

export function extractSpreadsheetIdFromInput(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/\/spreadsheets\/(?:u\/\d+\/)?d\/([a-zA-Z0-9-_]+)/);
  if (match?.[1]) return match[1];
  return trimmed;
}
