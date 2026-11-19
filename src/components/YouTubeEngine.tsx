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
  getIframe?: () => HTMLIFrameElement;
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

  ytApiPromise = new Promise((resolve, reject) => {
    let settled = false;
    const prevCallback = window.onYouTubeIframeAPIReady;
    const timeoutId = window.setTimeout(() => {
      if (!settled) {
        settled = true;
        ytApiPromise = null;
        reject(new Error('YouTube IFrame API load timeout'));
      }
    }, 12000);

    window.onYouTubeIframeAPIReady = () => {
      prevCallback?.();
      if (!settled) {
        settled = true;
        window.clearTimeout(timeoutId);
        resolve();
      }
    };

    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://www.youtube.com/iframe_api"]',
    );
    if (!existing) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.onerror = () => {
        if (!settled) {
          settled = true;
          window.clearTimeout(timeoutId);
          ytApiPromise = null;
          reject(new Error('YouTube IFrame API script failed'));
        }
      };
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
  const lastLoadAtRef = useRef<number>(0);
  const isLoadingTrackRef = useRef<boolean>(false);
  const autoResumeTimestampsRef = useRef<number[]>([]);

  const latestPropsRef = useRef({
    youtubeId,
    isPlaying,
    volume,
    isMuted,
    showVideo,
  });
  latestPropsRef.current = { youtubeId, isPlaying, volume, isMuted, showVideo };

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
    let retryTimer: number | null = null;
    const visibilityTimers: number[] = [];

    const clearVisibilityTimers = () => {
      while (visibilityTimers.length > 0) {
        const id = visibilityTimers.pop();
        if (id !== undefined) window.clearTimeout(id);
      }
    };

    const attemptAutoResume = (player: YTPlayerInstance): boolean => {
      const now = Date.now();
      autoResumeTimestampsRef.current = autoResumeTimestampsRef.current.filter(
        (ts) => now - ts < 4000,
      );
      if (autoResumeTimestampsRef.current.length >= 4) {
        return false;
      }
      autoResumeTimestampsRef.current.push(now);
      try {
        player.playVideo();
      } catch {
        // ignore transient errors
      }
      return true;
    };

    const handleVisibilityChange = () => {
      if (!mounted || !readyRef.current || !playerRef.current) return;
      if (!latestPropsRef.current.isPlaying) return;
      const player = playerRef.current;
      const YTState = window.YT?.PlayerState;
      clearVisibilityTimers();

      if (document.hidden) {
        // When user switches tabs or leaves the app window, counter OS/browser auto-pause on hidden iframes
        visibilityTimers.push(
          window.setTimeout(() => {
            if (!mounted || !latestPropsRef.current.isPlaying) return;
            const st = player.getPlayerState?.();
            if (st === YTState?.PAUSED || st === YTState?.CUED) {
              attemptAutoResume(player);
            }
          }, 180),
        );
        visibilityTimers.push(
          window.setTimeout(() => {
            if (!mounted || !latestPropsRef.current.isPlaying) return;
            const st = player.getPlayerState?.();
            if (st === YTState?.PAUSED || st === YTState?.CUED) {
              attemptAutoResume(player);
            }
          }, 650),
        );
      } else {
        // When returning to the tab, restore playback immediately if it was suspended while hidden
        const st = player.getPlayerState?.();
        if (st === YTState?.PAUSED || st === YTState?.CUED) {
          attemptAutoResume(player);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handleVisibilityChange);

    const initPlayer = () => {
      loadYouTubeIframeAPI()
        .then(() => {
          if (!mounted || !containerRef.current || !window.YT?.Player) return;

          const player = new window.YT.Player(containerRef.current, {
            width: '100%',
            height: '100%',
            playerVars: {
              autoplay: 0,
              controls: 1,
              rel: 0,
              modestbranding: 1,
              playsinline: 1,
              enablejsapi: 1,
              origin: window.location.origin,
              widget_referrer: window.location.href,
            },
            events: {
              onReady: (e) => {
                if (!mounted) return;
                readyRef.current = true;
                try {
                  const iframe = e.target.getIframe?.();
                  if (iframe) {
                    iframe.setAttribute(
                      'allow',
                      'autoplay; encrypted-media; picture-in-picture; clipboard-write',
                    );
                    iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
                  }
                } catch {
                  // ignore attribute guard
                }

                const current = latestPropsRef.current;
                e.target.setVolume(current.volume);
                if (current.isMuted) {
                  e.target.mute();
                } else {
                  e.target.unMute();
                }

                if (current.youtubeId) {
                  loadedVideoIdRef.current = current.youtubeId;
                  lastLoadAtRef.current = Date.now();
                  if (current.isPlaying) {
                    isLoadingTrackRef.current = true;
                    e.target.loadVideoById(current.youtubeId);
                  } else {
                    isLoadingTrackRef.current = false;
                    e.target.cueVideoById(current.youtubeId);
                  }
                }
              },
              onStateChange: (e) => {
                if (!mounted) return;
                const YTState = window.YT?.PlayerState;
                if (!YTState) return;

                if (e.data === YTState.PLAYING) {
                  isLoadingTrackRef.current = false;
                  autoResumeTimestampsRef.current = [];
                  callbacksRef.current.onStateChange(true);
                } else if (e.data === YTState.BUFFERING) {
                  // Buffering is expected during track load or seek
                } else if (e.data === YTState.CUED) {
                  if (latestPropsRef.current.isPlaying) {
                    attemptAutoResume(e.target);
                  }
                } else if (e.data === YTState.PAUSED) {
                  const withinLoadGrace = Date.now() - lastLoadAtRef.current < 1600;
                  const nonUserBackgroundPause =
                    latestPropsRef.current.isPlaying &&
                    (isLoadingTrackRef.current ||
                      withinLoadGrace ||
                      document.hidden ||
                      !latestPropsRef.current.showVideo);

                  if (nonUserBackgroundPause) {
                    if (attemptAutoResume(e.target)) {
                      return;
                    }
                  }
                  callbacksRef.current.onStateChange(false);
                } else if (e.data === YTState.ENDED) {
                  isLoadingTrackRef.current = false;
                  callbacksRef.current.onEnded();
                }
              },
              onError: (e) => {
                if (!mounted) return;
                isLoadingTrackRef.current = false;
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
        })
        .catch(() => {
          if (mounted) {
            retryTimer = window.setTimeout(initPlayer, 2000);
          }
        });
    };

    initPlayer();

    return () => {
      mounted = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handleVisibilityChange);
      clearVisibilityTimers();
      if (pollTimer !== null) window.clearInterval(pollTimer);
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      try {
        playerRef.current?.destroy();
      } catch {
        // ignore destroy errors
      }
      playerRef.current = null;
      readyRef.current = false;
      loadedVideoIdRef.current = null;
      isLoadingTrackRef.current = false;
    };
  }, []);

  // Coordinated video loading & play/pause synchronization
  useEffect(() => {
    if (!readyRef.current || !playerRef.current || !youtubeId) return;
    const player = playerRef.current;

    if (loadedVideoIdRef.current !== youtubeId) {
      loadedVideoIdRef.current = youtubeId;
      lastLoadAtRef.current = Date.now();
      autoResumeTimestampsRef.current = [];
      if (isPlaying) {
        isLoadingTrackRef.current = true;
        player.loadVideoById(youtubeId);
      } else {
        isLoadingTrackRef.current = false;
        player.cueVideoById(youtubeId);
      }
      return;
    }

    const YTState = window.YT?.PlayerState;
    const state = player.getPlayerState?.();
    if (isPlaying) {
      if (state !== YTState?.PLAYING && state !== YTState?.BUFFERING) {
        player.playVideo();
      }
    } else if (state === YTState?.PLAYING || state === YTState?.BUFFERING) {
      isLoadingTrackRef.current = false;
      player.pauseVideo();
    }
  }, [youtubeId, isPlaying]);

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
          : 'fixed bottom-20 left-2 z-20 w-[200px] h-[113px] opacity-[0.015] pointer-events-none rounded-xl overflow-hidden'
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
