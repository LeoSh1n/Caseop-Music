import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    YT?: {
      Player: new (
        element: HTMLElement | string,
        options: {
          height?: string | number;
          width?: string | number;
          videoId?: string;
          playerVars?: Record<string, string | number>;
          events?: {
            onReady?: (event: { target: YTPlayerInstance }) => void;
            onStateChange?: (event: { data: number; target: YTPlayerInstance }) => void;
            onError?: (event: { data: number }) => void;
          };
        },
      ) => YTPlayerInstance;
      PlayerState: {
        UNSTARTED: number;
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
        BUFFERING: number;
        CUED: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

export interface YTPlayerInstance {
  loadVideoById: (videoId: string) => void;
  cueVideoById: (videoId: string) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  setVolume: (volume: number) => void;
  mute: () => void;
  unMute: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  destroy: () => void;
}

interface YouTubeEngineProps {
  youtubeId: string | null;
  isPlaying: boolean;
  volume: number;
  isMuted: boolean;
  seekRequest: { seconds: number; nonce: number } | null;
  showVideo: boolean;
  onProgress: (currentTime: number, duration: number) => void;
  onStateChange: (playing: boolean) => void;
  onEnded: () => void;
  onError: (code: number) => void;
  onCloseVideo: () => void;
  trackTitle?: string;
  trackArtist?: string;
}

let ytApiPromise: Promise<void> | null = null;

function loadYouTubeIframeAPI(): Promise<void> {
  if (window.YT?.Player) {
    return Promise.resolve();
  }
  if (ytApiPromise) {
    return ytApiPromise;
  }

  ytApiPromise = new Promise((resolve) => {
    const prevCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prevCallback?.();
      resolve();
    };
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      document.head.appendChild(script);
    }
  });

  return ytApiPromise;
}

export function YouTubeEngine({
  youtubeId,
  isPlaying,
  volume,
  isMuted,
  seekRequest,
  showVideo,
  onProgress,
  onStateChange,
  onEnded,
  onError,
  onCloseVideo,
  trackTitle,
  trackArtist,
}: YouTubeEngineProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YTPlayerInstance | null>(null);
  const readyRef = useRef(false);
  const loadedVideoIdRef = useRef<string | null>(null);

  const latestPropsRef = useRef({
    youtubeId,
    isPlaying,
    volume,
    isMuted,
  });
  latestPropsRef.current = { youtubeId, isPlaying, volume, isMuted };

  const callbacksRef = useRef({
    onProgress,
    onStateChange,
    onEnded,
    onError,
  });
  callbacksRef.current = { onProgress, onStateChange, onEnded, onError };

  useEffect(() => {
    let mounted = true;
    let pollTimer: number | null = null;

    loadYouTubeIframeAPI().then(() => {
      if (!mounted || !containerRef.current || !window.YT?.Player) return;

      const initialId = latestPropsRef.current.youtubeId || undefined;
      const player = new window.YT.Player(containerRef.current, {
        width: '100%',
        height: '100%',
        videoId: initialId,
        playerVars: {
          autoplay: 0,
          controls: 1,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          enablejsapi: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: (e) => {
            readyRef.current = true;
            const current = latestPropsRef.current;
            e.target.setVolume(current.volume);
            if (current.isMuted) {
              e.target.mute();
            } else {
              e.target.unMute();
            }

            if (current.youtubeId) {
              loadedVideoIdRef.current = current.youtubeId;
              if (current.isPlaying) {
                e.target.loadVideoById(current.youtubeId);
              } else {
                e.target.cueVideoById(current.youtubeId);
              }
            }
          },
          onStateChange: (e) => {
            const YTState = window.YT?.PlayerState;
            if (!YTState) return;
            if (e.data === YTState.PLAYING) {
              callbacksRef.current.onStateChange(true);
            } else if (e.data === YTState.PAUSED) {
              callbacksRef.current.onStateChange(false);
            } else if (e.data === YTState.ENDED) {
              callbacksRef.current.onEnded();
            }
          },
          onError: (e) => {
            callbacksRef.current.onError(e.data);
          },
        },
      });

      playerRef.current = player;

      pollTimer = window.setInterval(() => {
        if (!readyRef.current || !playerRef.current) return;
        try {
          const cur = playerRef.current.getCurrentTime?.() ?? 0;
          const dur = playerRef.current.getDuration?.() ?? 0;
          callbacksRef.current.onProgress(cur, dur);
        } catch {
          // ignore transient polling errors
        }
      }, 400);
    });

    return () => {
      mounted = false;
      if (pollTimer !== null) window.clearInterval(pollTimer);
      try {
        playerRef.current?.destroy();
      } catch {
        // ignore destroy errors
      }
      playerRef.current = null;
      readyRef.current = false;
      loadedVideoIdRef.current = null;
    };
  }, []);

  // Load new video when youtubeId changes
  useEffect(() => {
    if (!readyRef.current || !playerRef.current || !youtubeId) return;
    if (loadedVideoIdRef.current !== youtubeId) {
      loadedVideoIdRef.current = youtubeId;
      if (isPlaying) {
        playerRef.current.loadVideoById(youtubeId);
      } else {
        playerRef.current.cueVideoById(youtubeId);
      }
    }
  }, [youtubeId, isPlaying]);

  // Play / Pause control
  useEffect(() => {
    if (!readyRef.current || !playerRef.current || !youtubeId) return;
    const state = playerRef.current.getPlayerState?.();
    const YTState = window.YT?.PlayerState;
    if (isPlaying && state !== YTState?.PLAYING && state !== YTState?.BUFFERING) {
      playerRef.current.playVideo();
    } else if (!isPlaying && state === YTState?.PLAYING) {
      playerRef.current.pauseVideo();
    }
  }, [isPlaying, youtubeId]);

  // Volume / Mute control
  useEffect(() => {
    if (!readyRef.current || !playerRef.current) return;
    playerRef.current.setVolume(volume);
    if (isMuted) {
      playerRef.current.mute();
    } else {
      playerRef.current.unMute();
    }
  }, [volume, isMuted]);

  // Seek control (uses nonce so repeated seeks to 0 always trigger)
  useEffect(() => {
    if (!readyRef.current || !playerRef.current || !seekRequest) return;
    playerRef.current.seekTo(seekRequest.seconds, true);
  }, [seekRequest]);

  return (
    <div
      className={
        showVideo
          ? 'fixed bottom-24 right-6 z-40 w-[340px] sm:w-[420px] rounded-2xl overflow-hidden bg-neutral-950 border border-neutral-800 shadow-2xl transition-all duration-200'
          : 'fixed bottom-0 right-0 w-[200px] h-[200px] opacity-[0.001] pointer-events-none -z-10'
      }
      aria-hidden={!showVideo}
    >
      {showVideo ? (
        <div className="flex items-center justify-between px-4 py-2.5 bg-neutral-900 border-b border-neutral-800">
          <div className="min-w-0 pr-3">
            <p className="text-xs font-semibold text-white truncate">
              {trackTitle || 'YouTube Video'}
            </p>
            <p className="text-[11px] text-neutral-400 truncate">
              {trackArtist || 'Now Playing'}
            </p>
          </div>
          <button
            type="button"
            onClick={onCloseVideo}
            className="text-xs font-medium text-neutral-300 hover:text-white px-2.5 py-1 rounded-md hover:bg-neutral-800 transition-colors whitespace-nowrap shrink-0"
          >
            닫기
          </button>
        </div>
      ) : null}
      <div className="aspect-video w-full bg-black">
        <div ref={containerRef} className="w-full h-full" />
      </div>
    </div>
  );
}
