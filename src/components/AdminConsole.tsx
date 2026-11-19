import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  Check,
  ExternalLink,
  FileSpreadsheet,
  LayoutTemplate,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  UploadCloud,
  Users,
} from 'lucide-react';
import { apiFetch, getStoredSessionToken } from '../lib/apiClient';
import { signInWithGoogleWorkspace } from '../lib/firebaseAuth';
import {
  createUsersSpreadsheet,
  extractSpreadsheetIdFromInput,
  inspectSpreadsheet,
  readSheetPreview,
  resetAndInitializeSpreadsheet,
  syncAllToSheets,
  type SheetPreviewData,
  type SheetTabName,
} from '../services/sheetsService';
import type {
  AppUIConfig,
  AppUser,
  AuthEventLog,
  ListeningLogEntry,
  LiveUserSession,
  SearchLogEntry,
  Track,
  UserRole,
} from '../types';
import { LiveMonitorPanel } from './LiveMonitorPanel';

interface AdminConsoleProps {
  config: AppUIConfig;
  currentUser: AppUser;
  sheetsToken: string | null;
  onSheetsTokenUpdate: (token: string) => void;
  onConfigPublished: (nextConfig: AppUIConfig) => void;
  onPreviewConfigChange: (draft: AppUIConfig | null) => void;
  onListenAlong: (track: Track, positionSec: number) => void;
}

type AdminSubTab = 'monitor' | 'users' | 'sheets' | 'ui-studio';

interface PendingConfirm {
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => Promise<void>;
}

const ACCENT_PRESETS = [
  { label: 'Apple Crimson', hex: '#FA243C' },
  { label: 'Cobalt Blue', hex: '#0A84FF' },
  { label: 'Studio Emerald', hex: '#16A34A' },
  { label: 'Warm Amber', hex: '#D97706' },
  { label: 'Velvet Violet', hex: '#8B5CF6' },
];

const SHEET_TABS: Array<{ key: SheetTabName; label: string }> = [
  { key: 'Users', label: 'Users (회원·현재곡)' },
  { key: 'LiveSessions', label: 'LiveSessions (실시간)' },
  { key: 'ListeningLogs', label: 'ListeningLogs (감상기록)' },
  { key: 'SearchLogs', label: 'SearchLogs (검색기록)' },
  { key: 'AuthLogs', label: 'AuthLogs (인증로그)' },
];

export function AdminConsole({
  config,
  currentUser,
  sheetsToken,
  onSheetsTokenUpdate,
  onConfigPublished,
  onPreviewConfigChange,
  onListenAlong,
}: AdminConsoleProps) {
  const isFullAdmin = currentUser.role === 'admin';
  const [subTab, setSubTab] = useState<AdminSubTab>(isFullAdmin ? 'monitor' : 'ui-studio');

  // Users, Logs & Live Monitor state
  const [users, setUsers] = useState<AppUser[]>([]);
  const [authLogs, setAuthLogs] = useState<AuthEventLog[]>([]);
  const [searchLogs, setSearchLogs] = useState<SearchLogEntry[]>([]);
  const [listeningLogs, setListeningLogs] = useState<ListeningLogEntry[]>([]);
  const [liveSessions, setLiveSessions] = useState<LiveUserSession[]>([]);
  const [unsyncedCount, setUnsyncedCount] = useState(0);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');

  // Google Sheets state
  const [sheetInput, setSheetInput] = useState(config.spreadsheetId || '');
  const [newSheetTitle, setNewSheetTitle] = useState(`${config.appName} - 통합 사용자·음악 데이터`);
  const [sheetPreview, setSheetPreview] = useState<SheetPreviewData | null>(null);
  const [sheetViewTab, setSheetViewTab] = useState<SheetTabName>('Users');
  const [sheetsLoading, setSheetsLoading] = useState(false);

  // UI Studio state
  const [draftConfig, setDraftConfig] = useState<AppUIConfig>(config);
  const [publishingUi, setPublishingUi] = useState(false);
  const [livePreviewEnabled, setLivePreviewEnabled] = useState(true);

  // Feedback & Confirmation modal
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  useEffect(() => {
    setDraftConfig(config);
    setSheetInput(config.spreadsheetId || '');
  }, [config]);

  useEffect(() => {
    if (livePreviewEnabled && subTab === 'ui-studio') {
      onPreviewConfigChange(draftConfig);
    } else {
      onPreviewConfigChange(null);
    }
  }, [draftConfig, livePreviewEnabled, subTab, onPreviewConfigChange]);

  useEffect(() => {
    return () => onPreviewConfigChange(null);
  }, [onPreviewConfigChange]);

  const fetchMonitorAndUsers = useCallback(
    async (silent: unknown = false) => {
      if (!isFullAdmin) return;
      const isSilent = silent === true;
      if (!isSilent) setLoadingUsers(true);
      try {
        const data = await apiFetch<{
          liveSessions: LiveUserSession[];
          searchLogs: SearchLogEntry[];
          listeningLogs: ListeningLogEntry[];
          users: AppUser[];
          authLogs: AuthEventLog[];
          unsyncedCount: number;
        }>('/api/admin/monitor');
        setLiveSessions(data.liveSessions || []);
        setSearchLogs(data.searchLogs || []);
        setListeningLogs(data.listeningLogs || []);
        setUsers(data.users || []);
        setAuthLogs(data.authLogs || []);
        setUnsyncedCount(data.unsyncedCount || 0);
      } catch (err) {
        if (!isSilent) {
          setStatusMessage({
            type: 'error',
            text: err instanceof Error ? err.message : '데이터를 불러오지 못했습니다.',
          });
        }
      } finally {
        if (!isSilent) setLoadingUsers(false);
      }
    },
    [isFullAdmin],
  );

  useEffect(() => {
    fetchMonitorAndUsers();
  }, [fetchMonitorAndUsers]);

  // Serverless-friendly polling fallback when SSE drops or runs behind edge functions
  useEffect(() => {
    if (!isFullAdmin || subTab !== 'monitor') return;
    const timer = window.setInterval(() => {
      void fetchMonitorAndUsers(true);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [isFullAdmin, subTab, fetchMonitorAndUsers]);

  // Real-time admin-only SSE subscription for live user screens & search/listening logs
  useEffect(() => {
    if (!isFullAdmin) return;
    const token = getStoredSessionToken();
    const url = token
      ? `/api/admin/monitor/stream?token=${encodeURIComponent(token)}`
      : '/api/admin/monitor/stream';
    const evtSource = new EventSource(url);

    evtSource.addEventListener('monitor_snapshot', (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data) as {
          liveSessions?: LiveUserSession[];
          searchLogs?: SearchLogEntry[];
          listeningLogs?: ListeningLogEntry[];
        };
        if (data.liveSessions) setLiveSessions(data.liveSessions);
        if (data.searchLogs) setSearchLogs(data.searchLogs);
        if (data.listeningLogs) setListeningLogs(data.listeningLogs);
      } catch {
        // ignore malformed frame
      }
    });

    evtSource.addEventListener('presence_updated', (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data) as {
          liveSessions?: LiveUserSession[];
        };
        if (data.liveSessions) setLiveSessions(data.liveSessions);
      } catch {
        // ignore
      }
    });

    evtSource.addEventListener('activity_logged', (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data) as {
          searchLogs?: SearchLogEntry[];
          listeningLogs?: ListeningLogEntry[];
        };
        if (data.searchLogs) setSearchLogs(data.searchLogs);
        if (data.listeningLogs) setListeningLogs(data.listeningLogs);
      } catch {
        // ignore
      }
    });

    return () => {
      evtSource.close();
    };
  }, [isFullAdmin]);

  const loadSheetPreview = useCallback(async (token: string, spreadsheetId: string) => {
    if (!token || !spreadsheetId) return;
    setSheetsLoading(true);
    try {
      const preview = await readSheetPreview(token, spreadsheetId);
      setSheetPreview(preview);
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text:
          err instanceof Error
            ? `시트 미리보기 오류: ${err.message}`
            : 'Google Sheet 데이터를 읽지 못했습니다.',
      });
    } finally {
      setSheetsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (subTab === 'sheets' && sheetsToken && config.spreadsheetId) {
      loadSheetPreview(sheetsToken, config.spreadsheetId);
    }
  }, [subTab, sheetsToken, config.spreadsheetId, loadSheetPreview]);

  const handleRoleChange = async (targetUser: AppUser, nextRole: UserRole) => {
    setStatusMessage(null);
    try {
      const data = await apiFetch<{
        users: AppUser[];
        authLogs: AuthEventLog[];
      }>(`/api/admin/users/${targetUser.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ role: nextRole }),
      });
      setUsers(data.users);
      setAuthLogs(data.authLogs);
      setStatusMessage({
        type: 'success',
        text: `${targetUser.name} (${targetUser.email}) 권한이 '${nextRole}'(으)로 변경되었습니다.`,
      });
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : '권한 변경 중 오류가 발생했습니다.',
      });
    }
  };

  const requestDeleteUser = (targetUser: AppUser) => {
    setPendingConfirm({
      title: '사용자 계정 삭제 확인',
      description: `${targetUser.name} (${targetUser.email}) 계정을 삭제하시겠습니까? 삭제 후에도 감사 로그에는 기록이 남습니다.`,
      confirmLabel: '계정 삭제',
      destructive: true,
      onConfirm: async () => {
        const data = await apiFetch<{
          users: AppUser[];
          authLogs: AuthEventLog[];
        }>(`/api/admin/users/${targetUser.id}`, {
          method: 'DELETE',
        });
        setUsers(data.users);
        setAuthLogs(data.authLogs);
        setStatusMessage({
          type: 'success',
          text: `${targetUser.email} 계정이 삭제되었습니다.`,
        });
      },
    });
  };

  const handleConnectGoogleForSheets = async () => {
    setStatusMessage(null);
    setSheetsLoading(true);
    try {
      const { accessToken } = await signInWithGoogleWorkspace();
      onSheetsTokenUpdate(accessToken);
      setStatusMessage({
        type: 'success',
        text: 'Google Sheets 계정이 연결되었습니다.',
      });
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Google 연결이 취소되었습니다.',
      });
    } finally {
      setSheetsLoading(false);
    }
  };

  const handleCreateSpreadsheet = async () => {
    if (!sheetsToken) return;
    setSheetsLoading(true);
    setStatusMessage(null);
    try {
      const meta = await createUsersSpreadsheet(
        sheetsToken,
        newSheetTitle.trim() || `${config.appName} - 통합 데이터`,
      );
      await syncAllToSheets(
        sheetsToken,
        meta.spreadsheetId,
        users,
        authLogs,
        searchLogs,
        listeningLogs,
        liveSessions,
      );

      const saveData = await apiFetch<{ config: AppUIConfig }>(
        '/api/admin/sheets-config',
        {
          method: 'POST',
          body: JSON.stringify({
            spreadsheetId: meta.spreadsheetId,
            spreadsheetTitle: meta.title,
          }),
        },
      );

      const markData = await apiFetch<{
        users: AppUser[];
        authLogs: AuthEventLog[];
        searchLogs: SearchLogEntry[];
        listeningLogs: ListeningLogEntry[];
      }>('/api/admin/mark-synced', { method: 'POST' });
      setUsers(markData.users);
      setAuthLogs(markData.authLogs);
      setSearchLogs(markData.searchLogs);
      setListeningLogs(markData.listeningLogs);
      setUnsyncedCount(0);

      onConfigPublished(saveData.config);
      setSheetInput(meta.spreadsheetId);
      await loadSheetPreview(sheetsToken, meta.spreadsheetId);
      setStatusMessage({
        type: 'success',
        text: `새 Google Sheet '${meta.title}'가 5개 시트(Users, AuthLogs, SearchLogs, ListeningLogs, LiveSessions)로 생성되었습니다.`,
      });
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : '스프레드시트 생성에 실패했습니다.',
      });
    } finally {
      setSheetsLoading(false);
    }
  };

  const handleLinkExistingSheet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sheetsToken || !sheetInput.trim()) return;
    const id = extractSpreadsheetIdFromInput(sheetInput);
    setSheetsLoading(true);
    setStatusMessage(null);
    try {
      const meta = await inspectSpreadsheet(sheetsToken, id);
      const saveData = await apiFetch<{ config: AppUIConfig }>(
        '/api/admin/sheets-config',
        {
          method: 'POST',
          body: JSON.stringify({
            spreadsheetId: meta.spreadsheetId,
            spreadsheetTitle: meta.title,
          }),
        },
      );
      onConfigPublished(saveData.config);
      setSheetInput(meta.spreadsheetId);
      await loadSheetPreview(sheetsToken, meta.spreadsheetId);
      setStatusMessage({
        type: 'success',
        text: `기존 시트 '${meta.title}'가 연결되었습니다.`,
      });
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : '시트 ID를 확인해 주세요.',
      });
    } finally {
      setSheetsLoading(false);
    }
  };

  const requestSyncToSheets = () => {
    if (!sheetsToken || !config.spreadsheetId) return;
    setPendingConfirm({
      title: 'Google Sheets 전체 데이터 저장 확인',
      description: `연결된 시트 '${config.spreadsheetTitle || config.spreadsheetId}'에 Users(${users.length}), LiveSessions(${liveSessions.length}), ListeningLogs(${listeningLogs.length}), SearchLogs(${searchLogs.length}), AuthLogs(${authLogs.length}) 데이터를 저장합니다.`,
      confirmLabel: 'Google Sheets에 저장',
      onConfirm: async () => {
        await syncAllToSheets(
          sheetsToken,
          config.spreadsheetId,
          users,
          authLogs,
          searchLogs,
          listeningLogs,
          liveSessions,
        );
        const markData = await apiFetch<{
          users: AppUser[];
          authLogs: AuthEventLog[];
          searchLogs: SearchLogEntry[];
          listeningLogs: ListeningLogEntry[];
        }>('/api/admin/mark-synced', { method: 'POST' });
        setUsers(markData.users);
        setAuthLogs(markData.authLogs);
        setSearchLogs(markData.searchLogs);
        setListeningLogs(markData.listeningLogs);
        setUnsyncedCount(0);
        await loadSheetPreview(sheetsToken, config.spreadsheetId);
        setStatusMessage({
          type: 'success',
          text: '모든 사용자, 검색 기록, 감상 기록 및 현재 재생 상태가 Google Sheets에 저장되었습니다.',
        });
      },
    });
  };

  const requestResetSheetsAndLogs = () => {
    if (!sheetsToken || !config.spreadsheetId) return;
    setPendingConfirm({
      title: 'Google Sheets 초기화 및 다시 시작',
      description: `연결된 Google Sheet '${config.spreadsheetTitle || config.spreadsheetId}'의 기존 모든 행 데이터를 지우고 5개 시트(Users, AuthLogs, SearchLogs, ListeningLogs, LiveSessions)를 깨끗한 헤더로 초기화하며, 서버의 테스트 로그도 초기화합니다. 계속하시겠습니까?`,
      confirmLabel: '초기화 후 다시 시작',
      destructive: true,
      onConfirm: async () => {
        await resetAndInitializeSpreadsheet(sheetsToken, config.spreadsheetId);
        const resetData = await apiFetch<{
          users: AppUser[];
          authLogs: AuthEventLog[];
          searchLogs: SearchLogEntry[];
          listeningLogs: ListeningLogEntry[];
          config: AppUIConfig;
        }>('/api/admin/reset-logs', {
          method: 'POST',
          body: JSON.stringify({ clearUsers: false }),
        });

        await syncAllToSheets(
          sheetsToken,
          config.spreadsheetId,
          resetData.users,
          [],
          [],
          [],
          liveSessions,
        );
        await apiFetch('/api/admin/mark-synced', { method: 'POST' });

        setUsers(resetData.users);
        setAuthLogs([]);
        setSearchLogs([]);
        setListeningLogs([]);
        setUnsyncedCount(0);
        onConfigPublished(resetData.config);
        await loadSheetPreview(sheetsToken, config.spreadsheetId);
        setStatusMessage({
          type: 'success',
          text: 'Google Sheets와 기록이 완전히 초기화되어 새로 시작되었습니다.',
        });
      },
    });
  };

  const handleToggleAutoSync = () => {
    const nextVal = !config.autoSyncSheets;
    if (nextVal) {
      setPendingConfirm({
        title: '실시간 Google Sheets 자동 기록 활성화',
        description:
          '활성화하면 신규 회원가입, 로그인, 노래 검색 기록, 곡 재생 기록 및 현재 접속 상태를 연결된 Google Sheet에 자동으로 동기화합니다.',
        confirmLabel: '자동 기록 켜기',
        onConfirm: async () => {
          const data = await apiFetch<{ config: AppUIConfig }>('/api/admin/sheets-config', {
            method: 'POST',
            body: JSON.stringify({ autoSyncSheets: true }),
          });
          onConfigPublished(data.config);
          setStatusMessage({
            type: 'success',
            text: '실시간 Google Sheets 자동 기록이 활성화되었습니다.',
          });
        },
      });
    } else {
      apiFetch<{ config: AppUIConfig }>('/api/admin/sheets-config', {
        method: 'POST',
        body: JSON.stringify({ autoSyncSheets: false }),
      })
        .then((d) => {
          onConfigPublished(d.config);
          setStatusMessage({
            type: 'success',
            text: '실시간 Google Sheets 자동 기록이 꺼졌습니다.',
          });
        })
        .catch(() => {});
    }
  };

  const handlePublishUiToServer = async () => {
    setPublishingUi(true);
    setStatusMessage(null);
    try {
      const data = await apiFetch<{ config: AppUIConfig }>('/api/config', {
        method: 'PUT',
        body: JSON.stringify(draftConfig),
      });
      onConfigPublished(data.config);
      onPreviewConfigChange(null);
      setStatusMessage({
        type: 'success',
        text: `'${data.config.appName}' UI 및 앱 이름이 서버에 업로드되어 전체 사용자에게 즉시 반영되었습니다.`,
      });
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : '서버 업로드 중 오류가 발생했습니다.',
      });
    } finally {
      setPublishingUi(false);
    }
  };

  const requestResetUiConfig = () => {
    setPendingConfirm({
      title: 'UI 설정 기본값 복원',
      description:
        '앱 이름, 테마, 포인트 컬러 및 배너 문구를 기본값으로 되돌리고 전체 사용자에게 적용합니다.',
      confirmLabel: '기본값 복원',
      destructive: true,
      onConfirm: async () => {
        const data = await apiFetch<{ config: AppUIConfig }>('/api/config/reset', {
          method: 'POST',
        });
        setDraftConfig(data.config);
        onConfigPublished(data.config);
        onPreviewConfigChange(null);
        setStatusMessage({
          type: 'success',
          text: 'UI 설정이 기본값으로 복원되어 전체 사용자에게 반영되었습니다.',
        });
      },
    });
  };

  const filteredUsers = users.filter((u) => {
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    if (!matchesRole) return false;
    if (!userSearch.trim()) return true;
    const q = userSearch.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.provider.toLowerCase().includes(q)
    );
  });

  const googleUsersCount = users.filter((u) => u.provider === 'google').length;
  const emailUsersCount = users.filter((u) => u.provider === 'email').length;

  return (
    <div className="space-y-8">
      {/* Developer Console Header + Sub-Navigation */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-neutral-200 dark:border-neutral-800 pb-5">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-white">
            개발자 콘솔
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            실시간 사용자 화면 감시, 검색·재생 기록 추적, Google Sheets 통합 동기화 및 UI 서버 배포
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 self-start">
          {isFullAdmin ? (
            <>
              <button
                type="button"
                onClick={() => setSubTab('monitor')}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                  subTab === 'monitor'
                    ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm'
                    : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>실시간 감시 ({liveSessions.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setSubTab('users')}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                  subTab === 'users'
                    ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm'
                    : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>사용자·권한</span>
              </button>
              <button
                type="button"
                onClick={() => setSubTab('sheets')}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                  subTab === 'sheets'
                    ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm'
                    : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Google Sheets</span>
              </button>
            </>
          ) : null}
          <button
            type="button"
            onClick={() => setSubTab('ui-studio')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              subTab === 'ui-studio'
                ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm'
                : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <LayoutTemplate className="w-3.5 h-3.5" />
            <span>화면 UI · 서버 업로드</span>
          </button>
        </div>
      </div>

      {statusMessage ? (
        <div
          className={`px-4 py-3 rounded-xl text-xs font-medium border flex items-center justify-between gap-3 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20'
              : 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20'
          }`}
        >
          <span>{statusMessage.text}</span>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-[11px] opacity-75 hover:opacity-100 whitespace-nowrap"
          >
            닫기
          </button>
        </div>
      ) : null}

      {/* SUB-TAB 0: Live User Screen Monitor & Activity History */}
      {subTab === 'monitor' && isFullAdmin ? (
        <LiveMonitorPanel
          config={config}
          liveSessions={liveSessions}
          searchLogs={searchLogs}
          listeningLogs={listeningLogs}
          loading={loadingUsers}
          onRefresh={fetchMonitorAndUsers}
          onListenAlong={onListenAlong}
        />
      ) : null}

      {/* SUB-TAB 1: Users & Permissions */}
      {subTab === 'users' && isFullAdmin ? (
        <div className="space-y-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-white dark:bg-[#161618] border border-neutral-200 dark:border-neutral-800">
              <p className="text-xs text-neutral-500 dark:text-neutral-400">전체 가입자</p>
              <p className="mt-1 font-display text-2xl font-bold tabular-nums text-neutral-900 dark:text-white">
                {users.length}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-[#161618] border border-neutral-200 dark:border-neutral-800">
              <p className="text-xs text-neutral-500 dark:text-neutral-400">Google 소셜 가입</p>
              <p className="mt-1 font-display text-2xl font-bold tabular-nums text-neutral-900 dark:text-white">
                {googleUsersCount}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-[#161618] border border-neutral-200 dark:border-neutral-800">
              <p className="text-xs text-neutral-500 dark:text-neutral-400">이메일 가입</p>
              <p className="mt-1 font-display text-2xl font-bold tabular-nums text-neutral-900 dark:text-white">
                {emailUsersCount}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-[#161618] border border-neutral-200 dark:border-neutral-800">
              <p className="text-xs text-neutral-500 dark:text-neutral-400">Sheets 미동기화</p>
              <p className="mt-1 font-display text-2xl font-bold tabular-nums text-neutral-900 dark:text-white">
                {unsyncedCount}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="이름, 이메일 검색..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white dark:bg-[#161618] border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto">
              {(['all', 'admin', 'editor', 'user', 'suspended'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRoleFilter(r)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    roleFilter === r
                      ? 'text-white'
                      : 'bg-neutral-200/70 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300'
                  }`}
                  style={
                    roleFilter === r ? { backgroundColor: config.accentColor } : undefined
                  }
                >
                  {r === 'all'
                    ? '전체'
                    : r === 'admin'
                      ? '관리자'
                      : r === 'editor'
                        ? '에디터'
                        : r === 'user'
                          ? '일반'
                          : '정지'}
                </button>
              ))}
              <button
                type="button"
                onClick={fetchMonitorAndUsers}
                disabled={loadingUsers}
                aria-label="새로고침"
                className="p-2 rounded-lg border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingUsers ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#161618] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-neutral-800 text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
                    <th className="py-3 px-4">사용자</th>
                    <th className="py-3 px-3">가입 방식</th>
                    <th className="py-3 px-3">권한 관리</th>
                    <th className="py-3 px-3 hidden lg:table-cell">최근 재생 / 검색</th>
                    <th className="py-3 px-3 text-right tabular-nums">로그인</th>
                    <th className="py-3 px-3 hidden md:table-cell tabular-nums">최근 로그인</th>
                    <th className="py-3 px-3 hidden sm:table-cell">Sheets</th>
                    <th className="py-3 px-4 text-right">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200/70 dark:divide-neutral-800/70 text-xs">
                  {filteredUsers.map((u) => (
                    <tr
                      key={u.id}
                      className="hover:bg-neutral-50 dark:hover:bg-white/[0.025]"
                    >
                      <td className="py-3 px-4">
                        <p className="font-semibold text-neutral-900 dark:text-white">
                          {u.name}
                        </p>
                        <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                          {u.email}
                        </p>
                      </td>
                      <td className="py-3 px-3 text-neutral-600 dark:text-neutral-300 whitespace-nowrap">
                        {u.provider === 'google' ? 'Google 소셜' : '이메일'}
                      </td>
                      <td className="py-3 px-3">
                        <select
                          value={u.role}
                          disabled={u.id === currentUser.id}
                          onChange={(e) =>
                            handleRoleChange(u, e.target.value as UserRole)
                          }
                          aria-label={`${u.email} 권한 선택`}
                          className="px-2.5 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs font-medium text-neutral-900 dark:text-white disabled:opacity-60"
                        >
                          <option value="admin">Admin (관리자)</option>
                          <option value="editor">Editor (UI/곡 편집)</option>
                          <option value="user">User (일반 회원)</option>
                          <option value="suspended">Suspended (정지)</option>
                        </select>
                      </td>
                      <td className="py-3 px-3 hidden lg:table-cell max-w-[200px] truncate text-neutral-500 dark:text-neutral-400">
                        {u.currentTrackTitle
                          ? `${u.currentTrackTitle} (${u.isPlaying ? '재생 중' : '정지'})`
                          : u.lastSearchQuery
                            ? `검색: ${u.lastSearchQuery}`
                            : '-'}
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-neutral-700 dark:text-neutral-300">
                        {u.loginCount}
                      </td>
                      <td className="py-3 px-3 hidden md:table-cell font-mono tabular-nums text-[11px] text-neutral-500 dark:text-neutral-400 whitespace-nowrap">
                        {new Date(u.lastLoginAt).toLocaleString('ko-KR')}
                      </td>
                      <td className="py-3 px-3 hidden sm:table-cell whitespace-nowrap">
                        <span
                          className={
                            u.syncedToSheets
                              ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                              : 'text-amber-600 dark:text-amber-400 font-medium'
                          }
                        >
                          {u.syncedToSheets ? '동기화됨' : '대기 중'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          disabled={u.id === currentUser.id}
                          onClick={() => requestDeleteUser(u)}
                          aria-label={`${u.email} 삭제`}
                          className="p-1.5 rounded-lg text-neutral-400 hover:text-red-500 disabled:opacity-30 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="font-display text-lg font-bold text-neutral-900 dark:text-white">
              최근 회원가입 · 로그인 활동 로그
            </h2>
            <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#161618] overflow-hidden">
              <div className="overflow-x-auto max-h-72">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-neutral-200 dark:border-neutral-800 text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
                      <th className="py-2.5 px-4">시각</th>
                      <th className="py-2.5 px-3">이벤트</th>
                      <th className="py-2.5 px-3">이메일</th>
                      <th className="py-2.5 px-3">방식</th>
                      <th className="py-2.5 px-4">내용</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200/60 dark:divide-neutral-800/60">
                    {authLogs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-neutral-400">
                          아직 기록된 인증 활동이 없습니다.
                        </td>
                      </tr>
                    ) : (
                      authLogs.slice(0, 50).map((log) => (
                        <tr key={log.id}>
                          <td className="py-2.5 px-4 font-mono tabular-nums text-[11px] text-neutral-500 whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleString('ko-KR')}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] font-semibold text-neutral-800 dark:text-neutral-200 whitespace-nowrap">
                            {log.event}
                          </td>
                          <td className="py-2.5 px-3 text-neutral-700 dark:text-neutral-300">
                            {log.email}
                          </td>
                          <td className="py-2.5 px-3 text-neutral-500 whitespace-nowrap">
                            {log.provider === 'google' ? 'Google' : 'Email'}
                          </td>
                          <td className="py-2.5 px-4 text-neutral-600 dark:text-neutral-400">
                            {log.details}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* SUB-TAB 2: Google Sheets Integration, Reset & 5-Tab Live Viewer */}
      {subTab === 'sheets' && isFullAdmin ? (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-white dark:bg-[#161618] border border-neutral-200 dark:border-neutral-800 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-lg font-bold text-neutral-900 dark:text-white">
                  Google Sheets 통합 데이터베이스 (회원 · 검색 · 감상 · 실시간 상태)
                </h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                  회원 정보(Users), 인증 로그(AuthLogs), 검색 기록(SearchLogs), 감상 기록(ListeningLogs), 현재 재생 상태(LiveSessions) 5개 탭이 시트에 저장됩니다.
                </p>
              </div>

              {!sheetsToken ? (
                <button
                  type="button"
                  onClick={handleConnectGoogleForSheets}
                  disabled={sheetsLoading}
                  className="gsi-material-button !w-auto shrink-0"
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
                      Sign in with Google
                    </span>
                  </div>
                </button>
              ) : (
                <div className="flex items-center gap-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  <Check className="w-4 h-4" />
                  <span>Google Sheets 권한 활성됨</span>
                </div>
              )}
            </div>

            <div className="grid lg:grid-cols-2 gap-6 pt-4 border-t border-neutral-200 dark:border-neutral-800">
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  1. 새 Google Sheet 자동 생성 및 연결
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newSheetTitle}
                    onChange={(e) => setNewSheetTitle(e.target.value)}
                    placeholder="스프레드시트 제목"
                    className="flex-1 px-3.5 py-2 text-xs rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white"
                  />
                  <button
                    type="button"
                    disabled={!sheetsToken || sheetsLoading}
                    onClick={handleCreateSpreadsheet}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-40 whitespace-nowrap shrink-0"
                    style={{ backgroundColor: config.accentColor }}
                  >
                    새 시트 생성
                  </button>
                </div>
              </div>

              <form onSubmit={handleLinkExistingSheet} className="space-y-3">
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  2. 기존 Google Sheet URL 또는 ID 연결
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={sheetInput}
                    onChange={(e) => setSheetInput(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    className="flex-1 px-3.5 py-2 text-xs rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white"
                  />
                  <button
                    type="submit"
                    disabled={!sheetsToken || !sheetInput.trim() || sheetsLoading}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 disabled:opacity-40 whitespace-nowrap shrink-0"
                  >
                    시트 연결
                  </button>
                </div>
              </form>
            </div>

            {config.spreadsheetId ? (
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-4 border-t border-neutral-200 dark:border-neutral-800">
                <div className="space-y-1 text-xs">
                  <p className="font-semibold text-neutral-900 dark:text-white">
                    연결된 시트: {config.spreadsheetTitle || config.spreadsheetId}
                  </p>
                  <p className="text-neutral-500 dark:text-neutral-400 font-mono tabular-nums">
                    ID: {config.spreadsheetId} · 마지막 동기화:{' '}
                    {config.lastSheetsSyncAt
                      ? new Date(config.lastSheetsSyncAt).toLocaleString('ko-KR')
                      : '초기화 대기 중'}
                  </p>
                  <label className="inline-flex items-center gap-2 pt-1 cursor-pointer text-neutral-700 dark:text-neutral-300 font-medium">
                    <input
                      type="checkbox"
                      checked={Boolean(config.autoSyncSheets)}
                      onChange={handleToggleAutoSync}
                    />
                    <span>실시간 활동·검색·재생 기록 Google Sheets 자동 동기화</span>
                  </label>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={`https://docs.google.com/spreadsheets/d/${config.spreadsheetId}/edit`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Google Sheets 열기</span>
                  </a>
                  <button
                    type="button"
                    disabled={!sheetsToken || sheetsLoading}
                    onClick={requestResetSheetsAndLogs}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-red-500/40 text-red-600 dark:text-red-400 hover:bg-red-500/10 disabled:opacity-40 inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>시트 초기화 후 다시 시작</span>
                  </button>
                  <button
                    type="button"
                    disabled={!sheetsToken || sheetsLoading}
                    onClick={requestSyncToSheets}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-40 inline-flex items-center gap-1.5 whitespace-nowrap"
                    style={{ backgroundColor: config.accentColor }}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${sheetsLoading ? 'animate-spin' : ''}`} />
                    <span>전체 데이터 저장</span>
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          {sheetPreview ? (
            <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#161618] overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5 border-b border-neutral-200 dark:border-neutral-800">
                <div className="flex flex-wrap items-center gap-1.5">
                  {SHEET_TABS.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setSheetViewTab(t.key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                        sheetViewTab === t.key
                          ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                          : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
                      }`}
                    >
                      {t.label} ({sheetPreview.tabs[t.key].rows.length})
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  disabled={!sheetsToken || sheetsLoading}
                  onClick={() =>
                    sheetsToken &&
                    config.spreadsheetId &&
                    loadSheetPreview(sheetsToken, config.spreadsheetId)
                  }
                  className="text-xs font-medium text-neutral-500 hover:text-neutral-900 dark:hover:text-white inline-flex items-center gap-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>시트 다시 읽기</span>
                </button>
              </div>

              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/60 text-[11px] font-semibold text-neutral-500">
                      {sheetPreview.tabs[sheetViewTab].headers.map((h, i) => (
                        <th key={i} className="py-2.5 px-3 whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200/60 dark:divide-neutral-800/60">
                    {sheetPreview.tabs[sheetViewTab].rows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={sheetPreview.tabs[sheetViewTab].headers.length}
                          className="py-8 text-center text-neutral-400"
                        >
                          시트에 저장된 행이 없습니다.
                        </td>
                      </tr>
                    ) : (
                      sheetPreview.tabs[sheetViewTab].rows.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-neutral-50 dark:hover:bg-white/[0.02]">
                          {row.map((cell, cIdx) => (
                            <td
                              key={cIdx}
                              className="py-2 px-3 text-neutral-700 dark:text-neutral-300 whitespace-nowrap max-w-[240px] truncate tabular-nums"
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="p-10 text-center rounded-2xl border border-dashed border-neutral-200 dark:border-neutral-800 text-xs text-neutral-500 dark:text-neutral-400">
              Google 계정으로 로그인하면 연결된 스프레드시트({config.spreadsheetTitle || '미연결'})의 5개 시트 데이터를 확인하고 초기화·동기화할 수 있습니다.
            </div>
          )}
        </div>
      ) : null}

      {/* SUB-TAB 3: UI Studio & Global Server Publish */}
      {subTab === 'ui-studio' ? (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-white dark:bg-[#161618] border border-neutral-200 dark:border-neutral-800 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 dark:border-neutral-800 pb-4">
              <div>
                <h2 className="font-display text-lg font-bold text-neutral-900 dark:text-white">
                  전체 사용자 UI 및 앱 이름 설정
                </h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  수정 후 &lsquo;서버에 업로드&rsquo;를 누르면 접속 중인 모든 사용자의 화면과 앱 이름이 실시간으로 변경됩니다.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-2 text-xs font-medium text-neutral-600 dark:text-neutral-300 cursor-pointer mr-2">
                  <input
                    type="checkbox"
                    checked={livePreviewEnabled}
                    onChange={(e) => setLivePreviewEnabled(e.target.checked)}
                    className="rounded"
                  />
                  <span>내 화면 실시간 미리보기</span>
                </label>
                {isFullAdmin ? (
                  <button
                    type="button"
                    onClick={requestResetUiConfig}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>초기화</span>
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={publishingUi}
                  onClick={handlePublishUiToServer}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white inline-flex items-center gap-1.5 disabled:opacity-50 whitespace-nowrap"
                  style={{ backgroundColor: draftConfig.accentColor }}
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>
                    {publishingUi ? '업로드 중...' : '서버에 업로드 (전체 적용)'}
                  </span>
                </button>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                    앱 이름 (사이드바 · 브라우저 탭 · 타이틀)
                  </label>
                  <input
                    type="text"
                    value={draftConfig.appName}
                    onChange={(e) =>
                      setDraftConfig({ ...draftConfig, appName: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                    히어로 배너 상단 문구
                  </label>
                  <input
                    type="text"
                    value={draftConfig.heroKicker}
                    onChange={(e) =>
                      setDraftConfig({ ...draftConfig, heroKicker: e.target.value })
                    }
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                    메인 히어로 제목
                  </label>
                  <input
                    type="text"
                    value={draftConfig.heroTitle}
                    onChange={(e) =>
                      setDraftConfig({ ...draftConfig, heroTitle: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                    메인 히어로 설명
                  </label>
                  <textarea
                    rows={2}
                    value={draftConfig.heroSubtitle}
                    onChange={(e) =>
                      setDraftConfig({ ...draftConfig, heroSubtitle: e.target.value })
                    }
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                    전체 공지 배너 (비워두면 숨김)
                  </label>
                  <input
                    type="text"
                    value={draftConfig.announcement}
                    onChange={(e) =>
                      setDraftConfig({ ...draftConfig, announcement: e.target.value })
                    }
                    placeholder="예: 금주 금요일 밤 신곡 플레이리스트 업데이트 안내"
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                      기본 테마 모드
                    </label>
                    <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-neutral-100 dark:bg-neutral-900">
                      {(['dark', 'light'] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() =>
                            setDraftConfig({ ...draftConfig, themeMode: mode })
                          }
                          className={`py-2 rounded-lg text-xs font-semibold transition-colors ${
                            draftConfig.themeMode === mode
                              ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm'
                              : 'text-neutral-500'
                          }`}
                        >
                          {mode === 'dark' ? '다크' : '라이트'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                      레이아웃 밀도
                    </label>
                    <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-neutral-100 dark:bg-neutral-900">
                      {(['editorial', 'compact'] as const).map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() =>
                            setDraftConfig({ ...draftConfig, layoutDensity: d })
                          }
                          className={`py-2 rounded-lg text-xs font-semibold transition-colors ${
                            draftConfig.layoutDensity === d
                              ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm'
                              : 'text-neutral-500'
                          }`}
                        >
                          {d === 'editorial' ? '여유롭게' : '컴팩트'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
                    포인트 컬러 (Accent Color)
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    {ACCENT_PRESETS.map((preset) => (
                      <button
                        key={preset.hex}
                        type="button"
                        onClick={() =>
                          setDraftConfig({ ...draftConfig, accentColor: preset.hex })
                        }
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border inline-flex items-center gap-2 transition-colors ${
                          draftConfig.accentColor.toLowerCase() ===
                          preset.hex.toLowerCase()
                            ? 'border-neutral-900 dark:border-white text-neutral-900 dark:text-white'
                            : 'border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400'
                        }`}
                      >
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: preset.hex }}
                        />
                        <span>{preset.label}</span>
                      </button>
                    ))}
                    <input
                      type="color"
                      value={draftConfig.accentColor}
                      onChange={(e) =>
                        setDraftConfig({ ...draftConfig, accentColor: e.target.value })
                      }
                      aria-label="커스텀 색상 선택"
                      className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
                    사이드바 메뉴 이름
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    {(
                      [
                        ['listenNow', '지금 듣기'],
                        ['browse', '둘러보기'],
                        ['charts', '인기 차트'],
                        ['library', '보관함'],
                      ] as const
                    ).map(([key, label]) => (
                      <input
                        key={key}
                        type="text"
                        value={draftConfig.navLabels[key]}
                        aria-label={label}
                        onChange={(e) =>
                          setDraftConfig({
                            ...draftConfig,
                            navLabels: {
                              ...draftConfig.navLabels,
                              [key]: e.target.value,
                            },
                          })
                        }
                        className="px-3 py-2 text-xs rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white"
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
                    화면 섹션 노출 설정
                  </label>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {(
                      [
                        ['heroBanner', '히어로 배너'],
                        ['editorialPlaylists', '에디터 플레이리스트'],
                        ['quickPicks', '빠른 선곡 테이블'],
                        ['charts', '인기 차트 메뉴'],
                      ] as const
                    ).map(([key, label]) => (
                      <label
                        key={key}
                        className="flex items-center gap-2 p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 cursor-pointer text-neutral-700 dark:text-neutral-300"
                      >
                        <input
                          type="checkbox"
                          checked={draftConfig.visibleSections[key]}
                          onChange={(e) =>
                            setDraftConfig({
                              ...draftConfig,
                              visibleSections: {
                                ...draftConfig.visibleSections,
                                [key]: e.target.checked,
                              },
                            })
                          }
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400">
              <span>
                마지막 서버 배포: {new Date(config.updatedAt).toLocaleString('ko-KR')} (by{' '}
                {config.updatedBy})
              </span>
            </div>
          </div>
        </div>
      ) : null}

      {/* Custom Confirmation Modal */}
      {pendingConfirm ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#18181B] border border-neutral-200 dark:border-neutral-800 shadow-2xl p-6 space-y-4">
            <h3 className="font-display text-lg font-bold text-neutral-900 dark:text-white">
              {pendingConfirm.title}
            </h3>
            <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">
              {pendingConfirm.description}
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={confirmBusy}
                onClick={() => setPendingConfirm(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                취소
              </button>
              <button
                type="button"
                disabled={confirmBusy}
                onClick={async () => {
                  setConfirmBusy(true);
                  try {
                    await pendingConfirm.onConfirm();
                    setPendingConfirm(null);
                  } catch (err) {
                    setStatusMessage({
                      type: 'error',
                      text:
                        err instanceof Error ? err.message : '작업 중 오류가 발생했습니다.',
                    });
                    setPendingConfirm(null);
                  } finally {
                    setConfirmBusy(false);
                  }
                }}
                className={`px-4 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-50 ${
                  pendingConfirm.destructive ? 'bg-red-600 hover:bg-red-700' : ''
                }`}
                style={
                  !pendingConfirm.destructive
                    ? { backgroundColor: config.accentColor }
                    : undefined
                }
              >
                {confirmBusy ? '처리 중...' : pendingConfirm.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
