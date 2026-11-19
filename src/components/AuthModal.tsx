import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { apiFetch, setStoredSessionToken } from '../lib/apiClient';
import { signInWithGoogleWorkspace } from '../lib/firebaseAuth';
import type { AppUser, AuthEventLog } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  appName: string;
  accentColor: string;
  initialMode?: 'login' | 'signup';
  onClose: () => void;
  onAuthSuccess: (
    user: AppUser,
    options?: {
      accessToken?: string;
      allUsers?: AppUser[];
      allLogs?: AuthEventLog[];
      isSocial?: boolean;
    },
  ) => void;
}

export function AuthModal({
  isOpen,
  appName,
  accentColor,
  initialMode = 'login',
  onClose,
  onAuthSuccess,
}: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setError(null);
      setPassword('');
    }
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/signup';
      const payload =
        mode === 'login' ? { email, password } : { name, email, password };

      const data = await apiFetch<{
        user: AppUser;
        sessionToken?: string;
        usersSnapshot?: AppUser[];
        logsSnapshot?: AuthEventLog[];
      }>(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (data.sessionToken) {
        setStoredSessionToken(data.sessionToken);
      }

      onAuthSuccess(data.user, {
        allUsers: data.usersSnapshot,
        allLogs: data.logsSnapshot,
      });
      setName('');
      setEmail('');
      setPassword('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '요청 처리 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSocial = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      const { user: fbUser, accessToken } = await signInWithGoogleWorkspace();
      const data = await apiFetch<{
        user: AppUser;
        sessionToken?: string;
        allUsers?: AppUser[];
        allLogs?: AuthEventLog[];
      }>('/api/auth/social', {
        method: 'POST',
        body: JSON.stringify({
          uid: fbUser.uid,
          email: fbUser.email,
          name: fbUser.displayName,
          photoURL: fbUser.photoURL,
        }),
      });

      if (data.sessionToken) {
        setStoredSessionToken(data.sessionToken);
      }

      onAuthSuccess(data.user, {
        accessToken,
        allUsers: data.allUsers,
        allLogs: data.allLogs,
        isSocial: true,
      });
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Google 로그인 팝업이 취소되었거나 오류가 발생했습니다.',
      );
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#18181B] border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-200 dark:border-neutral-800">
          <div>
            <h2
              id="auth-modal-title"
              className="text-lg font-bold text-neutral-900 dark:text-white"
            >
              {appName} 계정
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              로그인하여 나만의 음악 보관함과 재생 목록을 동기화하세요
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="p-2 rounded-lg text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Segmented mode switch */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-neutral-100 dark:bg-neutral-900 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                mode === 'login'
                  ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm'
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              로그인
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setError(null);
              }}
              className={`py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                mode === 'signup'
                  ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm'
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              이메일 회원가입
            </button>
          </div>

          {/* Official Google Social Login/Signup Button */}
          <button
            type="button"
            onClick={handleGoogleSocial}
            disabled={googleLoading || loading}
            className="gsi-material-button"
          >
            <div className="gsi-material-button-content-wrapper">
              <div className="gsi-material-button-icon">
                <svg
                  version="1.1"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 48 48"
                  style={{ display: 'block' }}
                >
                  <path
                    fill="#EA4335"
                    d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                  />
                  <path
                    fill="#34A853"
                    d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                  />
                  <path fill="none" d="M0 0h48v48H0z" />
                </svg>
              </div>
              <span className="gsi-material-button-contents">
                {googleLoading
                  ? 'Google 연결 중...'
                  : mode === 'signup'
                    ? 'Sign up with Google'
                    : 'Sign in with Google'}
              </span>
            </div>
          </button>

          <div className="relative flex items-center py-1">
            <div className="flex-grow border-t border-neutral-200 dark:border-neutral-800" />
            <span className="mx-3 text-[11px] font-medium text-neutral-400">
              또는 계정 정보로 계속하기
            </span>
            <div className="flex-grow border-t border-neutral-200 dark:border-neutral-800" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5" autoComplete="off">
            {mode === 'signup' ? (
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                  이름
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="이름 입력"
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-neutral-400"
                />
              </div>
            ) : null}

            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                {mode === 'login' ? '이메일 또는 아이디' : '이메일'}
              </label>
              <input
                type={mode === 'login' ? 'text' : 'email'}
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={
                  mode === 'login' ? '이메일 또는 아이디 입력' : 'name@example.com'
                }
                className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-neutral-400"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                비밀번호
              </label>
              <input
                type="password"
                required
                minLength={6}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호 입력"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-neutral-400"
              />
            </div>

            {error ? (
              <div className="rounded-xl px-3.5 py-2.5 text-xs font-medium bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading || googleLoading}
              className="w-full py-2.5 px-4 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: accentColor }}
            >
              {loading
                ? '처리 중...'
                : mode === 'login'
                  ? '로그인'
                  : '회원가입 완료'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
