import { useEffect, useState } from 'react';
import {
  Compass,
  Eye,
  Flame,
  Headphones,
  Library,
  Monitor,
  Pause,
  Play,
  PlayCircle,
  RefreshCw,
  Search,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import type {
  AppUIConfig,
  ListeningLogEntry,
  LiveUserSession,
  NavTab,
  SearchLogEntry,
  Track,
} from '../types';
import { ArtworkImage } from './ArtworkImage';

interface LiveMonitorPanelProps {
  config: AppUIConfig;
  liveSessions: LiveUserSession[];
  searchLogs: SearchLogEntry[];
  listeningLogs: ListeningLogEntry[];
  loading: boolean;
  onRefresh: () => void;
  onListenAlong: (track: Track, positionSec: number) => void;
}

function formatSec(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return '0:00';
  const total = Math.floor(sec);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function getTabLabel(tab: NavTab, config: AppUIConfig): string {
  switch (tab) {
    case 'listen-now':
      return config.navLabels.listenNow;
    case 'browse':
      return config.navLabels.browse;
    case 'charts':
      return config.navLabels.charts;
    case 'library':
      return config.navLabels.library;
    case 'admin':
      return '개발자 콘솔';
    default:
      return tab;
  }
}

export function LiveMonitorPanel({
  config,
  liveSessions,
  searchLogs,
  listeningLogs,
  loading,
  onRefresh,
  onListenAlong,
}: LiveMonitorPanelProps) {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [historyTab, setHistoryTab] = useState<'listening' | 'search'>('listening');
  const [historyFilter, setHistoryFilter] = useState('');
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Tick every second for smooth live playback progress interpolation
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const getInterpolatedTime = (sess: LiveUserSession): number => {
    if (!sess.isPlaying) return sess.currentTime;
    const elapsedSec = Math.max(
      0,
      (nowMs - new Date(sess.lastSeenAt).getTime()) / 1000,
    );
    const maxDur = sess.duration || sess.currentTrack?.durationSec || 0;
    const next = sess.currentTime + elapsedSec;
    return maxDur > 0 ? Math.min(maxDur, next) : next;
  };

  const selectedSession =
    liveSessions.find((s) => s.sessionId === selectedSessionId) || null;

  const playingCount = liveSessions.filter((s) => s.isPlaying).length;

  const filterLower = historyFilter.trim().toLowerCase();
  const filteredListening = listeningLogs.filter((l) => {
    if (!filterLower) return true;
    return (
      l.userName.toLowerCase().includes(filterLower) ||
      l.userEmail.toLowerCase().includes(filterLower) ||
      l.trackTitle.toLowerCase().includes(filterLower) ||
      l.artist.toLowerCase().includes(filterLower)
    );
  });

  const filteredSearch = searchLogs.filter((s) => {
    if (!filterLower) return true;
    return (
      s.userName.toLowerCase().includes(filterLower) ||
      s.userEmail.toLowerCase().includes(filterLower) ||
      s.query.toLowerCase().includes(filterLower)
    );
  });

  const selectedUserSearches = selectedSession
    ? searchLogs
        .filter(
          (s) =>
            s.sessionId === selectedSession.sessionId ||
            (selectedSession.userId !== 'guest' && s.userId === selectedSession.userId),
        )
        .slice(0, 15)
    : [];

  const selectedUserListens = selectedSession
    ? listeningLogs
        .filter(
          (l) =>
            l.sessionId === selectedSession.sessionId ||
            (selectedSession.userId !== 'guest' && l.userId === selectedSession.userId),
        )
        .slice(0, 15)
    : [];

  return (
    <div className="space-y-8">
      {/* Live Summary Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-[#161618] border border-neutral-200 dark:border-neutral-800">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">현재 접속 사용자</p>
          <p className="mt-1 font-display text-2xl font-bold tabular-nums text-neutral-900 dark:text-white">
            {liveSessions.length}
          </p>
        </div>
        <div className="p-4 rounded-xl bg-white dark:bg-[#161618] border border-neutral-200 dark:border-neutral-800">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">실시간 재생 중</p>
          <p
            className="mt-1 font-display text-2xl font-bold tabular-nums"
            style={{ color: config.accentColor }}
          >
            {playingCount}
          </p>
        </div>
        <div className="p-4 rounded-xl bg-white dark:bg-[#161618] border border-neutral-200 dark:border-neutral-800">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">누적 검색 기록</p>
          <p className="mt-1 font-display text-2xl font-bold tabular-nums text-neutral-900 dark:text-white">
            {searchLogs.length}
          </p>
        </div>
        <div className="p-4 rounded-xl bg-white dark:bg-[#161618] border border-neutral-200 dark:border-neutral-800">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">누적 감상 기록</p>
          <p className="mt-1 font-display text-2xl font-bold tabular-nums text-neutral-900 dark:text-white">
            {listeningLogs.length}
          </p>
        </div>
      </div>

      {/* Live Active Users List */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-bold text-neutral-900 dark:text-white">
              접속 중인 사용자 실시간 감시
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              각 사용자가 보고 있는 화면, 검색어, 재생 중인 곡을 실시간으로 확인하고 화면에 접속해 감시할 수 있습니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>새로고침</span>
          </button>
        </div>

        {liveSessions.length === 0 ? (
          <div className="p-10 text-center rounded-2xl border border-dashed border-neutral-200 dark:border-neutral-800 text-xs text-neutral-500 dark:text-neutral-400">
            현재 다른 브라우저/탭에서 접속 중인 청취자 세션이 없습니다. 사용자가 접속해 음악을 재생하면 실시간으로 여기에 표시됩니다.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {liveSessions.map((sess) => {
              const liveTime = getInterpolatedTime(sess);
              const totalDur = sess.duration || sess.currentTrack?.durationSec || 0;
              const pct = totalDur > 0 ? Math.min(100, (liveTime / totalDur) * 100) : 0;

              return (
                <div
                  key={sess.sessionId}
                  className="p-4 rounded-2xl bg-white dark:bg-[#161618] border border-neutral-200 dark:border-neutral-800 flex flex-col justify-between gap-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              sess.isPlaying
                                ? 'bg-emerald-500 animate-pulse'
                                : sess.currentTrack
                                  ? 'bg-amber-500'
                                  : 'bg-neutral-400'
                            }`}
                          />
                          <p className="text-sm font-bold text-neutral-900 dark:text-white truncate">
                            {sess.userName}
                          </p>
                        </div>
                        <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate pl-4">
                          {sess.userEmail} · {getTabLabel(sess.activeTab, config)} 화면
                        </p>
                      </div>
                      <span className="text-[11px] font-mono tabular-nums text-neutral-400 shrink-0">
                        #{sess.sessionId.slice(-4).toUpperCase()}
                      </span>
                    </div>

                    {sess.currentTrack ? (
                      <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900/80 border border-neutral-200/70 dark:border-neutral-800 space-y-2">
                        <div className="flex items-center gap-3">
                          <ArtworkImage
                            src={sess.currentTrack.coverUrl}
                            alt={sess.currentTrack.title}
                            className="w-11 h-11 rounded-lg shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-neutral-900 dark:text-white truncate">
                              {sess.currentTrack.title}
                            </p>
                            <p className="text-[11px] text-neutral-500 truncate">
                              {sess.currentTrack.artist}
                            </p>
                            <p className="text-[10px] font-mono tabular-nums text-neutral-400 mt-0.5">
                              {sess.isPlaying ? '재생 중' : '일시정지'} · {formatSec(liveTime)} /{' '}
                              {sess.currentTrack.duration === 'LIVE'
                                ? 'LIVE'
                                : formatSec(totalDur)}
                            </p>
                          </div>
                        </div>
                        <div className="h-1 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
                          <div
                            className="h-full transition-all duration-300"
                            style={{ width: `${pct}%`, backgroundColor: config.accentColor }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200/60 dark:border-neutral-800 text-xs text-neutral-500">
                        현재 곡 선택 대기 중
                      </div>
                    )}

                    {sess.lastSearchQuery ? (
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                        최근 검색어: <span className="font-semibold text-neutral-800 dark:text-neutral-200">{sess.lastSearchQuery}</span>
                      </p>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setSelectedSessionId(sess.sessionId)}
                      className="flex-1 py-2 px-3 rounded-xl text-xs font-semibold text-white inline-flex items-center justify-center gap-1.5 transition-opacity hover:opacity-90"
                      style={{ backgroundColor: config.accentColor }}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>사용자 화면 감시</span>
                    </button>
                    {sess.currentTrack ? (
                      <button
                        type="button"
                        onClick={() => onListenAlong(sess.currentTrack!, liveTime)}
                        title="관리자 스피커로 이 곡 같이 듣기"
                        className="py-2 px-3 rounded-xl text-xs font-semibold border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 inline-flex items-center gap-1.5 shrink-0"
                      >
                        <Headphones className="w-3.5 h-3.5" />
                        <span>같이 듣기</span>
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Full Activity Logs: Listening & Search */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 self-start">
            <button
              type="button"
              onClick={() => setHistoryTab('listening')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                historyTab === 'listening'
                  ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              재생 기록 ({listeningLogs.length})
            </button>
            <button
              type="button"
              onClick={() => setHistoryTab('search')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                historyTab === 'search'
                  ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              검색 기록 ({searchLogs.length})
            </button>
          </div>

          <div className="relative flex-1 max-w-xs">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={historyFilter}
              onChange={(e) => setHistoryFilter(e.target.value)}
              placeholder="사용자, 곡명, 검색어 필터..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-white dark:bg-[#161618] border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white focus:outline-none"
            />
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#161618] overflow-hidden">
          <div className="overflow-x-auto max-h-96">
            {historyTab === 'listening' ? (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-neutral-800 text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
                    <th className="py-2.5 px-4">시각</th>
                    <th className="py-2.5 px-3">사용자</th>
                    <th className="py-2.5 px-3">상태</th>
                    <th className="py-2.5 px-3">곡 제목</th>
                    <th className="py-2.5 px-3">아티스트</th>
                    <th className="py-2.5 px-4 text-right tabular-nums">재생 위치</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200/60 dark:divide-neutral-800/60">
                  {filteredListening.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-neutral-400">
                        기록된 감상 내역이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    filteredListening.slice(0, 150).map((log) => (
                      <tr key={log.id} className="hover:bg-neutral-50 dark:hover:bg-white/[0.02]">
                        <td className="py-2.5 px-4 font-mono tabular-nums text-[11px] text-neutral-500 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString('ko-KR')}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-semibold text-neutral-900 dark:text-white">
                            {log.userName}
                          </span>
                          <span className="block text-[11px] text-neutral-400">
                            {log.userEmail}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 whitespace-nowrap">
                          {log.action}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-neutral-900 dark:text-white max-w-[240px] truncate">
                          {log.trackTitle}
                        </td>
                        <td className="py-2.5 px-3 text-neutral-500 dark:text-neutral-400 max-w-[160px] truncate">
                          {log.artist}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums text-neutral-500 whitespace-nowrap">
                          {formatSec(log.positionSec)} / {log.duration}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-neutral-800 text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
                    <th className="py-2.5 px-4">시각</th>
                    <th className="py-2.5 px-3">사용자</th>
                    <th className="py-2.5 px-3">검색어</th>
                    <th className="py-2.5 px-3 text-right tabular-nums">검색 결과</th>
                    <th className="py-2.5 px-4 text-right">세션</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200/60 dark:divide-neutral-800/60">
                  {filteredSearch.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-neutral-400">
                        기록된 검색 내역이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    filteredSearch.slice(0, 150).map((s) => (
                      <tr key={s.id} className="hover:bg-neutral-50 dark:hover:bg-white/[0.02]">
                        <td className="py-2.5 px-4 font-mono tabular-nums text-[11px] text-neutral-500 whitespace-nowrap">
                          {new Date(s.timestamp).toLocaleString('ko-KR')}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-semibold text-neutral-900 dark:text-white">
                            {s.userName}
                          </span>
                          <span className="block text-[11px] text-neutral-400">
                            {s.userEmail}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-neutral-900 dark:text-white">
                          {s.query}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-neutral-600 dark:text-neutral-300">
                          {s.resultCount}건
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-[11px] text-neutral-400">
                          #{s.sessionId.slice(-4).toUpperCase()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </section>

      {/* Live User Screen Mirror Modal */}
      {selectedSession ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-label="사용자 화면 실시간 감시"
        >
          <div className="w-full max-w-5xl max-h-[90vh] rounded-2xl bg-white dark:bg-[#141417] border border-neutral-200 dark:border-neutral-800 shadow-2xl flex flex-col overflow-hidden">
            {/* Mirror Header */}
            <div className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0"
                  style={{ backgroundColor: config.accentColor }}
                >
                  <Monitor className="w-4 h-4" />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-sm sm:text-base font-bold text-neutral-900 dark:text-white truncate">
                      {selectedSession.userName} 실시간 화면 감시
                    </h3>
                    <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                      LIVE
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                    {selectedSession.userEmail} · 세션 #{selectedSession.sessionId.slice(-4).toUpperCase()} · 마지막 수신{' '}
                    {new Date(selectedSession.lastSeenAt).toLocaleTimeString('ko-KR')}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {selectedSession.currentTrack ? (
                  <button
                    type="button"
                    onClick={() =>
                      onListenAlong(
                        selectedSession.currentTrack!,
                        getInterpolatedTime(selectedSession),
                      )
                    }
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold text-white inline-flex items-center gap-1.5"
                    style={{ backgroundColor: config.accentColor }}
                  >
                    <Headphones className="w-3.5 h-3.5" />
                    <span>이 곡 같이 듣기</span>
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setSelectedSessionId(null)}
                  aria-label="감시 창 닫기"
                  className="p-2 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Mirror Body: Left = Mirrored Screen Viewport, Right = User Logs */}
            <div className="flex-1 overflow-y-auto grid lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-neutral-200 dark:divide-neutral-800">
              {/* Left 7 cols: Mirrored User Viewport */}
              <div className="lg:col-span-7 p-5 space-y-4 bg-neutral-100/70 dark:bg-[#0D0D0F]">
                <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#161618] overflow-hidden shadow-sm">
                  {/* Mirrored App Header */}
                  <div className="px-4 py-2.5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-3">
                    <span className="text-xs font-bold text-neutral-900 dark:text-white">
                      {config.appName} · {getTabLabel(selectedSession.activeTab, config)}
                    </span>
                    <div className="flex-1 max-w-[220px] px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-900 text-[11px] text-neutral-600 dark:text-neutral-300 flex items-center gap-1.5 truncate">
                      <Search className="w-3 h-3 text-neutral-400 shrink-0" />
                      <span className="truncate">
                        {selectedSession.lastSearchQuery || '검색어 없음'}
                      </span>
                    </div>
                  </div>

                  {/* Mirrored Screen Content */}
                  <div className="p-4 space-y-4">
                    <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                      {selectedSession.activeTab === 'listen-now' ? (
                        <PlayCircle className="w-4 h-4" style={{ color: config.accentColor }} />
                      ) : selectedSession.activeTab === 'browse' ? (
                        <Compass className="w-4 h-4" style={{ color: config.accentColor }} />
                      ) : selectedSession.activeTab === 'charts' ? (
                        <Flame className="w-4 h-4" style={{ color: config.accentColor }} />
                      ) : (
                        <Library className="w-4 h-4" style={{ color: config.accentColor }} />
                      )}
                      <span>
                        사용자가 현재 <strong className="text-neutral-900 dark:text-white">{getTabLabel(selectedSession.activeTab, config)}</strong> 화면을 보고 있습니다.
                      </span>
                    </div>

                    {/* Now Playing Mirror Card */}
                    {selectedSession.currentTrack ? (
                      <div className="p-4 rounded-xl bg-neutral-950 text-white space-y-3">
                        <div className="flex items-center gap-4">
                          <ArtworkImage
                            src={selectedSession.currentTrack.coverUrl}
                            alt={selectedSession.currentTrack.title}
                            className="w-16 h-16 rounded-xl shrink-0"
                          />
                          <div className="min-w-0 flex-1 space-y-1">
                            <p className="text-[11px] text-neutral-400">
                              {selectedSession.isPlaying ? '▶ 현재 재생 중' : '⏸ 일시정지됨'}
                              {selectedSession.showVideo ? ' · 영상 창 열림' : ''}
                            </p>
                            <p className="text-sm font-bold truncate">
                              {selectedSession.currentTrack.title}
                            </p>
                            <p className="text-xs text-neutral-300 truncate">
                              {selectedSession.currentTrack.artist}
                            </p>
                          </div>
                        </div>

                        {(() => {
                          const t = getInterpolatedTime(selectedSession);
                          const dur =
                            selectedSession.duration ||
                            selectedSession.currentTrack?.durationSec ||
                            0;
                          const pct = dur > 0 ? Math.min(100, (t / dur) * 100) : 0;
                          return (
                            <div className="space-y-1.5">
                              <div className="h-1.5 rounded-full bg-white/15 overflow-hidden">
                                <div
                                  className="h-full transition-all duration-300"
                                  style={{
                                    width: `${pct}%`,
                                    backgroundColor: config.accentColor,
                                  }}
                                />
                              </div>
                              <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-neutral-400">
                                <span>
                                  {formatSec(t)} /{' '}
                                  {selectedSession.currentTrack?.duration === 'LIVE'
                                    ? 'LIVE'
                                    : formatSec(dur)}
                                </span>
                                <span className="inline-flex items-center gap-1">
                                  {selectedSession.isMuted || selectedSession.volume === 0 ? (
                                    <VolumeX className="w-3.5 h-3.5" />
                                  ) : (
                                    <Volume2 className="w-3.5 h-3.5" />
                                  )}
                                  <span>{selectedSession.isMuted ? '음소거' : `${selectedSession.volume}%`}</span>
                                </span>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    ) : (
                      <div className="p-6 rounded-xl bg-neutral-100 dark:bg-neutral-900 text-center text-xs text-neutral-500">
                        재생 중인 곡이 없습니다.
                      </div>
                    )}

                    {/* Mirrored Queue */}
                    <div className="space-y-2">
                      <p className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
                        사용자의 대기열 미리보기 ({selectedSession.queuePreview.length})
                      </p>
                      {selectedSession.queuePreview.length === 0 ? (
                        <p className="text-xs text-neutral-400">대기열이 비어 있습니다.</p>
                      ) : (
                        <div className="divide-y divide-neutral-200/70 dark:divide-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
                          {selectedSession.queuePreview.map((qItem) => {
                            const active = qItem.id === selectedSession.currentTrack?.id;
                            return (
                              <div
                                key={qItem.id}
                                className={`px-3 py-2 flex items-center gap-2.5 text-xs ${
                                  active ? 'bg-neutral-100 dark:bg-white/[0.06]' : ''
                                }`}
                              >
                                <ArtworkImage
                                  src={qItem.coverUrl}
                                  alt={qItem.title}
                                  className="w-8 h-8 rounded shrink-0"
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="font-medium text-neutral-900 dark:text-white truncate">
                                    {qItem.title}
                                  </p>
                                  <p className="text-[11px] text-neutral-500 truncate">
                                    {qItem.artist}
                                  </p>
                                </div>
                                {active ? (
                                  selectedSession.isPlaying ? (
                                    <Play
                                      className="w-3.5 h-3.5 fill-current shrink-0"
                                      style={{ color: config.accentColor }}
                                    />
                                  ) : (
                                    <Pause className="w-3.5 h-3.5 shrink-0 text-neutral-400" />
                                  )
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right 5 cols: This User's Recent Searches & Listens */}
              <div className="lg:col-span-5 p-5 space-y-5">
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-neutral-900 dark:text-white">
                    이 사용자의 최근 검색 기록 ({selectedUserSearches.length})
                  </h4>
                  <div className="space-y-1.5 max-h-44 overflow-y-auto">
                    {selectedUserSearches.length === 0 ? (
                      <p className="text-xs text-neutral-400">검색 기록이 없습니다.</p>
                    ) : (
                      selectedUserSearches.map((s) => (
                        <div
                          key={s.id}
                          className="px-3 py-2 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-200/70 dark:border-neutral-800 flex items-center justify-between gap-2 text-xs"
                        >
                          <span className="font-medium text-neutral-900 dark:text-white truncate">
                            {s.query}
                          </span>
                          <span className="text-[11px] font-mono tabular-nums text-neutral-400 shrink-0">
                            {new Date(s.timestamp).toLocaleTimeString('ko-KR')}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-neutral-900 dark:text-white">
                    이 사용자의 최근 재생 기록 ({selectedUserListens.length})
                  </h4>
                  <div className="space-y-1.5 max-h-56 overflow-y-auto">
                    {selectedUserListens.length === 0 ? (
                      <p className="text-xs text-neutral-400">재생 기록이 없습니다.</p>
                    ) : (
                      selectedUserListens.map((l) => (
                        <div
                          key={l.id}
                          className="px-3 py-2 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-200/70 dark:border-neutral-800 flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="min-w-0">
                            <p className="font-medium text-neutral-900 dark:text-white truncate">
                              {l.trackTitle}
                            </p>
                            <p className="text-[11px] text-neutral-500 truncate">
                              {l.artist} · {l.action}
                            </p>
                          </div>
                          <span className="text-[11px] font-mono tabular-nums text-neutral-400 shrink-0">
                            {new Date(l.timestamp).toLocaleTimeString('ko-KR')}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
