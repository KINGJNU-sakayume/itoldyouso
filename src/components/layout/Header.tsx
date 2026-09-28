import { Link, NavLink } from 'react-router-dom';
import { ListOrdered, Plus, RefreshCcw, Settings2, Award } from 'lucide-react';
import { useLang } from '../../lib/i18n';
import { useVault } from '../../store/vaultStore';
import { useSync } from '../../store/authStore';
import { isStale } from '../../lib/metrics';

function useDueCount() {
  return useVault(s => s.claims.filter(c => isStale(c, s.settings.staleDays)).length);
}

function SyncState() {
  const { t } = useLang();
  const status = useSync(s => s.status);
  if (status === 'off' || status === 'signed-out' || status === 'loading') return null;
  const tone = status === 'error' ? 'bg-accent' : status === 'syncing' ? 'bg-ink-3 animate-pulse' : 'bg-ink-2';
  return (
    <Link to="/settings#sync" className="flex items-center gap-1.5 text-xs text-ink-3 hover:text-ink" title={t(`sync.${status}`)}>
      <span className={`h-1.5 w-1.5 rounded-full ${tone}`} />
      <span className={status === 'error' ? 'up' : 'hidden sm:inline'}>{t(`sync.${status}`)}</span>
    </Link>
  );
}

function Count({ n }: { n: number }) {
  if (!n) return null;
  return <span className="num ml-1 rounded-sm bg-accent px-1 text-[11px] font-medium leading-4 text-paper">{n}</span>;
}

export default function Header({ hideTabs }: { hideTabs?: boolean }) {
  const { t } = useLang();
  const due = useDueCount();

  const links = [
    { to: '/', label: t('nav.list'), icon: ListOrdered, end: true },
    { to: '/checkin', label: t('nav.checkin'), icon: RefreshCcw, count: due },
    { to: '/record', label: t('nav.record'), icon: Award },
    { to: '/settings', label: t('nav.settings'), icon: Settings2 },
  ];

  return (
    <>
      <header className="border-b border-rule pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-8 px-4 sm:px-6">
          <Link to="/" className="shrink-0 text-[17px] font-semibold tracking-tight">
            I told you so<span className="text-accent">.</span>
          </Link>
          <nav className="hidden h-full items-stretch gap-6 md:flex">
            {links.map(l => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) =>
                  `-mb-px flex items-center border-b-2 text-sm transition-colors ${
                    isActive ? 'border-ink font-medium text-ink' : 'border-transparent text-ink-2 hover:text-ink'
                  }`
                }
              >
                {l.label}
                <Count n={l.count ?? 0} />
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-4">
            <SyncState />
            <Link to="/new" className="btn btn-primary hidden md:inline-flex">
              <Plus size={15} strokeWidth={2.25} />
              {t('nav.new')}
            </Link>
          </div>
        </div>
      </header>

      {!hideTabs && (
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-rule bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
          <div className="grid h-[60px] grid-cols-5">
            {links.slice(0, 2).map(l => (
              <TabLink key={l.to} {...l} />
            ))}
            <Link to="/new" className="grid place-items-center" aria-label={t('nav.new')}>
              <span className="grid h-10 w-10 place-items-center rounded bg-ink text-paper">
                <Plus size={20} strokeWidth={2.25} />
              </span>
            </Link>
            {links.slice(2).map(l => (
              <TabLink key={l.to} {...l} />
            ))}
          </div>
        </nav>
      )}
    </>
  );
}

function TabLink({ to, label, icon: Icon, end, count }: { to: string; label: string; icon: typeof Plus; end?: boolean; count?: number }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `relative flex flex-col items-center justify-center gap-0.5 text-[11px] ${isActive ? 'font-medium text-ink' : 'text-ink-3'}`
      }
    >
      <Icon size={19} strokeWidth={1.75} />
      {label}
      {!!count && (
        <span className="num absolute right-[calc(50%-20px)] top-2 rounded-sm bg-accent px-1 text-[10px] leading-[14px] text-paper">{count}</span>
      )}
    </NavLink>
  );
}
