import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Search } from 'lucide-react';
import type { Claim } from '../types';
import { useVault } from '../store/vaultStore';
import { useLang } from '../lib/i18n';
import { headline, isStale, lastUpdateAt, picksThisMonth } from '../lib/metrics';
import ClaimRow, { ClaimTableHead } from '../components/claims/ClaimRow';

const STATUSES = ['all', 'watching', 'hit', 'dropped'] as const;
const SORTS = ['recent', 'growth', 'stale'] as const;
type SortKey = (typeof SORTS)[number];

function pick<T extends string>(value: string | null, options: readonly T[], fallback: T): T {
  return options.includes(value as T) ? (value as T) : fallback;
}

const sorters: Record<SortKey, (a: Claim, b: Claim) => number> = {
  recent: (a, b) => b.claimedAt.localeCompare(a.claimedAt),
  growth: (a, b) => (headline(b)?.mult ?? -1) - (headline(a)?.mult ?? -1),
  stale: (a, b) => lastUpdateAt(a).localeCompare(lastUpdateAt(b)),
};

function FirstRun() {
  const { t } = useLang();
  return (
    <div className="mx-auto max-w-xl py-6 md:py-14">
      <p className="eyebrow">I told you so</p>
      <h1 className="mt-3 text-[28px] font-semibold leading-tight md:text-4xl">{t('empty.title')}</h1>
      <p className="mt-4 text-ink-2">{t('empty.lead')}</p>
      <ol className="mt-8 border-t border-ink">
        {[1, 2, 3].map(i => (
          <li key={i} className="grid grid-cols-[2.25rem_1fr] gap-2 border-b border-rule py-4">
            <span className="num pt-0.5 text-[13px] text-ink-3">0{i}</span>
            <div>
              <p className="font-medium">{t(`empty.step${i}`)}</p>
              <p className="mt-0.5 text-sm text-ink-2">{t(`empty.step${i}Body`)}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-8 flex flex-wrap gap-2">
        <Link to="/new" className="btn btn-primary">
          {t('empty.cta')}
        </Link>
        <Link to="/settings#backup" className="btn btn-quiet">
          {t('empty.restore')}
        </Link>
      </div>
    </div>
  );
}

export default function Home() {
  const { t } = useLang();
  const claims = useVault(s => s.claims);
  const settings = useVault(s => s.settings);
  const [params, setParams] = useSearchParams();

  const status = pick(params.get('s'), STATUSES, 'all');
  const sort = pick(params.get('sort'), SORTS, 'recent');
  const q = params.get('q') ?? '';

  const setParam = (key: string, value: string, fallback: string) =>
    setParams(
      p => {
        if (!value || value === fallback) p.delete(key);
        else p.set(key, value);
        return p;
      },
      { replace: true },
    );

  const counts = useMemo(() => {
    const c = { all: claims.length, watching: 0, hit: 0, dropped: 0 };
    claims.forEach(x => c[x.status]++);
    return c;
  }, [claims]);

  const due = claims.filter(c => isStale(c, settings.staleDays)).length;
  const used = picksThisMonth(claims);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return claims
      .filter(c => status === 'all' || c.status === status)
      .filter(
        c =>
          !needle ||
          c.artist.toLowerCase().includes(needle) ||
          c.track.toLowerCase().includes(needle) ||
          c.tags.some(tag => tag.toLowerCase().includes(needle)),
      )
      .sort(sorters[sort]);
  }, [claims, status, sort, q]);

  if (!claims.length) return <FirstRun />;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-semibold">{t('list.title')}</h1>
        <p className="text-[13px] text-ink-2">
          {t('list.thisMonth')}{' '}
          <span className={`num font-medium ${settings.monthlyLimit && used >= settings.monthlyLimit ? 'up' : 'text-ink'}`}>
            {used}
            {settings.monthlyLimit ? ` / ${settings.monthlyLimit}` : ''}
          </span>
        </p>
      </div>

      {due > 0 && (
        <Link
          to="/checkin"
          className="group mt-5 flex items-center justify-between gap-3 border border-ink px-4 py-3 transition-colors hover:bg-ink hover:text-paper"
        >
          <span className="text-sm">
            {t('list.dueBanner', { count: due, days: settings.staleDays })}
          </span>
          <span className="flex shrink-0 items-center gap-1 text-sm font-medium">
            {t('nav.checkin')}
            <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
          </span>
        </Link>
      )}

      <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div role="tablist" className="seg border-b-0">
          {STATUSES.map(s => (
            <button key={s} role="tab" aria-selected={status === s} onClick={() => setParam('s', s, 'all')}>
              {t(`list.filter.${s}`)} <span className="num text-[12px] text-ink-3">{counts[s]}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-2 pb-2">
          <label className="relative flex-1 md:w-56 md:flex-none">
            <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
            <input
              type="search"
              value={q}
              onChange={e => setParam('q', e.target.value, '')}
              placeholder={t('list.search')}
              aria-label={t('list.search')}
              className="field h-9 pl-8"
            />
          </label>
          <select
            value={sort}
            onChange={e => setParam('sort', e.target.value, 'recent')}
            aria-label={t('list.sortLabel')}
            className="field h-9 w-auto"
          >
            {SORTS.map(s => (
              <option key={s} value={s}>
                {t(`list.sort.${s}`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <ClaimTableHead />
      {list.length ? (
        <ul className="border-t border-ink md:border-t-0">
          {list.map(c => (
            <ClaimRow key={c.id} claim={c} staleDays={settings.staleDays} />
          ))}
        </ul>
      ) : (
        <p className="border-t border-ink py-16 text-center text-sm text-ink-3 md:border-t-0">{t('list.noMatch')}</p>
      )}
    </div>
  );
}
