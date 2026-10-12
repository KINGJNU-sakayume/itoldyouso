import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useVault } from '../store/vaultStore';
import { useLang } from '../lib/i18n';
import { computeStats, entryValue, headline, peakMult } from '../lib/metrics';
import { evaluateAchievements, ACHIEVEMENT_COUNT } from '../lib/achievements';
import { fmtDate, fmtCompact, fmtMult } from '../lib/format';
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
  const { t, lang } = useLang();
  const claims = useVault(s => s.claims);
  const stats = useMemo(() => computeStats(claims), [claims]);
  const achievements = useMemo(() => evaluateAchievements(claims), [claims]);
  const earned = achievements.filter(a => a.earnedAt).length;
  const notable = useMemo(() => {
    const groups = new Map<string, typeof claims>();
    for (const c of [...claims].sort((a, b) => b.claimedAt.localeCompare(a.claimedAt))) {
      const h = headline(c);
      if (!h || (peakMult(c) ?? 0) < 2 || (entryValue(c, h.metric) ?? Infinity) >= 10_000) continue;
      const key = `${h.metric}\n${c.metricSources?.[h.metric] ?? ''}`;
      groups.set(key, [...(groups.get(key) ?? []), c]);
    }
    return [...groups.entries()];
  }, [claims]);

  return (
    <div>
      <h1 className="text-2xl font-semibold">{t('record.title')}</h1>

      <section className="mt-8">
        <h2 className="mb-3 font-semibold">{t('record.notable')}</h2>
        {notable.length ? notable.map(([key, songs]) => {
          const [metric, source] = key.split('\n');
          return <div key={key} className="mt-5">
            <h3 className="border-b border-ink pb-2 text-sm text-ink-2">{t(`metric.${metric}`)} · {source || t('detail.unknownSource')}</h3>
            <ul>{songs.slice(0, 5).map(c => {
              const h = headline(c)!;
              return <li key={c.id} className="border-b border-rule py-4">
                <Link to={`/p/${c.id}`} className="font-medium hover:underline">{c.track} <span className="font-normal text-ink-2">— {c.artist}</span></Link>
                <p className="mt-1 text-[13px] text-ink-3">{fmtDate(c.claimedAt)} · {fmtCompact(h.entry, lang)} → {fmtCompact(h.latest, lang)} · {fmtMult(peakMult(c)!)}</p>
                {c.note && <p className="mt-2 line-clamp-2 text-sm text-ink-2">{c.note}</p>}
              </li>;
            })}</ul>
          </div>;
        }) : <p className="border-t border-ink py-4 text-sm text-ink-3">{t('record.notableEmpty')}</p>}
        <p className="mt-3 text-[13px] text-ink-3">{t('record.notableHint')}</p>
      </section>

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

      <div className="mt-12 max-w-xl">
        <section>
          <h2 className="mb-4 font-semibold">{t('record.months')}</h2>
          <MonthStrip />
        </section>
      </div>

      <details className="mt-12 border-t border-rule pt-5">
        <summary className="mb-6 flex cursor-pointer items-baseline justify-between">
          <h2 className="text-xl font-semibold">{t('record.achievements')}</h2>
          <span className="num text-sm text-ink-2">
            {earned} / {ACHIEVEMENT_COUNT}
          </span>
        </summary>
        <AchievementGrid results={achievements} claims={claims} />
      </details>
    </div>
  );
}
