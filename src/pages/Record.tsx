import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useVault } from '../store/vaultStore';
import { useLang } from '../lib/i18n';
import { computeStats, peakMult } from '../lib/metrics';
import { evaluateAchievements, ACHIEVEMENT_COUNT } from '../lib/achievements';
import { fmtMult } from '../lib/format';
import AchievementGrid from '../components/record/AchievementGrid';

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="border-b border-rule px-1 py-4 sm:px-4">
      <dt className="text-[12px] text-ink-3">{label}</dt>
      <dd className="num mt-1 text-2xl font-medium leading-none">{value}</dd>
      {sub && <dd className="mt-1.5 truncate text-[12px] text-ink-3">{sub}</dd>}
    </div>
  );
}

function MonthStrip() {
  const { t, lang } = useLang();
  const claims = useVault(s => s.claims);
  const months = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
      const inMonth = claims.filter(c => {
        const x = new Date(c.claimedAt);
        return x.getFullYear() === d.getFullYear() && x.getMonth() === d.getMonth();
      });
      return { d, picks: inMonth.length, hits: inMonth.filter(c => c.status === 'hit').length };
    });
  }, [claims]);
  const max = Math.max(1, ...months.map(m => m.picks));
  const monthName = new Intl.DateTimeFormat(lang === 'ko' ? 'ko-KR' : 'en-US', { month: 'short' });

  return (
    <div>
      <div className="flex h-28 items-end gap-1.5 border-b border-ink">
        {months.map(m => (
          <div
            key={m.d.toISOString()}
            className="flex flex-1 flex-col justify-end"
            title={t('record.monthTip', { month: monthName.format(m.d), picks: m.picks, hits: m.hits })}
          >
            {m.picks > 0 && <span className="num mb-1 text-center text-[11px] text-ink-3">{m.picks}</span>}
            <div className="flex flex-col-reverse" style={{ height: `${(m.picks / max) * 80}px` }}>
              <div className="bg-accent" style={{ height: `${(m.hits / Math.max(1, m.picks)) * 100}%` }} />
              <div className="flex-1 bg-ink-2/80" />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        {months.map(m => (
          <span key={m.d.toISOString()} className="num flex-1 text-center text-[10px] text-ink-3">
            {m.d.getMonth() + 1}
          </span>
        ))}
      </div>
      <p className="mt-2 flex gap-4 text-[12px] text-ink-3">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 bg-ink-2/80" />
          {t('record.legendPicks')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 bg-accent" />
          {t('record.legendHits')}
        </span>
      </p>
    </div>
  );
}

export default function Record() {
  const { t } = useLang();
  const claims = useVault(s => s.claims);
  const stats = useMemo(() => computeStats(claims), [claims]);
  const achievements = useMemo(() => evaluateAchievements(claims), [claims]);
  const earned = achievements.filter(a => a.earnedAt).length;
  const top = useMemo(
    () =>
      claims
        .map(c => ({ c, mult: peakMult(c) }))
        .filter((x): x is { c: typeof x.c; mult: number } => x.mult != null)
        .sort((a, b) => b.mult - a.mult)
        .slice(0, 5),
    [claims],
  );

  return (
    <div>
      <h1 className="text-2xl font-semibold">{t('record.title')}</h1>

      <dl className="mt-6 grid grid-cols-2 border-t border-ink md:grid-cols-4">
        <Stat label={t('record.picks')} value={stats.total} sub={t('record.picksSub', { watching: stats.watching, dropped: stats.dropped })} />
        <Stat
          label={t('record.hits')}
          value={
            <>
              {stats.hits}
              {stats.hitRate != null && <span className="ml-2 text-base text-ink-3">{Math.round(stats.hitRate * 100)}%</span>}
            </>
          }
          sub={t('record.hitRate')}
        />
        <Stat
          label={t('record.avgToHit')}
          value={stats.avgDaysToHit != null ? t('record.days', { count: Math.round(stats.avgDaysToHit) }) : '—'}
          sub={t('record.avgToHitSub')}
        />
        <Stat
          label={t('record.best')}
          value={stats.best ? <span className="up">{fmtMult(stats.best.mult)}</span> : '—'}
          sub={
            stats.best && (
              <Link to={`/p/${stats.best.claim.id}`} className="hover:text-ink hover:underline">
                {stats.best.claim.track}
              </Link>
            )
          }
        />
      </dl>

      <div className="mt-12 grid gap-12 md:grid-cols-2">
        <section>
          <h2 className="mb-4 font-semibold">{t('record.months')}</h2>
          <MonthStrip />
        </section>
        <section>
          <h2 className="mb-4 font-semibold">{t('record.top')}</h2>
          {top.length ? (
            <ol className="border-t border-ink">
              {top.map(({ c, mult }, i) => (
                <li key={c.id} className="border-b border-rule">
                  <Link to={`/p/${c.id}`} className="flex items-center gap-3 py-2.5 hover:bg-sunk/70">
                    <span className="num w-5 text-[12px] text-ink-3">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-sm">
                      <span className="font-medium">{c.track}</span>
                      <span className="text-ink-3"> — {c.artist}</span>
                    </span>
                    <span className={`num text-sm font-medium ${mult >= 1 ? 'up' : 'down'}`}>{fmtMult(mult)}</span>
                  </Link>
                </li>
              ))}
            </ol>
          ) : (
            <p className="border-t border-ink py-6 text-sm text-ink-3">{t('record.topEmpty')}</p>
          )}
          <p className="mt-2 text-[12px] text-ink-3">{t('record.topNote', { checkins: stats.checkins })}</p>
        </section>
      </div>

      <section className="mt-16">
        <div className="mb-6 flex items-baseline justify-between">
          <h2 className="text-xl font-semibold">{t('record.achievements')}</h2>
          <span className="num text-sm text-ink-2">
            {earned} / {ACHIEVEMENT_COUNT}
          </span>
        </div>
        <AchievementGrid results={achievements} claims={claims} />
      </section>
    </div>
  );
}
