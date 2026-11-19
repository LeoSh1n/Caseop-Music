import { useEffect, useState } from 'react';
import { Link2, Play, Plus, Search } from 'lucide-react';
import { apiFetch } from '../lib/apiClient';
import type {
  AppUIConfig,
  AppUser,
  EditorialPlaylist,
  Track,
} from '../types';
import { ArtworkImage } from './ArtworkImage';
import { TrackTable } from './TrackTable';

const HERO_IMAGE_URL = '/src/assets/images/hero_apple_music_spatial_1795083327934.jpg';

interface ListenNowViewProps {
  config: AppUIConfig;
  tracks: Track[];
  playlists: EditorialPlaylist[];
  currentTrackId: string | null;
  isPlaying: boolean;
  favoriteIds: string[];
  canManageTracks: boolean;
  onPlayTrack: (track: Track, queue?: Track[]) => void;
  onPlayPlaylist: (playlist: EditorialPlaylist) => void;
  onToggleFavorite: (trackId: string) => void;
  onAddToQueue: (track: Track) => void;
  onDeleteTrack: (trackId: string) => void;
  onNavigateBrowse: () => void;
}

export function ListenNowView({
  config,
  tracks,
  playlists,
  currentTrackId,
  isPlaying,
  favoriteIds,
  canManageTracks,
  onPlayTrack,
  onPlayPlaylist,
  onToggleFavorite,
  onAddToQueue,
  onDeleteTrack,
  onNavigateBrowse,
}: ListenNowViewProps) {
  const radiusClass =
    config.cardRadius === 'sharp'
      ? 'rounded-lg'
      : config.cardRadius === 'soft'
        ? 'rounded-xl'
        : 'rounded-2xl';
  const sectionGap = config.layoutDensity === 'compact' ? 'space-y-8' : 'space-y-12';

  const quickPicks = tracks.slice(0, 8);
  const featuredTrack = tracks[0] || null;

  return (
    <div className={sectionGap}>
      {/* Hero Banner */}
      {config.visibleSections.heroBanner ? (
        <section
          className={`relative overflow-hidden ${radiusClass} border border-neutral-200 dark:border-neutral-800 bg-neutral-950 text-white`}
        >
          <div className="grid lg:grid-cols-12 items-stretch">
            <div className="lg:col-span-7 p-6 sm:p-10 flex flex-col justify-between gap-6 relative z-10">
              <div className="space-y-3">
                <p className="text-xs font-semibold tracking-wide text-neutral-300">
                  {config.heroKicker}
                </p>
                <h1 className="font-display text-3xl sm:text-4xl lg:text-[42px] font-bold leading-[1.15] tracking-tight text-white [text-wrap:balance]">
                  {config.heroTitle}
                </h1>
                <p className="text-sm sm:text-base text-neutral-300 max-w-xl leading-relaxed">
                  {config.heroSubtitle}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {featuredTrack ? (
                  <button
                    type="button"
                    onClick={() => onPlayTrack(featuredTrack, tracks)}
                    className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white inline-flex items-center gap-2 transition-opacity hover:opacity-90 whitespace-nowrap shrink-0"
                    style={{ backgroundColor: config.accentColor }}
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>지금 재생하기</span>
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={onNavigateBrowse}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-white/10 hover:bg-white/20 border border-white/15 transition-colors whitespace-nowrap shrink-0"
                >
                  YouTube 곡 탐색
                </button>
              </div>
            </div>

            <div className="lg:col-span-5 relative min-h-[220px] lg:min-h-[300px]">
              <ArtworkImage
                src={HERO_IMAGE_URL}
                alt="Featured Audio Studio"
                className="w-full h-full lg:h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t lg:bg-gradient-to-r from-neutral-950 via-neutral-950/35 to-transparent" />
            </div>
          </div>
        </section>
      ) : null}

      {/* Editorial Playlists */}
      {config.visibleSections.editorialPlaylists ? (
        <section className="space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-xl sm:text-2xl font-bold text-neutral-900 dark:text-white">
                에디터 추천 플레이리스트
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                무드와 사운드 질감에 따라 큐레이션된 YouTube 오디오 스트림
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {playlists.map((pl) => (
              <div
                key={pl.id}
                className={`group ${radiusClass} bg-white dark:bg-[#161618] border border-neutral-200 dark:border-neutral-800 overflow-hidden transition-colors hover:border-neutral-300 dark:hover:border-neutral-700`}
              >
                <div className="relative aspect-square overflow-hidden">
                  <ArtworkImage
                    src={pl.coverUrl}
                    alt={pl.title}
                    fallbackTitle={pl.title}
                    className="w-full h-full transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
                  <button
                    type="button"
                    onClick={() => onPlayPlaylist(pl)}
                    aria-label={`${pl.title} 재생`}
                    className="absolute bottom-4 right-4 w-11 h-11 rounded-full flex items-center justify-center text-white shadow-lg transition-transform hover:scale-105"
                    style={{ backgroundColor: config.accentColor }}
                  >
                    <Play className="w-5 h-5 fill-current ml-0.5" />
                  </button>
                  <div className="absolute bottom-4 left-4 right-16">
                    <p className="text-xs font-medium text-neutral-300 truncate">
                      {pl.subtitle}
                    </p>
                    <h3 className="font-display text-lg font-bold text-white truncate">
                      {pl.title}
                    </h3>
                  </div>
                </div>
                <div className="p-4">
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 line-clamp-2 leading-relaxed">
                    {pl.description}
                  </p>
                  <p className="mt-2 text-[11px] font-mono tabular-nums text-neutral-400">
                    {pl.trackIds.length} Tracks · YouTube Stream
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Quick Picks */}
      {config.visibleSections.quickPicks ? (
        <section className="space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-xl sm:text-2xl font-bold text-neutral-900 dark:text-white">
                빠른 선곡
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                클릭 한 번으로 바로 재생되는 인기 YouTube 트랙
              </p>
            </div>
            <button
              type="button"
              onClick={onNavigateBrowse}
              className="text-xs font-semibold hover:underline whitespace-nowrap shrink-0"
              style={{ color: config.accentColor }}
            >
              전체 곡 보기
            </button>
          </div>

          <TrackTable
            tracks={quickPicks}
            currentTrackId={currentTrackId}
            isPlaying={isPlaying}
            favoriteIds={favoriteIds}
            canManageTracks={canManageTracks}
            accentColor={config.accentColor}
            density={config.layoutDensity}
            cardRadius={config.cardRadius}
            onPlayTrack={onPlayTrack}
            onToggleFavorite={onToggleFavorite}
            onAddToQueue={onAddToQueue}
            onDeleteTrack={onDeleteTrack}
          />
        </section>
      ) : null}
    </div>
  );
}

interface BrowseViewProps {
  config: AppUIConfig;
  tracks: Track[];
  searchQuery: string;
  liveResults: Track[];
  searchingYt: boolean;
  searchError: string | null;
  user: AppUser | null;
  currentTrackId: string | null;
  isPlaying: boolean;
  favoriteIds: string[];
  canManageTracks: boolean;
  onSearchChange: (q: string) => void;
  onTriggerSearch: (q?: string) => void;
  onPlayTrack: (track: Track, queue?: Track[]) => void;
  onToggleFavorite: (trackId: string, trackObj?: Track) => void;
  onAddToQueue: (track: Track) => void;
  onTrackAdded: (tracks: Track[], newTrack: Track) => void;
  onDeleteTrack: (trackId: string) => void;
  onOpenAuth: () => void;
}

const POPULAR_SEARCHES = ['NewJeans', '아이유', '로제 APT', 'The Weeknd', 'Lo-Fi'];

export function BrowseView({
  config,
  tracks,
  searchQuery,
  liveResults,
  searchingYt,
  searchError,
  user,
  currentTrackId,
  isPlaying,
  favoriteIds,
  canManageTracks,
  onSearchChange,
  onTriggerSearch,
  onPlayTrack,
  onToggleFavorite,
  onAddToQueue,
  onTrackAdded,
  onDeleteTrack,
  onOpenAuth,
}: BrowseViewProps) {
  const [selectedGenre, setSelectedGenre] = useState<string>('전체');
  const [ytInput, setYtInput] = useState('');
  const [ytGenre, setYtGenre] = useState('K-Pop');
  const [addingTrack, setAddingTrack] = useState(false);
  const [ytFeedback, setYtFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const genres = ['전체', ...Array.from(new Set(tracks.map((t) => t.genre)))];

  const filtered = tracks.filter((t) => {
    const matchesGenre = selectedGenre === '전체' || t.genre === selectedGenre;
    if (!matchesGenre) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.title.toLowerCase().includes(q) ||
      t.artist.toLowerCase().includes(q) ||
      t.album.toLowerCase().includes(q) ||
      t.genre.toLowerCase().includes(q)
    );
  });

  const handleAddYouTubeUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      onOpenAuth();
      return;
    }
    if (!ytInput.trim()) return;

    setAddingTrack(true);
    setYtFeedback(null);
    try {
      const resolveData = await apiFetch<{
        alreadyExists?: boolean;
        track?: Track;
        resolved?: { youtubeId: string; title: string; artist: string };
      }>(`/api/youtube/resolve?url=${encodeURIComponent(ytInput.trim())}`);

      if (resolveData.alreadyExists && resolveData.track) {
        onPlayTrack(resolveData.track, tracks);
        setYtFeedback({
          type: 'success',
          text: `이미 등록된 곡을 재생합니다: ${resolveData.track.title}`,
        });
        setYtInput('');
        return;
      }

      const meta = resolveData.resolved;
      if (!meta) throw new Error('YouTube 정보를 불러오지 못했습니다.');

      const addData = await apiFetch<{ tracks: Track[]; track: Track }>(
        '/api/tracks',
        {
          method: 'POST',
          body: JSON.stringify({
            youtubeUrlOrId: meta.youtubeId,
            title: meta.title,
            artist: meta.artist,
            album: 'YouTube Import',
            genre: ytGenre,
            duration: '3:30',
          }),
        },
      );

      onTrackAdded(addData.tracks, addData.track);
      onPlayTrack(addData.track, addData.tracks);
      setYtFeedback({
        type: 'success',
        text: `새 YouTube 곡이 추가되었습니다: ${addData.track.title}`,
      });
      setYtInput('');
    } catch (err) {
      setYtFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : '추가 중 오류가 발생했습니다.',
      });
    } finally {
      setAddingTrack(false);
    }
  };

  const hasQuery = searchQuery.trim().length > 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-white">
            {config.navLabels.browse}
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            어떤 노래든 검색하면 YouTube에서 실시간으로 찾아 바로 재생할 수 있습니다
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onTriggerSearch(searchQuery);
          }}
          className="flex items-center gap-2"
        >
          <div className="relative flex-1 sm:w-80">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="노래 제목, 가수, URL 검색..."
              className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl bg-white dark:bg-[#161618] border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-neutral-400/50"
            />
          </div>
          <button
            type="submit"
            disabled={searchingYt || !hasQuery}
            className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-white disabled:opacity-50 whitespace-nowrap shrink-0"
            style={{ backgroundColor: config.accentColor }}
          >
            {searchingYt ? '검색 중...' : '검색'}
          </button>
        </form>
      </div>

      {/* Quick Search Presets */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-neutral-400 dark:text-neutral-500 font-medium">
          인기 검색어:
        </span>
        {POPULAR_SEARCHES.map((term) => (
          <button
            key={term}
            type="button"
            onClick={() => {
              onSearchChange(term);
              onTriggerSearch(term);
            }}
            className="px-3 py-1 rounded-lg bg-neutral-200/70 dark:bg-neutral-800/80 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-300/70 dark:hover:bg-neutral-700 transition-colors whitespace-nowrap"
          >
            {term}
          </button>
        ))}
        {hasQuery ? (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            className="px-3 py-1 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-white underline whitespace-nowrap"
          >
            검색 초기화
          </button>
        ) : null}
      </div>

      {/* Live YouTube Search Results AT TOP whenever searching */}
      {hasQuery ? (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-neutral-900 dark:text-white">
              &lsquo;{searchQuery.trim()}&rsquo; YouTube 검색 결과{' '}
              {liveResults.length > 0 ? `(${liveResults.length})` : ''}
            </h2>
            {searchingYt ? (
              <span className="text-xs font-medium text-neutral-400">
                모든 노래 검색 중...
              </span>
            ) : null}
          </div>

          {searchError ? (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-600 dark:text-red-400 flex items-center justify-between gap-3">
              <span>{searchError}</span>
              <button
                type="button"
                onClick={() => onTriggerSearch(searchQuery)}
                className="font-semibold underline whitespace-nowrap"
              >
                다시 검색
              </button>
            </div>
          ) : null}

          {searchingYt && liveResults.length === 0 ? (
            <div className="space-y-2.5 animate-pulse">
              {[0, 1, 2, 3, 4].map((n) => (
                <div
                  key={n}
                  className="h-14 rounded-xl bg-neutral-200/80 dark:bg-neutral-800/60"
                />
              ))}
            </div>
          ) : liveResults.length > 0 ? (
            <TrackTable
              tracks={liveResults}
              currentTrackId={currentTrackId}
              isPlaying={isPlaying}
              favoriteIds={favoriteIds}
              canManageTracks={false}
              accentColor={config.accentColor}
              density={config.layoutDensity}
              cardRadius={config.cardRadius}
              onPlayTrack={onPlayTrack}
              onToggleFavorite={(id) => {
                const target = liveResults.find((t) => t.id === id);
                onToggleFavorite(id, target);
              }}
              onAddToQueue={onAddToQueue}
            />
          ) : !searchingYt && !searchError ? (
            <div className="py-10 text-center rounded-2xl border border-dashed border-neutral-200 dark:border-neutral-800">
              <p className="text-sm font-medium text-neutral-600 dark:text-neutral-300">
                일치하는 YouTube 검색 결과를 찾지 못했습니다
              </p>
              <p className="text-xs text-neutral-400 mt-1">
                다른 가수명이나 노래 제목으로 검색해 보세요.
              </p>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Add any YouTube Track by URL / ID */}
      <form
        onSubmit={handleAddYouTubeUrl}
        className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#161618] border border-neutral-200 dark:border-neutral-800 space-y-3"
      >
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Link2 className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={ytInput}
              onChange={(e) => setYtInput(e.target.value)}
              placeholder="YouTube 영상 URL 또는 11자리 영상 ID 직접 추가 (예: https://www.youtube.com/watch?v=ArmDp-zijuc)"
              className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-400/50"
            />
          </div>
          <select
            value={ytGenre}
            onChange={(e) => setYtGenre(e.target.value)}
            aria-label="장르 선택"
            className="px-3 py-2.5 text-xs sm:text-sm rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white focus:outline-none"
          >
            <option value="K-Pop">K-Pop</option>
            <option value="Pop">Pop</option>
            <option value="R&B">R&B</option>
            <option value="Lo-Fi & Jazz">Lo-Fi & Jazz</option>
            <option value="Indie & Acoustic">Indie & Acoustic</option>
            <option value="Hip-Hop">Hip-Hop</option>
          </select>
          <button
            type="submit"
            disabled={addingTrack || !ytInput.trim()}
            className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white inline-flex items-center justify-center gap-1.5 disabled:opacity-50 transition-opacity whitespace-nowrap shrink-0"
            style={{ backgroundColor: config.accentColor }}
          >
            <Plus className="w-4 h-4" />
            <span>{addingTrack ? '불러오는 중...' : 'URL 곡 추가 & 재생'}</span>
          </button>
        </div>

        {ytFeedback ? (
          <p
            className={`text-xs font-medium ${
              ytFeedback.type === 'success'
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-red-600 dark:text-red-400'
            }`}
          >
            {ytFeedback.text}
          </p>
        ) : null}
      </form>

      {/* Catalog Section (hidden if searching & 0 local matches so no false "empty" box shows) */}
      {!hasQuery || filtered.length > 0 ? (
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-display text-lg font-bold text-neutral-900 dark:text-white">
              {hasQuery ? `추천 카탈로그 일치 곡 (${filtered.length})` : '추천 카탈로그'}
            </h2>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {genres.map((genre) => {
              const active = selectedGenre === genre;
              return (
                <button
                  key={genre}
                  type="button"
                  onClick={() => setSelectedGenre(genre)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'text-white'
                      : 'bg-neutral-200/70 dark:bg-neutral-800/80 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-300/70 dark:hover:bg-neutral-700/80'
                  }`}
                  style={active ? { backgroundColor: config.accentColor } : undefined}
                >
                  {genre}
                </button>
              );
            })}
          </div>

          <TrackTable
            tracks={filtered}
            currentTrackId={currentTrackId}
            isPlaying={isPlaying}
            favoriteIds={favoriteIds}
            canManageTracks={canManageTracks}
            accentColor={config.accentColor}
            density={config.layoutDensity}
            cardRadius={config.cardRadius}
            onPlayTrack={onPlayTrack}
            onToggleFavorite={(id) => {
              const target = filtered.find((t) => t.id === id);
              onToggleFavorite(id, target);
            }}
            onAddToQueue={onAddToQueue}
            onDeleteTrack={onDeleteTrack}
          />
        </section>
      ) : null}
    </div>
  );
}

interface ChartsViewProps {
  config: AppUIConfig;
  tracks: Track[];
  currentTrackId: string | null;
  isPlaying: boolean;
  favoriteIds: string[];
  canManageTracks: boolean;
  onPlayTrack: (track: Track, queue?: Track[]) => void;
  onToggleFavorite: (trackId: string) => void;
  onAddToQueue: (track: Track) => void;
  onDeleteTrack: (trackId: string) => void;
}

export function ChartsView({
  config,
  tracks,
  currentTrackId,
  isPlaying,
  favoriteIds,
  canManageTracks,
  onPlayTrack,
  onToggleFavorite,
  onAddToQueue,
  onDeleteTrack,
}: ChartsViewProps) {
  const ranked = [...tracks].sort((a, b) => b.plays - a.plays);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-white">
            {config.navLabels.charts}
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            재생 수 기준 실시간 Top 차트
          </p>
        </div>
        {ranked[0] ? (
          <button
            type="button"
            onClick={() => onPlayTrack(ranked[0], ranked)}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-white inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 self-start sm:self-auto"
            style={{ backgroundColor: config.accentColor }}
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>차트 전체 재생</span>
          </button>
        ) : null}
      </div>

      <TrackTable
        tracks={ranked}
        currentTrackId={currentTrackId}
        isPlaying={isPlaying}
        favoriteIds={favoriteIds}
        canManageTracks={canManageTracks}
        accentColor={config.accentColor}
        density={config.layoutDensity}
        cardRadius={config.cardRadius}
        showRank
        onPlayTrack={onPlayTrack}
        onToggleFavorite={onToggleFavorite}
        onAddToQueue={onAddToQueue}
        onDeleteTrack={onDeleteTrack}
      />
    </div>
  );
}

interface LibraryViewProps {
  config: AppUIConfig;
  user: AppUser | null;
  tracks: Track[];
  favoriteIds: string[];
  currentTrackId: string | null;
  isPlaying: boolean;
  onPlayTrack: (track: Track, queue?: Track[]) => void;
  onToggleFavorite: (trackId: string) => void;
  onAddToQueue: (track: Track) => void;
  onOpenAuth: () => void;
}

export function LibraryView({
  config,
  user,
  tracks,
  favoriteIds,
  currentTrackId,
  isPlaying,
  onPlayTrack,
  onToggleFavorite,
  onAddToQueue,
  onOpenAuth,
}: LibraryViewProps) {
  const likedTracks = tracks.filter((t) => favoriteIds.includes(t.id));

  if (!user) {
    return (
      <div className="py-20 text-center max-w-md mx-auto space-y-4">
        <h1 className="font-display text-2xl font-bold text-neutral-900 dark:text-white">
          나만의 {config.navLabels.library}
        </h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          로그인 또는 Google 소셜 회원가입 후 좋아하는 곡을 보관함에 저장하고 어디서든 이어서 감상하세요.
        </p>
        <button
          type="button"
          onClick={onOpenAuth}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white whitespace-nowrap"
          style={{ backgroundColor: config.accentColor }}
        >
          로그인 / 회원가입
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-white">
            {config.navLabels.library}
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 tabular-nums">
            {user.name}님이 저장한 곡 {likedTracks.length}곡
          </p>
        </div>
        {likedTracks[0] ? (
          <button
            type="button"
            onClick={() => onPlayTrack(likedTracks[0], likedTracks)}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-white inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 self-start sm:self-auto"
            style={{ backgroundColor: config.accentColor }}
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>보관함 재생</span>
          </button>
        ) : null}
      </div>

      <TrackTable
        tracks={likedTracks}
        currentTrackId={currentTrackId}
        isPlaying={isPlaying}
        favoriteIds={favoriteIds}
        canManageTracks={false}
        accentColor={config.accentColor}
        density={config.layoutDensity}
        cardRadius={config.cardRadius}
        onPlayTrack={onPlayTrack}
        onToggleFavorite={onToggleFavorite}
        onAddToQueue={onAddToQueue}
      />
    </div>
  );
}
