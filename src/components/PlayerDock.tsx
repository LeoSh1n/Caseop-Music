import {
  Heart,
  ListMusic,
  MonitorPlay,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { Track } from '../types';
import { ArtworkImage } from './ArtworkImage';

export type RepeatMode = 'off' | 'all' | 'one';

interface PlayerDockProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isShuffle: boolean;
  repeatMode: RepeatMode;
  isFavorite: boolean;
  showVideo: boolean;
  showQueue: boolean;
  accentColor: string;
  playbackError: string | null;
  onTogglePlay: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSeek: (seconds: number) => void;
  onVolumeChange: (val: number) => void;
  onToggleMute: () => void;
  onToggleShuffle: () => void;
  onCycleRepeat: () => void;
  onToggleFavorite: () => void;
  onToggleVideo: () => void;
  onToggleQueue: () => void;
}

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return '0:00';
  const total = Math.floor(sec);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function PlayerDock({
  currentTrack,
  isPlaying,
  currentTime,
  duration,
  volume,
  isMuted,
  isShuffle,
  repeatMode,
  isFavorite,
  showVideo,
  showQueue,
  accentColor,
  playbackError,
  onTogglePlay,
  onPrev,
  onNext,
  onSeek,
  onVolumeChange,
  onToggleMute,
  onToggleShuffle,
  onCycleRepeat,
  onToggleFavorite,
  onToggleVideo,
  onToggleQueue,
}: PlayerDockProps) {
  const effectiveDuration = duration > 0 ? duration : currentTrack?.durationSec || 0;
  const progressPct =
    effectiveDuration > 0
      ? Math.min(100, Math.max(0, (currentTime / effectiveDuration) * 100))
      : 0;

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-30 border-t border-neutral-200 dark:border-neutral-800/90 bg-white/90 dark:bg-[#161618]/92 backdrop-blur-2xl">
      {/* Interactive scrubber strip along the top edge */}
      <div
        className="group relative h-1.5 w-full bg-neutral-200/80 dark:bg-neutral-800 cursor-pointer"
        onClick={(e) => {
          if (!effectiveDuration) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
          onSeek(ratio * effectiveDuration);
        }}
        role="slider"
        aria-label="재생 위치 이동"
        aria-valuemin={0}
        aria-valuemax={Math.floor(effectiveDuration)}
        aria-valuenow={Math.floor(currentTime)}
        tabIndex={0}
      >
        <div
          className="h-full transition-[width] duration-150"
          style={{ width: `${progressPct}%`, backgroundColor: accentColor }}
        />
      </div>

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-16 sm:h-[72px] flex items-center justify-between gap-4">
        {/* Left: Track info */}
        <div className="flex items-center gap-3 min-w-0 flex-1 sm:max-w-[320px]">
          {currentTrack ? (
            <>
              <ArtworkImage
                src={currentTrack.coverUrl}
                alt={currentTrack.title}
                fallbackTitle={currentTrack.title}
                className="w-11 h-11 rounded-lg shrink-0 border border-neutral-200 dark:border-neutral-800"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                  {currentTrack.title}
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                  {currentTrack.artist} · {currentTrack.album}
                </p>
                {playbackError ? (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 truncate">
                    {playbackError}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={onToggleFavorite}
                aria-label={isFavorite ? '좋아요 취소' : '보관함에 추가'}
                className="hidden sm:inline-flex p-2 rounded-lg text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white transition-colors shrink-0"
              >
                <Heart
                  className="w-4 h-4"
                  style={isFavorite ? { color: accentColor, fill: accentColor } : undefined}
                />
              </button>
            </>
          ) : (
            <div className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
              재생할 곡을 선택해 주세요
            </div>
          )}
        </div>

        {/* Center: Apple Music Transport Controls + Time */}
        <div className="flex flex-col items-center gap-1 shrink-0">
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              type="button"
              onClick={onToggleShuffle}
              aria-label="셔플"
              className={`hidden sm:inline-flex p-1.5 rounded-md transition-colors ${
                isShuffle
                  ? 'text-neutral-900 dark:text-white'
                  : 'text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
              }`}
              style={isShuffle ? { color: accentColor } : undefined}
            >
              <Shuffle className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onPrev}
              aria-label="이전 곡"
              disabled={!currentTrack}
              className="p-1.5 text-neutral-700 dark:text-neutral-200 hover:text-black dark:hover:text-white disabled:opacity-40 transition-colors"
            >
              <SkipBack className="w-5 h-5 fill-current" />
            </button>

            <button
              type="button"
              onClick={onTogglePlay}
              aria-label={isPlaying ? '일시정지' : '재생'}
              disabled={!currentTrack}
              className="w-10 h-10 rounded-full flex items-center justify-center text-white shadow-sm disabled:opacity-40 transition-transform active:scale-95"
              style={{ backgroundColor: accentColor }}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 fill-current" />
              ) : (
                <Play className="w-5 h-5 fill-current ml-0.5" />
              )}
            </button>

            <button
              type="button"
              onClick={onNext}
              aria-label="다음 곡"
              disabled={!currentTrack}
              className="p-1.5 text-neutral-700 dark:text-neutral-200 hover:text-black dark:hover:text-white disabled:opacity-40 transition-colors"
            >
              <SkipForward className="w-5 h-5 fill-current" />
            </button>

            <button
              type="button"
              onClick={onCycleRepeat}
              aria-label="반복 모드"
              className={`hidden sm:inline-flex p-1.5 rounded-md transition-colors ${
                repeatMode !== 'off'
                  ? 'text-neutral-900 dark:text-white'
                  : 'text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
              }`}
              style={repeatMode !== 'off' ? { color: accentColor } : undefined}
            >
              {repeatMode === 'one' ? (
                <Repeat1 className="w-4 h-4" />
              ) : (
                <Repeat className="w-4 h-4" />
              )}
            </button>
          </div>

          <div className="hidden md:flex items-center gap-2 text-[11px] font-mono tabular-nums text-neutral-500 dark:text-neutral-400">
            <span>{formatTime(currentTime)}</span>
            <span aria-hidden="true">/</span>
            <span>
              {currentTrack?.duration === 'LIVE'
                ? 'LIVE'
                : formatTime(effectiveDuration)}
            </span>
          </div>
        </div>

        {/* Right: Volume + Video Toggle + Queue */}
        <div className="hidden sm:flex items-center justify-end gap-2.5 flex-1 max-w-[300px]">
          <button
            type="button"
            onClick={onToggleVideo}
            aria-label="YouTube 영상 보기"
            title="YouTube 영상 창 열기/닫기"
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
              showVideo
                ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            <MonitorPlay className="w-4 h-4" />
            <span>영상</span>
          </button>

          <button
            type="button"
            onClick={onToggleQueue}
            aria-label="재생 목록"
            className={`p-2 rounded-lg transition-colors ${
              showQueue
                ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            <ListMusic className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 w-28">
            <button
              type="button"
              onClick={onToggleMute}
              aria-label={isMuted ? '음소거 해제' : '음소거'}
              className="text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white transition-colors"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={100}
              value={isMuted ? 0 : volume}
              onChange={(e) => onVolumeChange(Number(e.target.value))}
              aria-label="볼륨 조절"
              className="w-full accent-neutral-900 dark:accent-white cursor-pointer h-1"
            />
          </div>
        </div>
      </div>
    </footer>
  );
}
