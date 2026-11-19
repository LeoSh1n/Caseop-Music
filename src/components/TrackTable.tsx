import { Heart, Pause, Play, Plus, Trash2 } from 'lucide-react';
import type { CardRadius, LayoutDensity, Track } from '../types';
import { ArtworkImage } from './ArtworkImage';

interface TrackTableProps {
  tracks: Track[];
  currentTrackId: string | null;
  isPlaying: boolean;
  favoriteIds: string[];
  canManageTracks: boolean;
  accentColor: string;
  density: LayoutDensity;
  cardRadius: CardRadius;
  showRank?: boolean;
  onPlayTrack: (track: Track, queue?: Track[]) => void;
  onToggleFavorite: (trackId: string) => void;
  onAddToQueue: (track: Track) => void;
  onDeleteTrack?: (trackId: string) => void;
}

export function TrackTable({
  tracks,
  currentTrackId,
  isPlaying,
  favoriteIds,
  canManageTracks,
  accentColor,
  density,
  cardRadius,
  showRank = false,
  onPlayTrack,
  onToggleFavorite,
  onAddToQueue,
  onDeleteTrack,
}: TrackTableProps) {
  const rowPy = density === 'compact' ? 'py-2' : 'py-2.5';
  const thumbRadius =
    cardRadius === 'sharp'
      ? 'rounded'
      : cardRadius === 'soft'
        ? 'rounded-md'
        : 'rounded-lg';

  if (tracks.length === 0) {
    return (
      <div className="py-14 text-center border border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl">
        <p className="text-sm font-medium text-neutral-600 dark:text-neutral-300">
          표시할 트랙이 없습니다
        </p>
        <p className="text-xs text-neutral-400 mt-1">
          검색어를 변경하거나 YouTube URL을 추가해 보세요.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-neutral-200 dark:border-neutral-800 text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
            <th className="py-2.5 pl-3 pr-2 w-10 text-right font-mono">#</th>
            <th className="py-2.5 px-3">노래</th>
            <th className="py-2.5 px-3 hidden md:table-cell">앨범</th>
            <th className="py-2.5 px-3 hidden sm:table-cell">장르</th>
            <th className="py-2.5 px-3 text-right tabular-nums w-20">시간</th>
            <th className="py-2.5 pl-2 pr-3 text-right w-28">작업</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-200/60 dark:divide-neutral-800/60">
          {tracks.map((track, idx) => {
            const isCurrent = track.id === currentTrackId;
            const isFav = favoriteIds.includes(track.id);

            return (
              <tr
                key={track.id}
                onDoubleClick={() => onPlayTrack(track, tracks)}
                className={`group transition-colors ${
                  isCurrent
                    ? 'bg-neutral-100/90 dark:bg-white/[0.06]'
                    : 'hover:bg-neutral-100/60 dark:hover:bg-white/[0.035]'
                }`}
              >
                <td className={`${rowPy} pl-3 pr-2 text-right font-mono tabular-nums text-xs`}>
                  {isCurrent ? (
                    <span
                      className="font-bold"
                      style={{ color: accentColor }}
                    >
                      {showRank ? idx + 1 : '▶'}
                    </span>
                  ) : (
                    <span className="text-neutral-400 dark:text-neutral-500">
                      {idx + 1}
                    </span>
                  )}
                </td>

                <td className={`${rowPy} px-3`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => onPlayTrack(track, tracks)}
                      aria-label={`${track.title} 재생`}
                      className={`relative w-10 h-10 ${thumbRadius} overflow-hidden shrink-0 border border-neutral-200 dark:border-neutral-800`}
                    >
                      <ArtworkImage
                        src={track.coverUrl}
                        alt={track.title}
                        className="w-full h-full"
                      />
                      <span
                        className={`absolute inset-0 flex items-center justify-center bg-black/50 text-white transition-opacity ${
                          isCurrent
                            ? 'opacity-100'
                            : 'opacity-0 group-hover:opacity-100'
                        }`}
                      >
                        {isCurrent && isPlaying ? (
                          <Pause className="w-4 h-4 fill-current" />
                        ) : (
                          <Play className="w-4 h-4 fill-current ml-0.5" />
                        )}
                      </span>
                    </button>

                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => onPlayTrack(track, tracks)}
                        className="text-left block max-w-[220px] sm:max-w-[320px] truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100 hover:underline"
                        style={isCurrent ? { color: accentColor } : undefined}
                      >
                        {track.title}
                      </button>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate max-w-[220px] sm:max-w-[320px]">
                        {track.artist}
                      </p>
                    </div>
                  </div>
                </td>

                <td className={`${rowPy} px-3 hidden md:table-cell text-xs text-neutral-500 dark:text-neutral-400 max-w-[200px] truncate`}>
                  {track.album}
                </td>

                <td className={`${rowPy} px-3 hidden sm:table-cell text-xs text-neutral-500 dark:text-neutral-400 whitespace-nowrap`}>
                  {track.genre}
                </td>

                <td className={`${rowPy} px-3 text-right font-mono tabular-nums text-xs text-neutral-500 dark:text-neutral-400 whitespace-nowrap`}>
                  {track.duration}
                </td>

                <td className={`${rowPy} pl-2 pr-3 text-right whitespace-nowrap`}>
                  <div className="inline-flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => onToggleFavorite(track.id)}
                      aria-label={isFav ? '보관함에서 제거' : '보관함에 추가'}
                      className="p-1.5 rounded-md text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
                    >
                      <Heart
                        className="w-4 h-4"
                        style={isFav ? { color: accentColor, fill: accentColor } : undefined}
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => onAddToQueue(track)}
                      aria-label="재생 목록에 추가"
                      title="다음 곡으로 대기열에 추가"
                      className="p-1.5 rounded-md text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    {canManageTracks && onDeleteTrack ? (
                      <button
                        type="button"
                        onClick={() => onDeleteTrack(track.id)}
                        aria-label={`${track.title} 삭제`}
                        title="트랙 삭제"
                        className="p-1.5 rounded-md text-neutral-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
