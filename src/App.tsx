import { useEffect, useMemo } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import Header from './components/layout/Header';
import Toaster from './components/ui/Toaster';
import Home from './pages/Home';
import ClaimForm from './pages/ClaimForm';
import ClaimDetail from './pages/ClaimDetail';
import CheckIn from './pages/CheckIn';
import Record from './pages/Record';
import Settings from './pages/Settings';
import NotFound from './pages/NotFound';
import { useVault } from './store/vaultStore';
import { useSync } from './store/authStore';
import { toast } from './store/toastStore';
import { evaluateAchievements } from './lib/achievements';
import { useLang } from './lib/i18n';

/** Announces achievements the moment the data first satisfies them. */
function AchievementWatcher() {
  const { t } = useLang();
  const navigate = useNavigate();
  const claims = useVault(s => s.claims);
  const seen = useVault(s => s.seen);
  const markSeen = useVault(s => s.markSeen);
  // Wait for the first cloud pull so another device's progress isn't re-announced.
  const ready = useSync(s => s.ready);
  const earned = useMemo(() => evaluateAchievements(claims).filter(a => a.earnedAt), [claims]);

  useEffect(() => {
    if (!ready) return;
    const fresh = earned.filter(a => !seen.includes(a.id));
    if (!fresh.length) return;
    markSeen(fresh.map(a => a.id));
    if (fresh.length > 3) {
      toast({
        kind: 'achievement',
        mark: String(fresh.length),
        title: t('toast.manyAchievements', { count: fresh.length }),
        action: { label: t('toast.view'), run: () => navigate('/record') },
      });
      return;
    }
    fresh.forEach(a =>
      toast({ kind: 'achievement', mark: a.glyph, title: t(`ach.${a.id}.name`), body: t(`ach.${a.id}.desc`) }),
    );
  }, [earned, seen, ready, markSeen, navigate, t]);

  return null;
}

function PageEffects() {
  const { t } = useLang();
  const { pathname } = useLocation();
  const navType = useNavigationType();
  const navigate = useNavigate();
  const detailTrack = useVault(s => {
    const id = /^\/p\/([^/]+)/.exec(pathname)?.[1];
    return id ? s.claims.find(c => c.id === id)?.track : undefined;
  });

  useEffect(() => {
    if (navType !== 'POP') window.scrollTo(0, 0);
  }, [pathname, navType]);

  useEffect(() => {
    const titles: Record<string, string> = {
      '/': t('list.title'),
      '/new': t('form.newTitle'),
      '/checkin': t('checkin.title'),
      '/record': t('record.title'),
      '/settings': t('settings.title'),
    };
    const page = detailTrack ?? titles[pathname];
    document.title = page ? `${page} · I Told You So` : 'I Told You So';
  }, [pathname, detailTrack, t]);

  // "n" anywhere (outside a text field) starts a new pick.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'n' || e.metaKey || e.ctrlKey || e.altKey || e.isComposing) return;
      const el = e.target as HTMLElement;
      if (el.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return;
      e.preventDefault();
      navigate('/new');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  return null;
}

function Shell() {
  const { pathname } = useLocation();
  const inForm = pathname === '/new' || pathname.endsWith('/edit');

  return (
    <div className="min-h-dvh">
      <Header hideTabs={inForm} />
      <main className={`mx-auto max-w-5xl px-4 pt-6 sm:px-6 md:pt-10 ${inForm ? 'pb-6' : 'pb-28 md:pb-20'}`}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/new" element={<ClaimForm />} />
          <Route path="/p/:id" element={<ClaimDetail />} />
          <Route path="/p/:id/edit" element={<ClaimForm />} />
          <Route path="/checkin" element={<CheckIn />} />
          <Route path="/record" element={<Record />} />
          <Route path="/settings" element={<Settings />} />
          {/* Paths from the old multi-user version */}
          <Route path="/vault" element={<Navigate to="/record" replace />} />
          <Route path="/badges" element={<Navigate to="/record" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Toaster />
      <AchievementWatcher />
      <PageEffects />
    </div>
  );
}

export default function App() {
  useEffect(() => useSync.getState().start(), []);
  return (
    <HashRouter>
      <Shell />
    </HashRouter>
  );
}
