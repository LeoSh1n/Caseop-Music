import {
  Compass,
  Disc3,
  Flame,
  Library,
  LogIn,
  LogOut,
  PlayCircle,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import type { AppUIConfig, AppUser, NavTab } from '../types';

interface SidebarProps {
  config: AppUIConfig;
  activeTab: NavTab;
  user: AppUser | null;
  searchQuery: string;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onSelectTab: (tab: NavTab) => void;
  onSearchChange: (q: string) => void;
  onOpenAuth: (mode: 'login' | 'signup') => void;
  onLogout: () => void;
}

export function Sidebar({
  config,
  activeTab,
  user,
  searchQuery,
  mobileOpen,
  onCloseMobile,
  onSelectTab,
  onSearchChange,
  onOpenAuth,
  onLogout,
}: SidebarProps) {
  const isAdminOrEditor = user?.role === 'admin' || user?.role === 'editor';

  const navItems: Array<{
    id: NavTab;
    label: string;
    icon: typeof PlayCircle;
    visible: boolean;
  }> = [
    {
      id: 'listen-now',
      label: config.navLabels.listenNow,
      icon: PlayCircle,
      visible: true,
    },
    {
      id: 'browse',
      label: config.navLabels.browse,
      icon: Compass,
      visible: true,
    },
    {
      id: 'charts',
      label: config.navLabels.charts,
      icon: Flame,
      visible: config.visibleSections.charts,
    },
    {
      id: 'library',
      label: config.navLabels.library,
      icon: Library,
      visible: true,
    },
    {
      id: 'admin',
      label: '개발자 콘솔',
      icon: ShieldCheck,
      visible: isAdminOrEditor,
    },
  ];

  const sidebarContent = (
    <aside className="flex flex-col h-full w-64 bg-neutral-100/90 dark:bg-[#121215] border-r border-neutral-200 dark:border-neutral-800/80 select-none">
      {/* Brand Wordmark */}
      <div className="h-16 px-5 flex items-center justify-between border-b border-neutral-200/70 dark:border-neutral-800/60 shrink-0">
        <button
          type="button"
          onClick={() => {
            onSelectTab('listen-now');
            onCloseMobile();
          }}
          className="flex items-center gap-2.5 text-left min-w-0"
        >
          <span
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0"
            style={{ backgroundColor: config.accentColor }}
          >
            <Disc3 className="w-4 h-4" />
          </span>
          <span className="font-display text-lg font-bold tracking-tight text-neutral-900 dark:text-white truncate">
            {config.appName}
          </span>
        </button>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="사이드바 닫기"
          className="lg:hidden p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Search */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (searchQuery.trim()) {
            onSelectTab('browse');
            onCloseMobile();
          }
        }}
        className="px-4 pt-4 pb-2"
      >
        <div className="relative">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => {
              onSearchChange(e.target.value);
              if (e.target.value.trim() && activeTab !== 'browse') {
                onSelectTab('browse');
              }
            }}
            placeholder="모든 노래 · 아티스트 검색"
            aria-label="곡 또는 아티스트 검색"
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg bg-white dark:bg-[#1C1C20] border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-400/50"
          />
        </div>
      </form>

      {/* Primary Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1" aria-label="주 메뉴">
        <p className="px-3 pb-1.5 text-[11px] font-semibold text-neutral-400 dark:text-neutral-500">
          음악 탐색
        </p>
        {navItems
          .filter((item) => item.visible)
          .map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectTab(item.id);
                  onCloseMobile();
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-neutral-200/80 dark:bg-white/10 text-neutral-900 dark:text-white'
                    : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200/50 dark:hover:bg-white/5 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                <Icon
                  className="w-4 h-4 shrink-0"
                  style={active ? { color: config.accentColor } : undefined}
                />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
      </nav>

      {/* Account Footer */}
      <div className="p-3.5 border-t border-neutral-200 dark:border-neutral-800/80 space-y-2.5">
        {user ? (
          <div className="flex items-center justify-between gap-2 px-2 py-1.5">
            <div className="flex items-center gap-2.5 min-w-0">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.name}
                  referrerPolicy="no-referrer"
                  className="w-8 h-8 rounded-full object-cover shrink-0 border border-neutral-300 dark:border-neutral-700"
                />
              ) : (
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                  style={{ backgroundColor: config.accentColor }}
                >
                  {user.name.slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-semibold text-neutral-900 dark:text-white truncate">
                  {user.name}
                </p>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                  {user.role === 'admin'
                    ? '관리자'
                    : user.role === 'editor'
                      ? '에디터'
                      : '멤버'}{' '}
                  · {user.provider === 'google' ? 'Google' : 'Email'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onLogout}
              aria-label="로그아웃"
              title="로그아웃"
              className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white hover:bg-neutral-200/70 dark:hover:bg-neutral-800 transition-colors shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => onOpenAuth('login')}
              className="w-full py-2 px-3 rounded-lg text-xs font-semibold text-white flex items-center justify-center gap-2 transition-opacity hover:opacity-90 whitespace-nowrap"
              style={{ backgroundColor: config.accentColor }}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>로그인 / 소셜 가입</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:block shrink-0 h-screen sticky top-0 z-20">
        {sidebarContent}
      </div>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={onCloseMobile}
          />
          <div className="relative z-50 h-full">{sidebarContent}</div>
        </div>
      ) : null}
    </>
  );
}
