export type UserRole = 'admin' | 'editor' | 'user' | 'suspended';

export type AuthProviderType = 'email' | 'google';

export interface AppUser {
  id: string;
  email: string;
  name: string;
  provider: AuthProviderType;
  role: UserRole;
  photoURL?: string;
  createdAt: string;
  lastLoginAt: string;
  loginCount: number;
  syncedToSheets: boolean;
  currentTrackTitle?: string;
  currentTrackArtist?: string;
  isPlaying?: boolean;
  lastSearchQuery?: string;
  lastActiveAt?: string;
}

export interface AuthEventLog {
  id: string;
  timestamp: string;
  event: 'SIGNUP' | 'SOCIAL_SIGNUP' | 'LOGIN' | 'SOCIAL_LOGIN' | 'ROLE_CHANGE' | 'USER_DELETED';
  email: string;
  name: string;
  provider: AuthProviderType;
  role: UserRole;
  details: string;
  syncedToSheets: boolean;
}

export interface SearchLogEntry {
  id: string;
  timestamp: string;
  sessionId: string;
  userId: string;
  userName: string;
  userEmail: string;
  query: string;
  resultCount: number;
  syncedToSheets: boolean;
}

export type ListeningAction = 'PLAY' | 'PAUSE' | 'RESUME' | 'ENDED' | 'SWITCH';

export interface ListeningLogEntry {
  id: string;
  timestamp: string;
  sessionId: string;
  userId: string;
  userName: string;
  userEmail: string;
  youtubeId: string;
  trackTitle: string;
  artist: string;
  duration: string;
  action: ListeningAction;
  positionSec: number;
  syncedToSheets: boolean;
}

export interface LiveUserSession {
  sessionId: string;
  userId: string;
  userName: string;
  userEmail: string;
  userRole: UserRole | 'guest';
  activeTab: NavTab;
  lastSearchQuery: string;
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  showVideo: boolean;
  queuePreview: Track[];
  connectedAt: string;
  lastSeenAt: string;
}

export interface Track {
  id: string;
  youtubeId: string;
  title: string;
  artist: string;
  album: string;
  genre: string;
  duration: string;
  durationSec: number;
  coverUrl: string;
  addedBy?: string;
  createdAt: string;
  plays: number;
}

export interface EditorialPlaylist {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  coverUrl: string;
  trackIds: string[];
  accentHue: string;
}

export type ThemeMode = 'dark' | 'light';
export type LayoutDensity = 'editorial' | 'compact';
export type CardRadius = 'rounded' | 'soft' | 'sharp';

export interface AppUIConfig {
  appName: string;
  heroTitle: string;
  heroSubtitle: string;
  heroKicker: string;
  announcement: string;
  themeMode: ThemeMode;
  accentColor: string;
  layoutDensity: LayoutDensity;
  cardRadius: CardRadius;
  navLabels: {
    listenNow: string;
    browse: string;
    charts: string;
    library: string;
  };
  visibleSections: {
    heroBanner: boolean;
    editorialPlaylists: boolean;
    quickPicks: boolean;
    charts: boolean;
  };
  spreadsheetId: string;
  spreadsheetTitle: string;
  lastSheetsSyncAt: string | null;
  autoSyncSheets?: boolean;
  updatedAt: string;
  updatedBy: string;
}

export type NavTab = 'listen-now' | 'browse' | 'charts' | 'library' | 'admin';
