import { useCallback, useEffect, useRef, useState } from 'react';
import { Menu, Play, Search, ShieldCheck, X } from 'lucide-react';
import { AdminConsole } from './components/AdminConsole';
import { ArtworkImage } from './components/ArtworkImage';
import { AuthModal } from './components/AuthModal';
import {
  BrowseView,
  ChartsView,
  LibraryView,
  ListenNowView,
} from './components/MusicViews';
import { PlayerDock, type RepeatMode } from './components/PlayerDock';
import { Sidebar } from './components/Sidebar';
import { YouTubeEngine } from './components/YouTubeEngine';
import { apiFetch, setStoredSessionToken } from './lib/apiClient';
import { initFirebaseAuth, signOutFirebaseGoogle } from './lib/firebaseAuth';
import { syncAllToSheets } from './services/sheetsService';
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
} from './types';

function getOrCreateClientSessionId(): string {
  try {
    const key = 'sonata_client_session_id';
    const existing = window.sessionStorage.getItem(key);
    if (existing) return existing;
    const generated = `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    window.sessionStorage.setItem(key, generated);
    return generated;
  } catch {
    return `sess_${Date.now().toString(36)}`;
  }
}

const FALLBACK_CONFIG: AppUIConfig = {
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
  updatedAt: new Date().toISOString(),
  updatedBy: 'System',
};

export default function App() {
  const [serverConfig, setServerConfig] = useState<AppUIConfig>(FALLBACK_CONFIG);
  const [previewConfig, setPreviewConfig] = useState<AppUIConfig | null>(null);
  const activeConfig = previewConfig ?? serverConfig;

  const [activeTab, setActiveTab] = useState<NavTab>('listen-now');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [liveResults, setLiveResults] = useState<Track[]>([]);
  const [searchingYt, setSearchingYt] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchSeqRef = useRef(0);
  const clientSessionIdRef = useRef<string>(getOrCreateClientSessionId());
  const lastLoggedSearchRef = useRef<string>('');

  // Auth & Google Sheets token (in-memory only)
  const [user, setUser] = useState<AppUser | null>(null);
  const [sheetsToken, setSheetsToken] = useState<string | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup'>('login');

  // Music catalog & library
  const [tracks, setTracks] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<EditorialPlaylist[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Player state
  const [queue, setQueue] = useState<Track[]>([]);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [seekTarget, setSeekTarget] = useState<{ seconds: number; nonce: number } | null>(null);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [showVideo, setShowVideo] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  // Sync HTML theme class & document title with activeConfig
  useEffect(() => {
    document.title = activeConfig.appName;
    const root = document.documentElement;
    if (activeConfig.themeMode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    root.style.setProperty('--app-accent', activeConfig.accentColor);
  }, [activeConfig.appName, activeConfig.themeMode, activeConfig.accentColor]);

  // Initialize Firebase Auth state listener
  useEffect(() => {
    const unsub = initFirebaseAuth((_fbUser, token) => {
      setSheetsToken(token);
    });
    return () => unsub();
  }, []);

  // Load initial config, catalog, user session, and library
  useEffect(() => {
    let active = true;
    async function bootstrap() {
      try {
        const [cfgData, catData, meData, libData] = await Promise.all([
          apiFetch<{ config?: AppUIConfig }>('/api/config').catch(() => null),
          apiFetch<{ tracks?: Track[]; playlists?: EditorialPlaylist[] }>(
            '/api/catalog',
          ).catch(() => null),
          apiFetch<{ user?: AppUser | null }>('/api/auth/me').catch(() => null),
          apiFetch<{ favoriteIds?: string[] }>('/api/library').catch(() => null),
        ]);
        if (!active) return;

        if (cfgData?.config) setServerConfig(cfgData.config);
        if (catData?.tracks) {
          const loadedTracks = catData.tracks;
          setTracks(loadedTracks);
          setPlaylists(catData.playlists || []);
          setQueue(loadedTracks);
          if (loadedTracks[0]) {
            setCurrentTrack(loadedTracks[0]);
          }
        }
        if (meData) {
          setUser(meData.user || null);
        }
        if (libData) {
          setFavoriteIds(libData.favoriteIds || []);
        }
      } catch (err) {
        console.error('Bootstrap error:', err);
      } finally {
        if (active) setLoadingInitial(false);
      }
    }
    bootstrap();
    return () => {
      active = false;
    };
  }, []);

  // Real-time Server-Sent Events subscription so Admin UI/App Name changes push to ALL users
  useEffect(() => {
    const evtSource = new EventSource('/api/events');
    evtSource.addEventListener('config_updated', (event) => {
      try {
        const updated = JSON.parse((event as MessageEvent).data) as AppUIConfig;
        setServerConfig(updated);
      } catch {
        // ignore parse errors
      }
    });
    evtSource.addEventListener('catalog_updated', (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data) as { tracks: Track[] };
        if (data.tracks) setTracks(data.tracks);
      } catch {
        // ignore parse errors
      }
    });
    return () => {
      evtSource.close();
    };
  }, []);

  const reportSearchActivity = useCallback(async (query: string, resultCount: number) => {
    const clean = query.trim();
    if (!clean) return;
    if (lastLoggedSearchRef.current.toLowerCase() === clean.toLowerCase()) return;
    lastLoggedSearchRef.current = clean;
    try {
      await fetch('/api/activity/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(window.localStorage.getItem('sonata_session_token')
            ? {
                Authorization: `Bearer ${window.localStorage.getItem('sonata_session_token')}`,
              }
            : {}),
        },
        body: JSON.stringify({
          sessionId: clientSessionIdRef.current,
          query: clean,
          resultCount,
        }),
      });
    } catch {
      // non-blocking telemetry
    }
  }, []);

  const reportListenActivity = useCallback(
    (track: Track | null, action: ListeningAction, posSec: number) => {
      if (!track) return;
      apiFetch('/api/activity/listen', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: clientSessionIdRef.current,
          youtubeId: track.youtubeId,
          trackTitle: track.title,
          artist: track.artist,
          duration: track.duration,
          action,
          positionSec: posSec,
        }),
      }).catch(() => {});
    },
    [],
  );

  const runYouTubeSearch = useCallback(
    async (rawQuery?: string, logImmediately = false) => {
      const q = (rawQuery ?? searchQuery).trim();
      if (!q) {
        setLiveResults([]);
        setSearchError(null);
        setSearchingYt(false);
        return;
      }

      const reqId = ++searchSeqRef.current;
      setSearchingYt(true);
      setSearchError(null);

      try {
        // If user pasted a YouTube URL directly in search box, resolve it too
        if (q.includes('youtube.com/') || q.includes('youtu.be/')) {
          const res = await apiFetch<{
            alreadyExists?: boolean;
            track?: Track;
            resolved?: { youtubeId: string; title: string; artist: string; coverUrl?: string };
          }>(`/api/youtube/resolve?url=${encodeURIComponent(q)}`);
          if (reqId !== searchSeqRef.current) return;
          const resolvedTrack =
            res.track ||
            (res.resolved
              ? {
                  id: `yt_${res.resolved.youtubeId}`,
                  youtubeId: res.resolved.youtubeId,
                  title: res.resolved.title,
                  artist: res.resolved.artist,
                  album: 'YouTube',
                  genre: 'YouTube',
                  duration: '3:30',
                  durationSec: 210,
                  coverUrl:
                    res.resolved.coverUrl ||
                    `https://i.ytimg.com/vi/${res.resolved.youtubeId}/hqdefault.jpg`,
                  createdAt: new Date().toISOString(),
                  plays: 0,
                }
              : null);
          if (resolvedTrack) {
            setLiveResults([resolvedTrack]);
            setSearchingYt(false);
            if (logImmediately) {
              reportSearchActivity(q, 1);
            }
            return;
          }
        }

        const data = await apiFetch<{ youtubeResults?: Track[] }>(
          `/api/youtube/search?q=${encodeURIComponent(q)}`,
        );
        if (reqId !== searchSeqRef.current) return;
        const results = data.youtubeResults || [];
        setLiveResults(results);
        if (logImmediately) {
          reportSearchActivity(q, results.length);
        }
      } catch (err) {
        if (reqId !== searchSeqRef.current) return;
        setSearchError(
          err instanceof Error ? err.message : 'YouTube 검색 중 오류가 발생했습니다.',
        );
      } finally {
        if (reqId === searchSeqRef.current) {
          setSearchingYt(false);
        }
      }
    },
    [searchQuery, reportSearchActivity],
  );

  // Automatic debounced search whenever searchQuery changes
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      searchSeqRef.current += 1;
      setLiveResults([]);
      setSearchError(null);
      setSearchingYt(false);
      return;
    }
    const timer = window.setTimeout(() => {
      runYouTubeSearch(q, false);
    }, 280);
    return () => window.clearTimeout(timer);
  }, [searchQuery, runYouTubeSearch]);

  // Log settled search query after user finishes typing (950ms)
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q || searchingYt) return;
    const timer = window.setTimeout(() => {
      reportSearchActivity(q, liveResults.length);
    }, 950);
    return () => window.clearTimeout(timer);
  }, [searchQuery, searchingYt, liveResults.length, reportSearchActivity]);

  const handlePlayTrack = useCallback(
    (track: Track, newQueue?: Track[]) => {
      setPlaybackError(null);
      if (newQueue && newQueue.length > 0) {
        setQueue(newQueue);
      }
      setCurrentTrack((prev) => {
        if (prev?.id === track.id) {
          setIsPlaying((p) => {
            const nextPlaying = !p;
            reportListenActivity(track, nextPlaying ? 'RESUME' : 'PAUSE', currentTime);
            return nextPlaying;
          });
          return prev;
        }
        setCurrentTime(0);
        setDuration(track.durationSec || 0);
        setIsPlaying(true);
        fetch(`/api/tracks/${track.id}/play`, { method: 'POST' }).catch(() => {});
        reportListenActivity(track, prev ? 'SWITCH' : 'PLAY', 0);
        return track;
      });
    },
    [currentTime, reportListenActivity],
  );

  const handlePlayPlaylist = useCallback(
    (playlist: EditorialPlaylist) => {
      const plTracks = playlist.trackIds
        .map((id) => tracks.find((t) => t.id === id))
        .filter((t): t is Track => Boolean(t));
      if (plTracks.length > 0) {
        handlePlayTrack(plTracks[0], plTracks);
      }
    },
    [tracks, handlePlayTrack],
  );

  const handleNext = useCallback(() => {
    if (queue.length === 0 || !currentTrack) return;
    if (repeatMode === 'one') {
      setSeekTarget({ seconds: 0, nonce: Date.now() });
      setIsPlaying(true);
      return;
    }
    const idx = queue.findIndex((t) => t.id === currentTrack.id);
    let nextIdx = idx + 1;
    if (isShuffle && queue.length > 1) {
      let rand = Math.floor(Math.random() * queue.length);
      if (rand === idx) rand = (idx + 1) % queue.length;
      nextIdx = rand;
    } else if (nextIdx >= queue.length) {
      if (repeatMode === 'all') {
        nextIdx = 0;
      } else {
        setIsPlaying(false);
        return;
      }
    }
    const nextTrack = queue[nextIdx];
    if (nextTrack) {
      setPlaybackError(null);
      setCurrentTrack(nextTrack);
      setCurrentTime(0);
      setDuration(nextTrack.durationSec || 0);
      setIsPlaying(true);
      fetch(`/api/tracks/${nextTrack.id}/play`, { method: 'POST' }).catch(() => {});
      reportListenActivity(nextTrack, 'PLAY', 0);
    }
  }, [queue, currentTrack, repeatMode, isShuffle, reportListenActivity]);

  const handlePrev = useCallback(() => {
    if (queue.length === 0 || !currentTrack) return;
    if (currentTime > 3) {
      setSeekTarget({ seconds: 0, nonce: Date.now() });
      return;
    }
    const idx = queue.findIndex((t) => t.id === currentTrack.id);
    const prevIdx = idx <= 0 ? queue.length - 1 : idx - 1;
    const prevTrack = queue[prevIdx];
    if (prevTrack) {
      setPlaybackError(null);
      setCurrentTrack(prevTrack);
      setCurrentTime(0);
      setDuration(prevTrack.durationSec || 0);
      setIsPlaying(true);
      reportListenActivity(prevTrack, 'PLAY', 0);
    }
  }, [queue, currentTrack, currentTime, reportListenActivity]);

  // Real-time User Screen & Playback Presence Heartbeat
  const presencePayloadRef = useRef({
    activeTab,
    searchQuery,
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    showVideo,
    queue,
  });
  presencePayloadRef.current = {
    activeTab,
    searchQuery,
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    showVideo,
    queue,
  };

  const sendPresenceHeartbeat = useCallback(() => {
    const p = presencePayloadRef.current;
    apiFetch('/api/presence/heartbeat', {
      method: 'POST',
      body: JSON.stringify({
        sessionId: clientSessionIdRef.current,
        activeTab: p.activeTab,
        lastSearchQuery: p.searchQuery.trim(),
        currentTrack: p.currentTrack,
        isPlaying: p.isPlaying,
        currentTime: p.currentTime,
        duration: p.duration,
        volume: p.volume,
        isMuted: p.isMuted,
        showVideo: p.showVideo,
        queuePreview: p.queue.slice(0, 6),
      }),
    }).catch(() => {});
  }, []);

  useEffect(() => {
    sendPresenceHeartbeat();
  }, [
    activeTab,
    currentTrack?.id,
    isPlaying,
    searchQuery,
    isMuted,
    showVideo,
    user?.id,
    sendPresenceHeartbeat,
  ]);

  useEffect(() => {
    const intervalId = window.setInterval(sendPresenceHeartbeat, 5000);
    const onUnload = () => {
      try {
        const blob = new Blob(
          [JSON.stringify({ sessionId: clientSessionIdRef.current })],
          { type: 'application/json' },
        );
        navigator.sendBeacon('/api/presence/leave', blob);
      } catch {
        // ignore unload errors
      }
    };
    window.addEventListener('beforeunload', onUnload);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, [sendPresenceHeartbeat]);

  // Background auto-sync to Google Sheets when admin has enabled Auto-Sync & Google auth is active
  useEffect(() => {
    if (
      !user ||
      user.role !== 'admin' ||
      !sheetsToken ||
      !serverConfig.spreadsheetId ||
      !serverConfig.autoSyncSheets
    ) {
      return;
    }

    const syncNow = async () => {
      try {
        const monitor = await apiFetch<{
          users: AppUser[];
          authLogs: AuthEventLog[];
          searchLogs: SearchLogEntry[];
          listeningLogs: ListeningLogEntry[];
          liveSessions: LiveUserSession[];
          unsyncedCount: number;
        }>('/api/admin/monitor');
        if (monitor.unsyncedCount === 0 && monitor.liveSessions.length === 0) {
          return;
        }
        await syncAllToSheets(
          sheetsToken,
          serverConfig.spreadsheetId,
          monitor.users,
          monitor.authLogs,
          monitor.searchLogs,
          monitor.listeningLogs,
          monitor.liveSessions,
        );
        await apiFetch('/api/admin/mark-synced', { method: 'POST' });
      } catch {
        // non-blocking background auto-sync
      }
    };

    const timer = window.setInterval(syncNow, 15000);
    return () => window.clearInterval(timer);
  }, [user, sheetsToken, serverConfig.spreadsheetId, serverConfig.autoSyncSheets]);

  const handleToggleFavorite = async (trackId: string, trackObj?: Track) => {
    if (!user) {
      setAuthModalMode('login');
      setAuthModalOpen(true);
      return;
    }
    try {
      let actualTrackId = trackId;
      // If favoriting a live YouTube search result, persist it to catalog first
      const candidate =
        trackObj ||
        liveResults.find((t) => t.id === trackId) ||
        (currentTrack?.id === trackId ? currentTrack : undefined);
      if (candidate && !tracks.some((t) => t.id === candidate.id)) {
        const added = await apiFetch<{ track: Track; tracks: Track[] }>(
          '/api/tracks',
          {
            method: 'POST',
            body: JSON.stringify({
              youtubeUrlOrId: candidate.youtubeId,
              title: candidate.title,
              artist: candidate.artist,
              album: candidate.album,
              genre: candidate.genre,
              duration: candidate.duration,
            }),
          },
        );
        setTracks(added.tracks);
        actualTrackId = added.track.id;
      }

      const data = await apiFetch<{ favoriteIds?: string[] }>(
        '/api/library/toggle',
        {
          method: 'POST',
          body: JSON.stringify({ trackId: actualTrackId }),
        },
      );
      if (Array.isArray(data.favoriteIds)) {
        setFavoriteIds(data.favoriteIds);
      }
    } catch {
      // ignore network error
    }
  };

  const handleAddToQueue = (track: Track) => {
    setQueue((prev) => {
      if (prev.some((t) => t.id === track.id)) return prev;
      return [...prev, track];
    });
  };

  const handleDeleteTrack = async (trackId: string) => {
    try {
      const data = await apiFetch<{ tracks?: Track[] }>(
        `/api/tracks/${trackId}`,
        { method: 'DELETE' },
      );
      if (data.tracks) {
        setTracks(data.tracks);
        setQueue((prev) => prev.filter((t) => t.id !== trackId));
      }
    } catch {
      // ignore delete error
    }
  };

  const handleAuthSuccess = async (
    loggedUser: AppUser,
    options?: {
      accessToken?: string;
      allUsers?: AppUser[];
      allLogs?: AuthEventLog[];
      isSocial?: boolean;
    },
  ) => {
    setUser(loggedUser);
    if (options?.accessToken) {
      setSheetsToken(options.accessToken);
    }

    // Refresh user's favorites
    apiFetch<{ favoriteIds?: string[] }>('/api/library')
      .then((d) => setFavoriteIds(d.favoriteIds || []))
      .catch(() => {});

    // Auto-sync to connected Google Sheet if token and spreadsheetId exist
    const effectiveToken = options?.accessToken || sheetsToken;
    if (
      effectiveToken &&
      serverConfig.spreadsheetId &&
      options?.allUsers &&
      options?.allLogs
    ) {
      try {
        await syncAllToSheets(
          effectiveToken,
          serverConfig.spreadsheetId,
          options.allUsers,
          options.allLogs,
        );
        if (loggedUser.role === 'admin') {
          await apiFetch('/api/admin/mark-synced', { method: 'POST' });
        }
      } catch {
        // non-blocking background sync
      }
    }
  };

  const handleLogout = async () => {
    await apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    await signOutFirebaseGoogle().catch(() => {});
    setStoredSessionToken(null);
    setUser(null);
    setSheetsToken(null);
    setFavoriteIds([]);
    if (activeTab === 'admin') {
      setActiveTab('listen-now');
    }
  };

  const canManageTracks = user?.role === 'admin' || user?.role === 'editor';

  const currentTabTitle =
    activeTab === 'listen-now'
      ? activeConfig.navLabels.listenNow
      : activeTab === 'browse'
        ? activeConfig.navLabels.browse
        : activeTab === 'charts'
          ? activeConfig.navLabels.charts
          : activeTab === 'library'
            ? activeConfig.navLabels.library
            : '개발자 콘솔';

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-[#0D0D0F] text-neutral-900 dark:text-[#F5F5F7] flex">
      {/* Apple Music Sidebar */}
      <Sidebar
        config={activeConfig}
        activeTab={activeTab}
        user={user}
        searchQuery={searchQuery}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        onSelectTab={setActiveTab}
        onSearchChange={setSearchQuery}
        onOpenAuth={(m) => {
          setAuthModalMode(m);
          setAuthModalOpen(true);
        }}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col pb-24">
        {/* Global Announcement Bar (Admin configurable) */}
        {activeConfig.announcement ? (
          <div
            className="px-4 py-2 text-center text-xs font-medium text-white"
            style={{ backgroundColor: activeConfig.accentColor }}
          >
            {activeConfig.announcement}
          </div>
        ) : null}

        {/* Top Bar (3-zone contract: Breadcrumb/Title — Quiet Context — 1 Primary Action) */}
        <header className="sticky top-0 z-10 h-16 px-4 sm:px-8 border-b border-neutral-200/80 dark:border-neutral-800/80 bg-neutral-50/85 dark:bg-[#0D0D0F]/85 backdrop-blur-xl flex items-center justify-between gap-8">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="메뉴 열기"
              className="lg:hidden p-2 -ml-2 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/60 dark:hover:bg-neutral-800"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="font-display text-sm sm:text-base font-bold text-neutral-900 dark:text-white whitespace-nowrap shrink-0">
              {currentTabTitle}
            </span>
          </div>

          <div className="flex-1 max-w-md flex items-center gap-6">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (searchQuery.trim()) {
                  setActiveTab('browse');
                  runYouTubeSearch(searchQuery, true);
                }
              }}
              className="relative flex-1"
            >
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => {
                  const val = e.target.value;
                  setSearchQuery(val);
                  if (val.trim() && activeTab !== 'browse') {
                    setActiveTab('browse');
                  }
                }}
                placeholder="모든 YouTube 노래 검색..."
                aria-label="모든 YouTube 노래 검색"
                className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm rounded-xl bg-white dark:bg-[#18181B] border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-400/50"
              />
            </form>

            <nav className="hidden xl:flex items-center gap-5 text-xs font-medium text-neutral-500 dark:text-neutral-400">
              <button
                type="button"
                onClick={() => setActiveTab('listen-now')}
                className="hover:text-neutral-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
              >
                {activeConfig.navLabels.listenNow}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('browse')}
                className="hover:text-neutral-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
              >
                {activeConfig.navLabels.browse}
              </button>
              {activeConfig.visibleSections.charts ? (
                <button
                  type="button"
                  onClick={() => setActiveTab('charts')}
                  className="hover:text-neutral-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
                >
                  {activeConfig.navLabels.charts}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setActiveTab('library')}
                className="hover:text-neutral-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
              >
                {activeConfig.navLabels.library}
              </button>
            </nav>
          </div>

          <div className="flex items-center shrink-0">
            {user ? (
              canManageTracks && activeTab !== 'admin' ? (
                <button
                  type="button"
                  onClick={() => setActiveTab('admin')}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-white inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  style={{ backgroundColor: activeConfig.accentColor }}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>개발자 탭</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 whitespace-nowrap shrink-0"
                >
                  로그아웃
                </button>
              )
            ) : (
              <button
                type="button"
                onClick={() => {
                  setAuthModalMode('login');
                  setAuthModalOpen(true);
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white whitespace-nowrap shrink-0"
                style={{ backgroundColor: activeConfig.accentColor }}
              >
                로그인 / 가입
              </button>
            )}
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 w-full max-w-[1320px] mx-auto px-4 sm:px-8 py-8">
          {loadingInitial ? (
            <div className="space-y-6 animate-pulse">
              <div className="h-64 rounded-2xl bg-neutral-200 dark:bg-neutral-800/70" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="h-64 rounded-2xl bg-neutral-200 dark:bg-neutral-800/70" />
                <div className="h-64 rounded-2xl bg-neutral-200 dark:bg-neutral-800/70" />
                <div className="h-64 rounded-2xl bg-neutral-200 dark:bg-neutral-800/70" />
              </div>
            </div>
          ) : activeTab === 'listen-now' ? (
            <ListenNowView
              config={activeConfig}
              tracks={tracks}
              playlists={playlists}
              currentTrackId={currentTrack?.id || null}
              isPlaying={isPlaying}
              favoriteIds={favoriteIds}
              canManageTracks={canManageTracks}
              onPlayTrack={handlePlayTrack}
              onPlayPlaylist={handlePlayPlaylist}
              onToggleFavorite={handleToggleFavorite}
              onAddToQueue={handleAddToQueue}
              onDeleteTrack={handleDeleteTrack}
              onNavigateBrowse={() => setActiveTab('browse')}
            />
          ) : activeTab === 'browse' ? (
            <BrowseView
              config={activeConfig}
              tracks={tracks}
              searchQuery={searchQuery}
              liveResults={liveResults}
              searchingYt={searchingYt}
              searchError={searchError}
              user={user}
              currentTrackId={currentTrack?.id || null}
              isPlaying={isPlaying}
              favoriteIds={favoriteIds}
              canManageTracks={canManageTracks}
              onSearchChange={setSearchQuery}
              onTriggerSearch={(q) => runYouTubeSearch(q, true)}
              onPlayTrack={handlePlayTrack}
              onToggleFavorite={handleToggleFavorite}
              onAddToQueue={handleAddToQueue}
              onTrackAdded={(updatedTracks) => setTracks(updatedTracks)}
              onDeleteTrack={handleDeleteTrack}
              onOpenAuth={() => {
                setAuthModalMode('login');
                setAuthModalOpen(true);
              }}
            />
          ) : activeTab === 'charts' ? (
            <ChartsView
              config={activeConfig}
              tracks={tracks}
              currentTrackId={currentTrack?.id || null}
              isPlaying={isPlaying}
              favoriteIds={favoriteIds}
              canManageTracks={canManageTracks}
              onPlayTrack={handlePlayTrack}
              onToggleFavorite={handleToggleFavorite}
              onAddToQueue={handleAddToQueue}
              onDeleteTrack={handleDeleteTrack}
            />
          ) : activeTab === 'library' ? (
            <LibraryView
              config={activeConfig}
              user={user}
              tracks={tracks}
              favoriteIds={favoriteIds}
              currentTrackId={currentTrack?.id || null}
              isPlaying={isPlaying}
              onPlayTrack={handlePlayTrack}
              onToggleFavorite={handleToggleFavorite}
              onAddToQueue={handleAddToQueue}
              onOpenAuth={() => {
                setAuthModalMode('login');
                setAuthModalOpen(true);
              }}
            />
          ) : activeTab === 'admin' && user && canManageTracks ? (
            <AdminConsole
              config={serverConfig}
              currentUser={user}
              sheetsToken={sheetsToken}
              onSheetsTokenUpdate={(token) => setSheetsToken(token)}
              onConfigPublished={(nextConfig) => setServerConfig(nextConfig)}
              onPreviewConfigChange={setPreviewConfig}
              onListenAlong={(track, posSec) => {
                setPlaybackError(null);
                setCurrentTrack(track);
                setCurrentTime(posSec);
                setDuration(track.durationSec || 0);
                setSeekTarget({ seconds: posSec, nonce: Date.now() });
                setIsPlaying(true);
              }}
            />
          ) : null}
        </main>
      </div>

      {/* Queue Drawer */}
      {showQueue ? (
        <aside className="fixed bottom-20 right-4 sm:right-6 z-40 w-80 max-h-[420px] rounded-2xl bg-white dark:bg-[#18181B] border border-neutral-200 dark:border-neutral-800 shadow-2xl flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
            <h3 className="text-xs font-bold text-neutral-900 dark:text-white">
              다음 재생 목록 ({queue.length})
            </h3>
            <button
              type="button"
              onClick={() => setShowQueue(false)}
              aria-label="대기열 닫기"
              className="p-1 rounded text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-neutral-200/60 dark:divide-neutral-800/60">
            {queue.map((item) => {
              const active = item.id === currentTrack?.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handlePlayTrack(item, queue)}
                  className={`w-full px-4 py-2.5 flex items-center gap-3 text-left hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors ${
                    active ? 'bg-neutral-100 dark:bg-white/[0.06]' : ''
                  }`}
                >
                  <ArtworkImage
                    src={item.coverUrl}
                    alt={item.title}
                    className="w-9 h-9 rounded-md shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className="text-xs font-semibold truncate text-neutral-900 dark:text-white"
                      style={active ? { color: activeConfig.accentColor } : undefined}
                    >
                      {item.title}
                    </p>
                    <p className="text-[11px] text-neutral-500 truncate">
                      {item.artist}
                    </p>
                  </div>
                  {active ? (
                    <Play
                      className="w-3.5 h-3.5 fill-current shrink-0"
                      style={{ color: activeConfig.accentColor }}
                    />
                  ) : null}
                </button>
              );
            })}
          </div>
        </aside>
      ) : null}

      {/* YouTube IFrame Player Engine */}
      <YouTubeEngine
        youtubeId={currentTrack?.youtubeId || null}
        isPlaying={isPlaying}
        volume={volume}
        isMuted={isMuted}
        seekRequest={seekTarget}
        showVideo={showVideo}
        trackTitle={currentTrack?.title}
        trackArtist={currentTrack?.artist}
        onCloseVideo={() => setShowVideo(false)}
        onProgress={(cur, dur) => {
          setCurrentTime(cur);
          if (dur > 0) setDuration(dur);
        }}
        onStateChange={(playing) => {
          setIsPlaying(playing);
          if (playing) setPlaybackError(null);
        }}
        onEnded={() => {
          reportListenActivity(currentTrack, 'ENDED', currentTime);
          handleNext();
        }}
        onError={async (code) => {
          if ((code === 101 || code === 150 || code === 100) && currentTrack) {
            setPlaybackError('재생 가능한 다른 공식 오디오/가사 버전을 찾는 중...');
            try {
              const altQuery = `${currentTrack.title} ${currentTrack.artist} audio`;
              const res = await apiFetch<{ youtubeResults?: Track[] }>(
                `/api/youtube/search?q=${encodeURIComponent(altQuery)}`,
              );
              const alt = (res.youtubeResults || []).find(
                (t) => t.youtubeId !== currentTrack.youtubeId,
              );
              if (alt) {
                setPlaybackError(null);
                setCurrentTrack(alt);
                setIsPlaying(true);
                return;
              }
            } catch {
              // ignore fallback lookup errors
            }
            setPlaybackError('이 영상은 외부 재생이 제한되어 다음 곡으로 이동합니다.');
            window.setTimeout(() => handleNext(), 1200);
          } else {
            setPlaybackError('재생 중 일시적인 오류가 발생했습니다.');
          }
        }}
      />

      {/* Persistent Apple Music Player Dock */}
      <PlayerDock
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        volume={volume}
        isMuted={isMuted}
        isShuffle={isShuffle}
        repeatMode={repeatMode}
        isFavorite={currentTrack ? favoriteIds.includes(currentTrack.id) : false}
        showVideo={showVideo}
        showQueue={showQueue}
        accentColor={activeConfig.accentColor}
        playbackError={playbackError}
        onTogglePlay={() => {
          if (!currentTrack) return;
          setIsPlaying((p) => {
            const nextPlaying = !p;
            reportListenActivity(
              currentTrack,
              nextPlaying ? 'RESUME' : 'PAUSE',
              currentTime,
            );
            return nextPlaying;
          });
        }}
        onPrev={handlePrev}
        onNext={handleNext}
        onSeek={(sec) => {
          setCurrentTime(sec);
          setSeekTarget({ seconds: sec, nonce: Date.now() });
        }}
        onVolumeChange={(val) => {
          setVolume(val);
          if (val > 0 && isMuted) setIsMuted(false);
        }}
        onToggleMute={() => setIsMuted((m) => !m)}
        onToggleShuffle={() => setIsShuffle((s) => !s)}
        onCycleRepeat={() =>
          setRepeatMode((m) => (m === 'off' ? 'all' : m === 'all' ? 'one' : 'off'))
        }
        onToggleFavorite={() => {
          if (currentTrack) handleToggleFavorite(currentTrack.id);
        }}
        onToggleVideo={() => setShowVideo((v) => !v)}
        onToggleQueue={() => setShowQueue((q) => !q)}
      />

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        appName={activeConfig.appName}
        accentColor={activeConfig.accentColor}
        initialMode={authModalMode}
        onClose={() => setAuthModalOpen(false)}
        onAuthSuccess={handleAuthSuccess}
      />
    </div>
  );
}
