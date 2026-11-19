import type { Track } from '../types';

interface MediaSessionCallbacks {
  onPlay: () => void;
  onPause: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSeekTo: (seconds: number) => void;
  onSeekBy: (deltaSeconds: number) => void;
}

let sharedAudioCtx: AudioContext | null = null;
let silentSource: AudioBufferSourceNode | null = null;

/**
 * Starts a nearly zero-amplitude Web Audio loop when playing so browsers
 * treat the tab as active media and do not throttle timers or suspend
 * playback when the user switches tabs or leaves the browser window.
 */
export function syncBackgroundAudioKeepAlive(isPlaying: boolean): void {
  if (typeof window === 'undefined') return;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return;

  try {
    if (isPlaying) {
      if (!sharedAudioCtx) {
        sharedAudioCtx = new AudioCtx();
      }
      if (sharedAudioCtx.state === 'suspended') {
        void sharedAudioCtx.resume().catch(() => {});
      }
      if (!silentSource) {
        const buffer = sharedAudioCtx.createBuffer(1, sharedAudioCtx.sampleRate, sharedAudioCtx.sampleRate);
        const gain = sharedAudioCtx.createGain();
        gain.gain.value = 0.00001;
        const src = sharedAudioCtx.createBufferSource();
        src.buffer = buffer;
        src.loop = true;
        src.connect(gain);
        gain.connect(sharedAudioCtx.destination);
        src.start(0);
        silentSource = src;
      }
    } else if (sharedAudioCtx && sharedAudioCtx.state === 'running') {
      void sharedAudioCtx.suspend().catch(() => {});
    }
  } catch {
    // Non-fatal if AudioContext is restricted by browser policy
  }
}

export function updateMediaSessionMetadata(track: Track | null, appName: string): void {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
  if (!track) {
    navigator.mediaSession.metadata = null;
    return;
  }
  if (typeof MediaMetadata === 'undefined') return;

  try {
    const artworkUrl = track.coverUrl || `https://i.ytimg.com/vi/${track.youtubeId}/hqdefault.jpg`;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist,
      album: track.album || appName,
      artwork: [
        { src: artworkUrl, sizes: '480x360', type: 'image/jpeg' },
        { src: `https://i.ytimg.com/vi/${track.youtubeId}/maxresdefault.jpg`, sizes: '1280x720', type: 'image/jpeg' },
      ],
    });
  } catch {
    // Ignore unsupported MediaMetadata fields
  }
}

export function updateMediaSessionPlaybackState(isPlaying: boolean, hasTrack: boolean): void {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.playbackState = !hasTrack
      ? 'none'
      : isPlaying
        ? 'playing'
        : 'paused';
  } catch {
    // Ignore unsupported playbackState
  }
}

export function updateMediaSessionPosition(
  currentTime: number,
  duration: number,
  isPlaying: boolean,
): void {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
  if (typeof navigator.mediaSession.setPositionState !== 'function') return;
  if (!Number.isFinite(duration) || duration <= 0) return;

  try {
    const safePos = Math.min(duration, Math.max(0, Number.isFinite(currentTime) ? currentTime : 0));
    navigator.mediaSession.setPositionState({
      duration,
      playbackRate: isPlaying ? 1 : 0,
      position: safePos,
    });
  } catch {
    // Ignore invalid transient durations
  }
}

export function registerMediaSessionHandlers(callbacks: MediaSessionCallbacks): () => void {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) {
    return () => {};
  }

  const ms = navigator.mediaSession;
  const actions: Array<[MediaSessionAction, MediaSessionActionHandler | null]> = [
    ['play', () => callbacks.onPlay()],
    ['pause', () => callbacks.onPause()],
    ['previoustrack', () => callbacks.onPrev()],
    ['nexttrack', () => callbacks.onNext()],
    [
      'seekto',
      (details) => {
        if (typeof details.seekTime === 'number' && Number.isFinite(details.seekTime)) {
          callbacks.onSeekTo(Math.max(0, details.seekTime));
        }
      },
    ],
    [
      'seekbackward',
      (details) => {
        callbacks.onSeekBy(-(details.seekOffset || 10));
      },
    ],
    [
      'seekforward',
      (details) => {
        callbacks.onSeekBy(details.seekOffset || 10);
      },
    ],
  ];

  for (const [action, handler] of actions) {
    try {
      ms.setActionHandler(action, handler);
    } catch {
      // Action not supported on this browser
    }
  }

  return () => {
    for (const [action] of actions) {
      try {
        ms.setActionHandler(action, null);
      } catch {
        // Ignore cleanup errors
      }
    }
  };
}
