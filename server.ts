import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import type {
  AppUIConfig,
  AppUser,
  AuthEventLog,
  EditorialPlaylist,
  ListeningAction,
  ListeningLogEntry,
  LiveUserSession,
  NavTab,
  SearchLogEntry,
  Track,
  UserRole,
} from './src/types.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.resolve(__dirname, 'data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');
const SESSION_COOKIE = 'sonata_session';
const DEV_ADMIN_UID = 'usr_dev_admin';
const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  crypto.createHash('sha256').update(path.resolve(__dirname)).digest('hex');

interface StoredUser extends AppUser {
  passwordHash?: string;
  passwordSalt?: string;
  firebaseUid?: string;
}

interface StoreData {
  config: AppUIConfig;
  users: StoredUser[];
  authLogs: AuthEventLog[];
  searchLogs: SearchLogEntry[];
  listeningLogs: ListeningLogEntry[];
  tracks: Track[];
  playlists: EditorialPlaylist[];
  favoritesByUser: Record<string, string[]>;
}

const DEFAULT_CONFIG: AppUIConfig = {
  appName: 'Sonata Music',
  heroKicker: 'Spatial Audio & Curated YouTube Streams',
  heroTitle: '음악이 머무는 가장 순수한 공간',
  heroSubtitle:
    '엄선된 K-Pop, R&B, 인디, 로파이 사운드를 Apple Music 감성의 미니멀한 인터페이스로 감상하세요.',
  announcement: '',
  themeMode: 'dark',
  accentColor: '#FA243C',
  layoutDensity: 'editorial',
  cardRadius: 'rounded',
  navLabels: {
    listenNow: '지금 듣기',
    browse: '둘러보기',
    charts: '인기 차트',
    library: '보관함',
  },
  visibleSections: {
    heroBanner: true,
    editorialPlaylists: true,
    quickPicks: true,
    charts: true,
  },
  spreadsheetId: '',
  spreadsheetTitle: '',
  lastSheetsSyncAt: null,
  autoSyncSheets: false,
  updatedAt: new Date().toISOString(),
  updatedBy: 'System',
};

const SEED_TRACKS: Track[] = [
  {
    id: 'trk_1',
    youtubeId: 'ArmDp-zijuc',
    title: 'Super Shy',
    artist: 'NewJeans',
    album: 'Get Up - EP',
    genre: 'K-Pop',
    duration: '2:35',
    durationSec: 155,
    coverUrl: 'https://i.ytimg.com/vi/ArmDp-zijuc/hqdefault.jpg',
    createdAt: '2026-11-10T09:00:00.000Z',
    plays: 18420,
  },
  {
    id: 'trk_2',
    youtubeId: 'pSUydWEqKwE',
    title: 'Ditto',
    artist: 'NewJeans',
    album: 'OMG',
    genre: 'K-Pop',
    duration: '3:06',
    durationSec: 186,
    coverUrl: 'https://i.ytimg.com/vi/pSUydWEqKwE/hqdefault.jpg',
    createdAt: '2026-11-10T09:05:00.000Z',
    plays: 24150,
  },
  {
    id: 'trk_3',
    youtubeId: 'Y8JFxS1HlDo',
    title: 'LOVE DIVE',
    artist: 'IVE',
    album: 'LOVE DIVE',
    genre: 'K-Pop',
    duration: '2:58',
    durationSec: 178,
    coverUrl: 'https://i.ytimg.com/vi/Y8JFxS1HlDo/hqdefault.jpg',
    createdAt: '2026-11-10T09:10:00.000Z',
    plays: 16890,
  },
  {
    id: 'trk_4',
    youtubeId: 'dxIG9Jtakws',
    title: 'Blueming',
    artist: 'IU (아이유)',
    album: 'Love poem',
    genre: 'K-Pop',
    duration: '3:37',
    durationSec: 217,
    coverUrl: 'https://i.ytimg.com/vi/dxIG9Jtakws/hqdefault.jpg',
    createdAt: '2026-11-10T09:15:00.000Z',
    plays: 21340,
  },
  {
    id: 'trk_5',
    youtubeId: 'D1PvIWdJ8xo',
    title: 'eight (Prod. & Feat. SUGA)',
    artist: 'IU (아이유)',
    album: 'eight - Single',
    genre: 'K-Pop',
    duration: '2:48',
    durationSec: 168,
    coverUrl: 'https://i.ytimg.com/vi/D1PvIWdJ8xo/hqdefault.jpg',
    createdAt: '2026-11-10T09:20:00.000Z',
    plays: 19510,
  },
  {
    id: 'trk_6',
    youtubeId: '4NRXx6U8ABQ',
    title: 'Blinding Lights',
    artist: 'The Weeknd',
    album: 'After Hours',
    genre: 'Pop',
    duration: '3:22',
    durationSec: 202,
    coverUrl: 'https://i.ytimg.com/vi/4NRXx6U8ABQ/hqdefault.jpg',
    createdAt: '2026-11-10T09:25:00.000Z',
    plays: 31200,
  },
  {
    id: 'trk_7',
    youtubeId: 'kTJczUoc26U',
    title: 'STAY',
    artist: 'The Kid LAROI & Justin Bieber',
    album: 'F*CK LOVE 3: OVER YOU',
    genre: 'Pop',
    duration: '2:22',
    durationSec: 142,
    coverUrl: 'https://i.ytimg.com/vi/kTJczUoc26U/hqdefault.jpg',
    createdAt: '2026-11-10T09:30:00.000Z',
    plays: 22740,
  },
  {
    id: 'trk_8',
    youtubeId: 'tQ0yjYUFKAE',
    title: 'Peaches (feat. Daniel Caesar & Giveon)',
    artist: 'Justin Bieber',
    album: 'Justice',
    genre: 'R&B',
    duration: '3:18',
    durationSec: 198,
    coverUrl: 'https://i.ytimg.com/vi/tQ0yjYUFKAE/hqdefault.jpg',
    createdAt: '2026-11-10T09:35:00.000Z',
    plays: 15980,
  },
  {
    id: 'trk_9',
    youtubeId: 'DyDfgMOUjCI',
    title: 'bad guy',
    artist: 'Billie Eilish',
    album: 'WHEN WE ALL FALL ASLEEP, WHERE DO WE GO?',
    genre: 'Pop',
    duration: '3:14',
    durationSec: 194,
    coverUrl: 'https://i.ytimg.com/vi/DyDfgMOUjCI/hqdefault.jpg',
    createdAt: '2026-11-10T09:40:00.000Z',
    plays: 20610,
  },
  {
    id: 'trk_10',
    youtubeId: 'V1Pl8CzNzCw',
    title: 'lovely',
    artist: 'Billie Eilish & Khalid',
    album: '13 Reasons Why (Season 2)',
    genre: 'R&B',
    duration: '3:21',
    durationSec: 201,
    coverUrl: 'https://i.ytimg.com/vi/V1Pl8CzNzCw/hqdefault.jpg',
    createdAt: '2026-11-10T09:45:00.000Z',
    plays: 19230,
  },
  {
    id: 'trk_11',
    youtubeId: 'jfKfPfyJRdk',
    title: 'lofi hip hop radio - beats to relax/study to',
    artist: 'Lofi Girl',
    album: 'ChilledCow Sessions',
    genre: 'Lo-Fi & Jazz',
    duration: 'LIVE',
    durationSec: 0,
    coverUrl: 'https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg',
    createdAt: '2026-11-10T09:50:00.000Z',
    plays: 42100,
  },
  {
    id: 'trk_12',
    youtubeId: '2Vv-BfVoq4g',
    title: 'Perfect',
    artist: 'Ed Sheeran',
    album: '÷ (Divide)',
    genre: 'Indie & Acoustic',
    duration: '4:23',
    durationSec: 263,
    coverUrl: 'https://i.ytimg.com/vi/2Vv-BfVoq4g/hqdefault.jpg',
    createdAt: '2026-11-10T09:55:00.000Z',
    plays: 25400,
  },
  {
    id: 'trk_13',
    youtubeId: 'gdZLi9oWNZg',
    title: 'Dynamite',
    artist: 'BTS',
    album: 'BE',
    genre: 'K-Pop',
    duration: '3:43',
    durationSec: 223,
    coverUrl: 'https://i.ytimg.com/vi/gdZLi9oWNZg/hqdefault.jpg',
    createdAt: '2026-11-10T10:00:00.000Z',
    plays: 29800,
  },
  {
    id: 'trk_14',
    youtubeId: '3AtDnEC4zak',
    title: "We Don't Talk Anymore (feat. Selena Gomez)",
    artist: 'Charlie Puth',
    album: 'Nine Track Mind',
    genre: 'Pop',
    duration: '3:37',
    durationSec: 217,
    coverUrl: 'https://i.ytimg.com/vi/3AtDnEC4zak/hqdefault.jpg',
    createdAt: '2026-11-10T10:05:00.000Z',
    plays: 17320,
  },
  {
    id: 'trk_15',
    youtubeId: 'DWcJFNfaw9c',
    title: 'beats to sleep / chill to',
    artist: 'Lofi Girl',
    album: 'Nighttime Vinyl',
    genre: 'Lo-Fi & Jazz',
    duration: 'LIVE',
    durationSec: 0,
    coverUrl: 'https://i.ytimg.com/vi/DWcJFNfaw9c/hqdefault.jpg',
    createdAt: '2026-11-10T10:10:00.000Z',
    plays: 14920,
  },
  {
    id: 'trk_16',
    youtubeId: 'nCkpzqqog4k',
    title: "I'm Not The Only One",
    artist: 'Sam Smith',
    album: 'In the Lonely Hour',
    genre: 'R&B',
    duration: '3:59',
    durationSec: 239,
    coverUrl: 'https://i.ytimg.com/vi/nCkpzqqog4k/hqdefault.jpg',
    createdAt: '2026-11-10T10:15:00.000Z',
    plays: 16450,
  },
];

const SEED_PLAYLISTS: EditorialPlaylist[] = [
  {
    id: 'pl_midnight_seoul',
    title: 'Midnight Seoul',
    subtitle: '새벽 감성 K-Pop & R&B 에센셜',
    description: '비 내리는 서울의 밤, 깊고 부드러운 보컬과 신스 사운드를 담았습니다.',
    coverUrl: '/src/assets/images/playlist_midnight_seoul_1795083326642.jpg',
    trackIds: ['trk_2', 'trk_4', 'trk_5', 'trk_1', 'trk_3', 'trk_13'],
    accentHue: '#FA243C',
  },
  {
    id: 'pl_analog_dreams',
    title: 'Analog Dreams',
    subtitle: '진공관 사운드 & 로파이 믹스',
    description: '집중과 휴식을 위한 아날로그 질감의 로파이 비트와 다운템포 트랙.',
    coverUrl: '/src/assets/images/playlist_analog_dreams_1795083326844.jpg',
    trackIds: ['trk_11', 'trk_15', 'trk_6', 'trk_8', 'trk_9'],
    accentHue: '#D97706',
  },
  {
    id: 'pl_velvet_acoustic',
    title: 'Velvet Acoustic',
    subtitle: '어쿠스틱 & 소울풀 발라드',
    description: '따뜻한 어쿠스틱 선율과 호소력 있는 보이스가 돋보이는 큐레이션.',
    coverUrl: '/src/assets/images/playlist_velvet_acoustic_1795083326114.jpg',
    trackIds: ['trk_12', 'trk_10', 'trk_16', 'trk_14', 'trk_7'],
    accentHue: '#0A84FF',
  },
];

function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, actualSalt, 64).toString('hex');
  return { hash: derived, salt: actualSalt };
}

function verifyPassword(password: string, hash: string, salt: string): boolean {
  const derived = crypto.scryptSync(password, salt, 64);
  const stored = Buffer.from(hash, 'hex');
  if (derived.length !== stored.length) return false;
  return crypto.timingSafeEqual(derived, stored);
}

function verifyDevAdminCredentials(identifier: string, password: string): boolean {
  const expectedIdHash = process.env.DEV_ADMIN_ID_HASH || '';
  const salt = process.env.DEV_ADMIN_PW_SALT || '';
  const expectedPwHash = process.env.DEV_ADMIN_PW_HASH || '';
  if (!expectedIdHash || !salt || !expectedPwHash || !identifier || !password) {
    return false;
  }
  const actualIdHash = crypto
    .createHash('sha256')
    .update(identifier.trim())
    .digest('hex');
  const idBufA = Buffer.from(actualIdHash, 'hex');
  const idBufB = Buffer.from(expectedIdHash, 'hex');
  if (idBufA.length !== idBufB.length || !crypto.timingSafeEqual(idBufA, idBufB)) {
    return false;
  }
  return verifyPassword(password, expectedPwHash, salt);
}

function getDevAdminUser(): StoredUser {
  const now = new Date().toISOString();
  return {
    id: DEV_ADMIN_UID,
    email: 'developer@system.internal',
    name: '개발자',
    provider: 'email',
    role: 'admin',
    createdAt: now,
    lastLoginAt: now,
    loginCount: 1,
    syncedToSheets: true,
  };
}

function createInitialStore(): StoreData {
  const now = new Date().toISOString();

  const initialUsers: StoredUser[] = [
    {
      id: 'usr_owner',
      email: 'sinsungchan1007@gmail.com',
      name: '시스템 관리자',
      provider: 'google',
      role: 'admin',
      createdAt: now,
      lastLoginAt: now,
      loginCount: 1,
      syncedToSheets: false,
    },
  ];

  return {
    config: DEFAULT_CONFIG,
    users: initialUsers,
    authLogs: [],
    searchLogs: [],
    listeningLogs: [],
    tracks: SEED_TRACKS,
    playlists: SEED_PLAYLISTS,
    favoritesByUser: {},
  };
}

function loadStore(): StoreData {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(STORE_PATH)) {
      const initial = createInitialStore();
      fs.writeFileSync(STORE_PATH, JSON.stringify(initial, null, 2), 'utf-8');
      return initial;
    }
    const raw = fs.readFileSync(STORE_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as StoreData;
    return {
      ...createInitialStore(),
      ...parsed,
      searchLogs: Array.isArray(parsed.searchLogs) ? parsed.searchLogs : [],
      listeningLogs: Array.isArray(parsed.listeningLogs) ? parsed.listeningLogs : [],
      config: { ...DEFAULT_CONFIG, ...(parsed.config || {}) },
    };
  } catch (err) {
    console.error('Failed to load store, initializing default:', err);
    return createInitialStore();
  }
}

let store: StoreData = loadStore();

function saveStore() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf-8');
}

function sanitizeUser(u: StoredUser): AppUser {
  const { passwordHash: _ph, passwordSalt: _ps, firebaseUid: _fu, ...safe } = u;
  return safe;
}

function signSessionToken(userId: string): string {
  const payload = Buffer.from(
    JSON.stringify({ uid: userId, iat: Date.now() }),
    'utf-8',
  ).toString('base64url');
  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payload)
    .digest('base64url');
  return `${payload}.${sig}`;
}

function verifySessionToken(token: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payload)
    .digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8')) as {
      uid?: string;
    };
    return decoded.uid || null;
  } catch {
    return null;
  }
}

function parseCookies(header?: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0) {
      const k = part.slice(0, idx).trim();
      const v = part.slice(idx + 1).trim();
      out[k] = decodeURIComponent(v);
    }
  }
  return out;
}

function getAuthenticatedUserFromToken(token: string): StoredUser | null {
  if (!token) return null;
  const uid = verifySessionToken(token);
  if (!uid) return null;
  if (uid === DEV_ADMIN_UID) {
    return getDevAdminUser();
  }
  const user = store.users.find((u) => u.id === uid);
  if (!user || user.role === 'suspended') return null;
  return user;
}

function getAuthenticatedUser(req: Request, allowQueryToken = false): StoredUser | null {
  const authHeader = req.headers.authorization;
  let token = '';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else if (allowQueryToken && typeof req.query.token === 'string' && req.query.token) {
    token = req.query.token.trim();
  } else {
    const cookies = parseCookies(req.headers.cookie);
    token = cookies[SESSION_COOKIE] || '';
  }
  return getAuthenticatedUserFromToken(token);
}

function setSessionCookie(req: Request, res: Response, userId: string): string {
  const token = signSessionToken(userId);
  const proto = String(req.headers['x-forwarded-proto'] || '');
  const isHttps = req.secure || proto.includes('https');
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: isHttps ? 'none' : 'lax',
    secure: isHttps,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  return token;
}

function appendAuthLog(
  event: AuthEventLog['event'],
  user: StoredUser,
  details: string,
) {
  const entry: AuthEventLog = {
    id: `log_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    timestamp: new Date().toISOString(),
    event,
    email: user.email,
    name: user.name,
    provider: user.provider,
    role: user.role,
    details,
    syncedToSheets: false,
  };
  store.authLogs.unshift(entry);
  if (store.authLogs.length > 500) {
    store.authLogs = store.authLogs.slice(0, 500);
  }
}

function extractYoutubeId(input: string): string | null {
  const trimmed = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }
  try {
    const url = new URL(trimmed);
    if (url.hostname.includes('youtu.be')) {
      const id = url.pathname.replace('/', '').slice(0, 11);
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }
    const v = url.searchParams.get('v');
    if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) {
      return v;
    }
    const embedMatch = url.pathname.match(/\/(embed|shorts|live)\/([a-zA-Z0-9_-]{11})/);
    if (embedMatch?.[2]) return embedMatch[2];
  } catch {
    return null;
  }
  return null;
}

function parseDurationToSeconds(text: string): number {
  if (!text || text.toUpperCase() === 'LIVE') return 0;
  const parts = text
    .split(':')
    .map((p) => Number.parseInt(p, 10))
    .filter((n) => !Number.isNaN(n));
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 210;
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");
}

function parseIso8601Duration(iso: string): { label: string; seconds: number } {
  const match = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return { label: 'LIVE', seconds: 0 };
  const hours = Number.parseInt(match[1] || '0', 10);
  const mins = Number.parseInt(match[2] || '0', 10);
  const secs = Number.parseInt(match[3] || '0', 10);
  const total = hours * 3600 + mins * 60 + secs;
  if (total <= 0) return { label: 'LIVE', seconds: 0 };
  const label =
    hours > 0
      ? `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
      : `${mins}:${secs.toString().padStart(2, '0')}`;
  return { label, seconds: total };
}

async function searchYouTubeLive(query: string): Promise<Track[]> {
  const ytKey = process.env.YOUTUBE_API_KEY;
  if (ytKey) {
    try {
      const ytUrl = new URL('https://www.googleapis.com/youtube/v3/search');
      ytUrl.searchParams.set('part', 'snippet');
      ytUrl.searchParams.set('type', 'video');
      ytUrl.searchParams.set('videoEmbeddable', 'true');
      ytUrl.searchParams.set('maxResults', '15');
      ytUrl.searchParams.set('q', query);
      ytUrl.searchParams.set('key', ytKey);

      const ytRes = await fetch(ytUrl.toString());
      if (ytRes.ok) {
        const ytData = (await ytRes.json()) as {
          items?: Array<{
            id?: { videoId?: string };
            snippet?: {
              title?: string;
              channelTitle?: string;
              thumbnails?: { high?: { url?: string } };
            };
          }>;
        };

        const ids = (ytData.items || [])
          .map((item) => item.id?.videoId)
          .filter((id): id is string => Boolean(id));

        if (ids.length > 0) {
          const videosUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
          videosUrl.searchParams.set('part', 'snippet,contentDetails,status');
          videosUrl.searchParams.set('id', ids.join(','));
          videosUrl.searchParams.set('key', ytKey);

          const vRes = await fetch(videosUrl.toString());
          if (vRes.ok) {
            const vData = (await vRes.json()) as {
              items?: Array<{
                id: string;
                snippet?: {
                  title?: string;
                  channelTitle?: string;
                  thumbnails?: { high?: { url?: string } };
                };
                contentDetails?: { duration?: string };
                status?: { embeddable?: boolean };
              }>;
            };

            const verifiedTracks: Track[] = (vData.items || [])
              .filter((v) => v.status?.embeddable !== false)
              .slice(0, 12)
              .map((v) => {
                const dur = parseIso8601Duration(v.contentDetails?.duration || '');
                return {
                  id: `yt_${v.id}`,
                  youtubeId: v.id,
                  title: decodeHtmlEntities(v.snippet?.title || 'Untitled Track'),
                  artist: decodeHtmlEntities(v.snippet?.channelTitle || 'YouTube Music'),
                  album: 'YouTube Music',
                  genre: 'YouTube',
                  duration: dur.label,
                  durationSec: dur.seconds,
                  coverUrl:
                    v.snippet?.thumbnails?.high?.url ||
                    `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`,
                  createdAt: new Date().toISOString(),
                  plays: 0,
                };
              });

            if (verifiedTracks.length > 0) return verifiedTracks;
          }
        }
      }
    } catch {
      // fall back to direct server-side YouTube search without exposing API key
    }
  }

  // Zero-key live YouTube search via server-side fetch
  const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=EgIQAQ%3D%3D`;
  const ytHtmlRes = await fetch(searchUrl, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
    },
  });
  if (!ytHtmlRes.ok) return [];
  const html = await ytHtmlRes.text();
  const match = html.match(/var ytInitialData = (\{.*?\});<\/script>/);
  if (!match?.[1]) return [];

  const data = JSON.parse(match[1]) as {
    contents?: {
      twoColumnSearchResultsRenderer?: {
        primaryContents?: {
          sectionListRenderer?: {
            contents?: Array<{
              itemSectionRenderer?: {
                contents?: Array<{
                  videoRenderer?: {
                    videoId?: string;
                    title?: { runs?: Array<{ text?: string }> };
                    ownerText?: { runs?: Array<{ text?: string }> };
                    lengthText?: { simpleText?: string };
                  };
                }>;
              };
            }>;
          };
        };
      };
    };
  };

  const sections =
    data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer
      ?.contents || [];
  const results: Track[] = [];
  const seen = new Set<string>();

  for (const sec of sections) {
    for (const item of sec?.itemSectionRenderer?.contents || []) {
      const v = item?.videoRenderer;
      if (!v?.videoId || seen.has(v.videoId)) continue;
      seen.add(v.videoId);
      const title =
        v.title?.runs?.map((r) => r.text || '').join('').trim() || 'YouTube Track';
      const artist =
        v.ownerText?.runs?.map((r) => r.text || '').join('').trim() || 'YouTube Music';
      const duration = v.lengthText?.simpleText?.trim() || 'LIVE';

      results.push({
        id: `yt_${v.videoId}`,
        youtubeId: v.videoId,
        title,
        artist,
        album: 'YouTube Search',
        genre: 'YouTube',
        duration,
        durationSec: parseDurationToSeconds(duration),
        coverUrl: `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
        createdAt: new Date().toISOString(),
        plays: 0,
      });

      if (results.length >= 12) break;
    }
    if (results.length >= 12) break;
  }

  return results;
}

// SSE clients for real-time global UI / catalog updates
const sseClients = new Set<Response>();
// Admin-only SSE clients for real-time user monitoring & search/listening logs
const adminSseClients = new Set<Response>();
// Server-authoritative live user sessions
const liveSessions = new Map<string, LiveUserSession>();

function pruneStaleSessions() {
  const cutoff = Date.now() - 45000;
  for (const [sid, session] of liveSessions.entries()) {
    if (new Date(session.lastSeenAt).getTime() < cutoff) {
      liveSessions.delete(sid);
    }
  }
}

function getActiveLiveSessions(): LiveUserSession[] {
  pruneStaleSessions();
  return Array.from(liveSessions.values()).sort(
    (a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime(),
  );
}

function broadcastSSE(event: string, data: unknown) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    client.write(payload);
  }
}

function broadcastAdminSSE(event: string, data: unknown) {
  if (adminSseClients.size === 0) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of adminSseClients) {
    client.write(payload);
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // Live Server-Sent Events stream
  app.get('/api/events', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    res.write(`event: connected\ndata: ${JSON.stringify({ ok: true })}\n\n`);
    sseClients.add(res);

    const heartbeat = setInterval(() => {
      res.write(': ping\n\n');
    }, 25000);

    req.on('close', () => {
      clearInterval(heartbeat);
      sseClients.delete(res);
    });
  });

  // Global Config
  app.get('/api/config', (_req: Request, res: Response) => {
    res.json({ config: store.config });
  });

  app.put('/api/config', (req: Request, res: Response) => {
    const actor = getAuthenticatedUser(req);
    if (!actor || (actor.role !== 'admin' && actor.role !== 'editor')) {
      res.status(403).json({ error: '관리자 또는 에디터 권한이 필요합니다.' });
      return;
    }
    const incoming = req.body as Partial<AppUIConfig>;
    store.config = {
      ...store.config,
      ...incoming,
      navLabels: {
        ...store.config.navLabels,
        ...(incoming.navLabels || {}),
      },
      visibleSections: {
        ...store.config.visibleSections,
        ...(incoming.visibleSections || {}),
      },
      updatedAt: new Date().toISOString(),
      updatedBy: actor.name || actor.email,
    };
    saveStore();
    broadcastSSE('config_updated', store.config);
    res.json({ config: store.config });
  });

  app.post('/api/config/reset', (req: Request, res: Response) => {
    const actor = getAuthenticatedUser(req);
    if (!actor || actor.role !== 'admin') {
      res.status(403).json({ error: '관리자 권한이 필요합니다.' });
      return;
    }
    store.config = {
      ...DEFAULT_CONFIG,
      spreadsheetId: store.config.spreadsheetId,
      spreadsheetTitle: store.config.spreadsheetTitle,
      lastSheetsSyncAt: store.config.lastSheetsSyncAt,
      updatedAt: new Date().toISOString(),
      updatedBy: actor.name || actor.email,
    };
    saveStore();
    broadcastSSE('config_updated', store.config);
    res.json({ config: store.config });
  });

  // Auth Endpoints
  app.get('/api/auth/me', (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      res.json({ user: null });
      return;
    }
    res.json({ user: sanitizeUser(user) });
  });

  app.post('/api/auth/signup', (req: Request, res: Response) => {
    const { email, password, name } = req.body as {
      email?: string;
      password?: string;
      name?: string;
    };

    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanName = (name || '').trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      res.status(400).json({ error: '유효한 이메일 주소를 입력해 주세요.' });
      return;
    }
    if (!password || password.length < 6) {
      res.status(400).json({ error: '비밀번호는 6자 이상이어야 합니다.' });
      return;
    }
    if (!cleanName) {
      res.status(400).json({ error: '이름을 입력해 주세요.' });
      return;
    }

    const existing = store.users.find((u) => u.email.toLowerCase() === cleanEmail);
    if (existing) {
      res.status(409).json({ error: '이미 가입된 이메일입니다.' });
      return;
    }

    const now = new Date().toISOString();
    const { hash, salt } = hashPassword(password);
    const assignedRole: UserRole =
      cleanEmail === 'sinsungchan1007@gmail.com' ? 'admin' : 'user';

    const newUser: StoredUser = {
      id: `usr_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      email: cleanEmail,
      name: cleanName,
      provider: 'email',
      role: assignedRole,
      passwordHash: hash,
      passwordSalt: salt,
      createdAt: now,
      lastLoginAt: now,
      loginCount: 1,
      syncedToSheets: false,
    };

    store.users.unshift(newUser);
    appendAuthLog('SIGNUP', newUser, '이메일 회원가입');
    saveStore();
    broadcastSSE('users_updated', { count: store.users.length });

    const sessionToken = setSessionCookie(req, res, newUser.id);
    res.status(201).json({
      user: sanitizeUser(newUser),
      sessionToken,
      usersSnapshot: newUser.role === 'admin' ? store.users.map(sanitizeUser) : undefined,
      logsSnapshot: newUser.role === 'admin' ? store.authLogs : undefined,
    });
  });

  app.post('/api/auth/login', (req: Request, res: Response) => {
    const { email, password } = req.body as { email?: string; password?: string };
    const rawIdentifier = (email || '').trim();

    // Verify private developer admin credentials via server-side hashes only
    if (verifyDevAdminCredentials(rawIdentifier, password || '')) {
      const devUser = getDevAdminUser();
      const sessionToken = setSessionCookie(req, res, DEV_ADMIN_UID);
      res.json({ user: sanitizeUser(devUser), sessionToken });
      return;
    }

    const cleanEmail = rawIdentifier.toLowerCase();
    const user = store.users.find((u) => u.email.toLowerCase() === cleanEmail);

    if (!user || !user.passwordHash || !user.passwordSalt) {
      res.status(401).json({ error: '아이디/이메일 또는 비밀번호가 올바르지 않습니다.' });
      return;
    }
    if (!verifyPassword(password || '', user.passwordHash, user.passwordSalt)) {
      res.status(401).json({ error: '아이디/이메일 또는 비밀번호가 올바르지 않습니다.' });
      return;
    }
    if (user.role === 'suspended') {
      res.status(403).json({ error: '관리자에 의해 이용이 정지된 계정입니다.' });
      return;
    }

    user.lastLoginAt = new Date().toISOString();
    user.loginCount += 1;
    user.syncedToSheets = false;
    appendAuthLog('LOGIN', user, '이메일 로그인');
    saveStore();
    broadcastSSE('users_updated', { count: store.users.length });
    broadcastAdminSSE('activity_logged', { type: 'auth' });

    const sessionToken = setSessionCookie(req, res, user.id);
    res.json({ user: sanitizeUser(user), sessionToken });
  });

  app.post('/api/auth/social', (req: Request, res: Response) => {
    const { email, name, photoURL, uid } = req.body as {
      email?: string;
      name?: string;
      photoURL?: string;
      uid?: string;
    };

    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail) {
      res.status(400).json({ error: '소셜 계정 이메일 정보가 없습니다.' });
      return;
    }

    const now = new Date().toISOString();
    let user = store.users.find((u) => u.email.toLowerCase() === cleanEmail);
    let isNew = false;

    if (!user) {
      isNew = true;
      const role: UserRole =
        cleanEmail === 'sinsungchan1007@gmail.com' ? 'admin' : 'user';
      user = {
        id: `usr_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
        email: cleanEmail,
        name: (name || cleanEmail.split('@')[0]).trim(),
        provider: 'google',
        role,
        photoURL: photoURL || undefined,
        firebaseUid: uid,
        createdAt: now,
        lastLoginAt: now,
        loginCount: 1,
        syncedToSheets: false,
      };
      store.users.unshift(user);
      appendAuthLog('SOCIAL_SIGNUP', user, 'Google 소셜 회원가입');
    } else {
      if (user.role === 'suspended') {
        res.status(403).json({ error: '관리자에 의해 이용이 정지된 계정입니다.' });
        return;
      }
      user.provider = 'google';
      if (name) user.name = name.trim();
      if (photoURL) user.photoURL = photoURL;
      if (uid) user.firebaseUid = uid;
      if (cleanEmail === 'sinsungchan1007@gmail.com') {
        user.role = 'admin';
      }
      user.lastLoginAt = now;
      user.loginCount += 1;
      user.syncedToSheets = false;
      appendAuthLog('SOCIAL_LOGIN', user, 'Google 소셜 로그인');
    }

    saveStore();
    broadcastSSE('users_updated', { count: store.users.length });
    const sessionToken = setSessionCookie(req, res, user.id);

    res.json({
      user: sanitizeUser(user),
      sessionToken,
      isNew,
      allUsers: store.users.map(sanitizeUser),
      allLogs: store.authLogs,
    });
  });

  app.post('/api/auth/logout', (_req: Request, res: Response) => {
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.json({ ok: true });
  });

  // Presence & Activity Reporting (User -> Server -> Admin Monitor)
  app.post('/api/presence/heartbeat', (req: Request, res: Response) => {
    const actor = getAuthenticatedUser(req);
    const body = req.body as {
      sessionId?: string;
      activeTab?: NavTab;
      lastSearchQuery?: string;
      currentTrack?: Track | null;
      isPlaying?: boolean;
      currentTime?: number;
      duration?: number;
      volume?: number;
      isMuted?: boolean;
      showVideo?: boolean;
      queuePreview?: Track[];
    };

    const sessionId = (body.sessionId || '').trim();
    if (!sessionId) {
      res.status(400).json({ error: 'sessionId required' });
      return;
    }

    const now = new Date().toISOString();
    const activeTab: NavTab = body.activeTab || 'listen-now';

    // Keep developer console monitoring session separate from listener surveillance
    if (actor?.id === DEV_ADMIN_UID && activeTab === 'admin') {
      liveSessions.delete(sessionId);
      broadcastAdminSSE('presence_updated', { liveSessions: getActiveLiveSessions() });
      res.json({ ok: true });
      return;
    }

    const prev = liveSessions.get(sessionId);
    const session: LiveUserSession = {
      sessionId,
      userId: actor ? actor.id : 'guest',
      userName: actor ? actor.name : `방문자 ${sessionId.slice(-4).toUpperCase()}`,
      userEmail: actor ? actor.email : '비회원 (Guest)',
      userRole: actor ? actor.role : 'guest',
      activeTab,
      lastSearchQuery: (body.lastSearchQuery || '').slice(0, 120),
      currentTrack: body.currentTrack || null,
      isPlaying: Boolean(body.isPlaying),
      currentTime: Number(body.currentTime) || 0,
      duration: Number(body.duration) || 0,
      volume: typeof body.volume === 'number' ? body.volume : 80,
      isMuted: Boolean(body.isMuted),
      showVideo: Boolean(body.showVideo),
      queuePreview: Array.isArray(body.queuePreview) ? body.queuePreview.slice(0, 6) : [],
      connectedAt: prev?.connectedAt || now,
      lastSeenAt: now,
    };

    liveSessions.set(sessionId, session);

    if (actor && actor.id !== DEV_ADMIN_UID) {
      const stored = store.users.find((u) => u.id === actor.id);
      if (stored) {
        stored.currentTrackTitle = session.currentTrack?.title || '';
        stored.currentTrackArtist = session.currentTrack?.artist || '';
        stored.isPlaying = session.isPlaying;
        if (session.lastSearchQuery) {
          stored.lastSearchQuery = session.lastSearchQuery;
        }
        stored.lastActiveAt = now;
        stored.syncedToSheets = false;
      }
    }

    broadcastAdminSSE('presence_updated', { liveSessions: getActiveLiveSessions() });
    res.json({ ok: true });
  });

  app.post('/api/presence/leave', (req: Request, res: Response) => {
    const { sessionId } = (req.body || {}) as { sessionId?: string };
    if (sessionId && liveSessions.delete(sessionId)) {
      broadcastAdminSSE('presence_updated', { liveSessions: getActiveLiveSessions() });
    }
    res.json({ ok: true });
  });

  app.post('/api/activity/search', (req: Request, res: Response) => {
    const actor = getAuthenticatedUser(req);
    const { sessionId, query, resultCount } = req.body as {
      sessionId?: string;
      query?: string;
      resultCount?: number;
    };
    const cleanQuery = (query || '').trim();
    if (!cleanQuery) {
      res.json({ ok: true });
      return;
    }
    const sid = (sessionId || 'unknown').trim();
    const recentDup = store.searchLogs.find(
      (l) =>
        l.sessionId === sid &&
        l.query.toLowerCase() === cleanQuery.toLowerCase() &&
        Date.now() - new Date(l.timestamp).getTime() < 4000,
    );
    if (recentDup) {
      res.json({ ok: true });
      return;
    }

    const entry: SearchLogEntry = {
      id: `srch_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      timestamp: new Date().toISOString(),
      sessionId: sid,
      userId: actor ? actor.id : 'guest',
      userName: actor ? actor.name : `방문자 ${sid.slice(-4).toUpperCase()}`,
      userEmail: actor ? actor.email : '비회원 (Guest)',
      query: cleanQuery,
      resultCount: Number(resultCount) || 0,
      syncedToSheets: false,
    };
    store.searchLogs.unshift(entry);
    if (store.searchLogs.length > 1000) {
      store.searchLogs = store.searchLogs.slice(0, 1000);
    }
    if (actor && actor.id !== DEV_ADMIN_UID) {
      const stored = store.users.find((u) => u.id === actor.id);
      if (stored) {
        stored.lastSearchQuery = cleanQuery;
        stored.lastActiveAt = entry.timestamp;
        stored.syncedToSheets = false;
      }
    }
    saveStore();
    broadcastAdminSSE('activity_logged', {
      searchLog: entry,
      searchLogs: store.searchLogs.slice(0, 150),
    });
    res.json({ ok: true, entry });
  });

  app.post('/api/activity/listen', (req: Request, res: Response) => {
    const actor = getAuthenticatedUser(req);
    const {
      sessionId,
      youtubeId,
      trackTitle,
      artist,
      duration,
      action,
      positionSec,
    } = req.body as {
      sessionId?: string;
      youtubeId?: string;
      trackTitle?: string;
      artist?: string;
      duration?: string;
      action?: ListeningAction;
      positionSec?: number;
    };
    if (!trackTitle || !youtubeId) {
      res.json({ ok: true });
      return;
    }
    const sid = (sessionId || 'unknown').trim();
    const entry: ListeningLogEntry = {
      id: `lst_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      timestamp: new Date().toISOString(),
      sessionId: sid,
      userId: actor ? actor.id : 'guest',
      userName: actor ? actor.name : `방문자 ${sid.slice(-4).toUpperCase()}`,
      userEmail: actor ? actor.email : '비회원 (Guest)',
      youtubeId,
      trackTitle,
      artist: artist || 'Unknown Artist',
      duration: duration || '0:00',
      action: action || 'PLAY',
      positionSec: Math.max(0, Math.floor(Number(positionSec) || 0)),
      syncedToSheets: false,
    };
    store.listeningLogs.unshift(entry);
    if (store.listeningLogs.length > 1000) {
      store.listeningLogs = store.listeningLogs.slice(0, 1000);
    }
    saveStore();
    broadcastAdminSSE('activity_logged', {
      listeningLog: entry,
      listeningLogs: store.listeningLogs.slice(0, 150),
    });
    res.json({ ok: true, entry });
  });

  // Admin-Only Real-Time Monitoring SSE Stream & Snapshot
  app.get('/api/admin/monitor/stream', (req: Request, res: Response) => {
    const actor = getAuthenticatedUser(req, true);
    if (!actor || actor.role !== 'admin') {
      res.status(403).json({ error: '관리자 권한이 필요합니다.' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    res.write(
      `event: monitor_snapshot\ndata: ${JSON.stringify({
        liveSessions: getActiveLiveSessions(),
        searchLogs: store.searchLogs.slice(0, 150),
        listeningLogs: store.listeningLogs.slice(0, 150),
      })}\n\n`,
    );
    adminSseClients.add(res);

    const heartbeat = setInterval(() => {
      res.write(': ping\n\n');
    }, 20000);

    req.on('close', () => {
      clearInterval(heartbeat);
      adminSseClients.delete(res);
    });
  });

  app.get('/api/admin/monitor', (req: Request, res: Response) => {
    const actor = getAuthenticatedUser(req);
    if (!actor || actor.role !== 'admin') {
      res.status(403).json({ error: '관리자 권한이 필요합니다.' });
      return;
    }
    const unsyncedCount =
      store.users.filter((u) => !u.syncedToSheets).length +
      store.authLogs.filter((l) => !l.syncedToSheets).length +
      store.searchLogs.filter((l) => !l.syncedToSheets).length +
      store.listeningLogs.filter((l) => !l.syncedToSheets).length;

    res.json({
      liveSessions: getActiveLiveSessions(),
      searchLogs: store.searchLogs.slice(0, 300),
      listeningLogs: store.listeningLogs.slice(0, 300),
      users: store.users.map(sanitizeUser),
      authLogs: store.authLogs.slice(0, 300),
      unsyncedCount,
    });
  });

  // Admin Endpoints
  app.get('/api/admin/users', (req: Request, res: Response) => {
    const actor = getAuthenticatedUser(req);
    if (!actor || actor.role !== 'admin') {
      res.status(403).json({ error: '관리자 권한이 필요합니다.' });
      return;
    }
    const unsyncedUsers = store.users.filter((u) => !u.syncedToSheets).length;
    const unsyncedLogs = store.authLogs.filter((l) => !l.syncedToSheets).length;
    const unsyncedSearch = store.searchLogs.filter((l) => !l.syncedToSheets).length;
    const unsyncedListen = store.listeningLogs.filter((l) => !l.syncedToSheets).length;
    res.json({
      users: store.users.map(sanitizeUser),
      authLogs: store.authLogs,
      searchLogs: store.searchLogs,
      listeningLogs: store.listeningLogs,
      unsyncedCount: unsyncedUsers + unsyncedLogs + unsyncedSearch + unsyncedListen,
    });
  });

  app.patch('/api/admin/users/:id', (req: Request, res: Response) => {
    const actor = getAuthenticatedUser(req);
    if (!actor || actor.role !== 'admin') {
      res.status(403).json({ error: '관리자 권한이 필요합니다.' });
      return;
    }
    const { id } = req.params;
    const { role, name } = req.body as { role?: UserRole; name?: string };
    const target = store.users.find((u) => u.id === id);
    if (!target) {
      res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
      return;
    }
    if (target.id === actor.id && role && role !== 'admin') {
      res.status(400).json({ error: '본인의 관리자 권한은 해제할 수 없습니다.' });
      return;
    }
    const prevRole = target.role;
    if (role && ['admin', 'editor', 'user', 'suspended'].includes(role)) {
      target.role = role;
    }
    if (name && name.trim()) {
      target.name = name.trim();
    }
    target.syncedToSheets = false;

    if (role && role !== prevRole) {
      appendAuthLog(
        'ROLE_CHANGE',
        target,
        `권한 변경: ${prevRole} → ${role} (by ${actor.email})`,
      );
    }

    saveStore();
    broadcastSSE('users_updated', { count: store.users.length });
    res.json({
      user: sanitizeUser(target),
      users: store.users.map(sanitizeUser),
      authLogs: store.authLogs,
    });
  });

  app.delete('/api/admin/users/:id', (req: Request, res: Response) => {
    const actor = getAuthenticatedUser(req);
    if (!actor || actor.role !== 'admin') {
      res.status(403).json({ error: '관리자 권한이 필요합니다.' });
      return;
    }
    const { id } = req.params;
    if (id === actor.id) {
      res.status(400).json({ error: '현재 로그인된 관리자 계정은 삭제할 수 없습니다.' });
      return;
    }
    const target = store.users.find((u) => u.id === id);
    if (!target) {
      res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
      return;
    }
    store.users = store.users.filter((u) => u.id !== id);
    appendAuthLog('USER_DELETED', target, `계정 삭제 (by ${actor.email})`);
    saveStore();
    broadcastSSE('users_updated', { count: store.users.length });
    res.json({
      users: store.users.map(sanitizeUser),
      authLogs: store.authLogs,
    });
  });

  app.post('/api/admin/sheets-config', (req: Request, res: Response) => {
    const actor = getAuthenticatedUser(req);
    if (!actor || actor.role !== 'admin') {
      res.status(403).json({ error: '관리자 권한이 필요합니다.' });
      return;
    }
    const { spreadsheetId, spreadsheetTitle, autoSyncSheets } = req.body as {
      spreadsheetId?: string;
      spreadsheetTitle?: string;
      autoSyncSheets?: boolean;
    };
    if (typeof spreadsheetId === 'string') {
      store.config.spreadsheetId = spreadsheetId.trim();
    }
    if (typeof spreadsheetTitle === 'string') {
      store.config.spreadsheetTitle = spreadsheetTitle.trim();
    }
    if (typeof autoSyncSheets === 'boolean') {
      store.config.autoSyncSheets = autoSyncSheets;
    }
    store.config.updatedAt = new Date().toISOString();
    store.config.updatedBy = actor.name || actor.email;
    saveStore();
    broadcastSSE('config_updated', store.config);
    res.json({ config: store.config });
  });

  app.post('/api/admin/reset-logs', (req: Request, res: Response) => {
    const actor = getAuthenticatedUser(req);
    if (!actor || actor.role !== 'admin') {
      res.status(403).json({ error: '관리자 권한이 필요합니다.' });
      return;
    }
    const { clearUsers } = (req.body || {}) as { clearUsers?: boolean };
    store.authLogs = [];
    store.searchLogs = [];
    store.listeningLogs = [];
    if (clearUsers) {
      store.users = store.users.filter(
        (u) => u.email.toLowerCase() === 'sinsungchan1007@gmail.com' || u.id === actor.id,
      );
    }
    for (const u of store.users) {
      u.syncedToSheets = false;
    }
    store.config.lastSheetsSyncAt = null;
    saveStore();
    broadcastAdminSSE('monitor_snapshot', {
      liveSessions: getActiveLiveSessions(),
      searchLogs: [],
      listeningLogs: [],
    });
    res.json({
      users: store.users.map(sanitizeUser),
      authLogs: [],
      searchLogs: [],
      listeningLogs: [],
      config: store.config,
    });
  });

  app.post('/api/admin/mark-synced', (req: Request, res: Response) => {
    const actor = getAuthenticatedUser(req);
    if (!actor || actor.role !== 'admin') {
      res.status(403).json({ error: '관리자 권한이 필요합니다.' });
      return;
    }
    const now = new Date().toISOString();
    for (const u of store.users) {
      u.syncedToSheets = true;
    }
    for (const l of store.authLogs) {
      l.syncedToSheets = true;
    }
    for (const s of store.searchLogs) {
      s.syncedToSheets = true;
    }
    for (const lst of store.listeningLogs) {
      lst.syncedToSheets = true;
    }
    store.config.lastSheetsSyncAt = now;
    saveStore();
    res.json({
      lastSheetsSyncAt: now,
      users: store.users.map(sanitizeUser),
      authLogs: store.authLogs,
      searchLogs: store.searchLogs,
      listeningLogs: store.listeningLogs,
    });
  });

  // Catalog, Playlists, YouTube Resolve & Search
  app.get('/api/catalog', (_req: Request, res: Response) => {
    res.json({
      tracks: store.tracks,
      playlists: store.playlists,
    });
  });

  app.get('/api/youtube/resolve', async (req: Request, res: Response) => {
    const urlParam = String(req.query.url || '').trim();
    const youtubeId = extractYoutubeId(urlParam);
    if (!youtubeId) {
      res.status(400).json({ error: '올바른 YouTube URL 또는 11자리 영상 ID를 입력해 주세요.' });
      return;
    }

    const existing = store.tracks.find((t) => t.youtubeId === youtubeId);
    if (existing) {
      res.json({ track: existing, alreadyExists: true });
      return;
    }

    try {
      const watchUrl = `https://www.youtube.com/watch?v=${youtubeId}`;
      const oembedRes = await fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`,
      );
      if (!oembedRes.ok) {
        throw new Error('YouTube oEmbed lookup failed');
      }
      const meta = (await oembedRes.json()) as {
        title?: string;
        author_name?: string;
        thumbnail_url?: string;
      };
      res.json({
        resolved: {
          youtubeId,
          title: meta.title || `YouTube Track (${youtubeId})`,
          artist: meta.author_name || 'YouTube Artist',
          coverUrl: `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`,
        },
      });
    } catch {
      res.json({
        resolved: {
          youtubeId,
          title: `YouTube Track (${youtubeId})`,
          artist: 'YouTube Music',
          coverUrl: `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`,
        },
      });
    }
  });

  app.get('/api/youtube/search', async (req: Request, res: Response) => {
    const q = String(req.query.q || '').trim();
    if (!q) {
      res.json({ catalogMatches: store.tracks, youtubeResults: [], apiConfigured: true });
      return;
    }

    const qLower = q.toLowerCase();
    const catalogMatches = store.tracks.filter(
      (t) =>
        t.title.toLowerCase().includes(qLower) ||
        t.artist.toLowerCase().includes(qLower) ||
        t.album.toLowerCase().includes(qLower) ||
        t.genre.toLowerCase().includes(qLower),
    );

    try {
      const youtubeResults = await searchYouTubeLive(q);
      res.json({ catalogMatches, youtubeResults, apiConfigured: true });
    } catch {
      res.json({ catalogMatches, youtubeResults: [], apiConfigured: true });
    }
  });

  app.post('/api/tracks', (req: Request, res: Response) => {
    const actor = getAuthenticatedUser(req);
    if (!actor) {
      res.status(401).json({ error: '트랙을 추가하려면 먼저 로그인해 주세요.' });
      return;
    }
    const { youtubeUrlOrId, title, artist, album, genre, duration } = req.body as {
      youtubeUrlOrId?: string;
      title?: string;
      artist?: string;
      album?: string;
      genre?: string;
      duration?: string;
    };

    const youtubeId = extractYoutubeId(youtubeUrlOrId || '');
    if (!youtubeId) {
      res.status(400).json({ error: '유효한 YouTube URL 또는 영상 ID가 필요합니다.' });
      return;
    }

    const existing = store.tracks.find((t) => t.youtubeId === youtubeId);
    if (existing) {
      res.json({ track: existing, tracks: store.tracks });
      return;
    }

    const newTrack: Track = {
      id: `trk_${Date.now()}`,
      youtubeId,
      title: (title || `YouTube Track (${youtubeId})`).trim(),
      artist: (artist || 'YouTube Artist').trim(),
      album: (album || 'YouTube Single').trim(),
      genre: (genre || 'Pop').trim(),
      duration: (duration || '3:30').trim(),
      durationSec: 210,
      coverUrl: `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`,
      addedBy: actor.email,
      createdAt: new Date().toISOString(),
      plays: 1,
    };

    store.tracks.unshift(newTrack);
    saveStore();
    broadcastSSE('catalog_updated', { tracks: store.tracks });
    res.status(201).json({ track: newTrack, tracks: store.tracks });
  });

  app.delete('/api/tracks/:id', (req: Request, res: Response) => {
    const actor = getAuthenticatedUser(req);
    if (!actor || (actor.role !== 'admin' && actor.role !== 'editor')) {
      res.status(403).json({ error: '관리자 또는 에디터만 곡을 삭제할 수 있습니다.' });
      return;
    }
    const { id } = req.params;
    store.tracks = store.tracks.filter((t) => t.id !== id);
    saveStore();
    broadcastSSE('catalog_updated', { tracks: store.tracks });
    res.json({ tracks: store.tracks });
  });

  app.post('/api/tracks/:id/play', (req: Request, res: Response) => {
    const track = store.tracks.find((t) => t.id === req.params.id);
    if (track) {
      track.plays += 1;
      saveStore();
    }
    res.json({ ok: true });
  });

  // Library Favorites
  app.get('/api/library', (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      res.json({ favoriteIds: [] });
      return;
    }
    res.json({ favoriteIds: store.favoritesByUser[user.id] || [] });
  });

  app.post('/api/library/toggle', (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: '보관함에 저장하려면 로그인해 주세요.' });
      return;
    }
    const { trackId } = req.body as { trackId?: string };
    if (!trackId) {
      res.status(400).json({ error: 'trackId가 필요합니다.' });
      return;
    }
    const current = store.favoritesByUser[user.id] || [];
    const exists = current.includes(trackId);
    const next = exists ? current.filter((id) => id !== trackId) : [trackId, ...current];
    store.favoritesByUser[user.id] = next;
    saveStore();
    res.json({ favoriteIds: next, favorited: !exists });
  });

  // Explicit JSON 404 for unmatched /api/* routes so they never fall through to SPA HTML
  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: '요청한 API 엔드포인트를 찾을 수 없습니다.' });
  });

  // Vite Dev Middleware or Static Production Build
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Server error:', err);
    res.status(500).json({ error: '서버 내부 오류가 발생했습니다.' });
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
