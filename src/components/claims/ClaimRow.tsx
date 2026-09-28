import { Link } from 'react-router-dom';
import type { Claim } from '../../types';
import { baseMetric, headline, isStale } from '../../lib/metrics';
import { dPlus, fmtCompact, fmtDate } from '../../lib/format';
import { useLang } from '../../lib/i18n';
import Cover from '../ui/Cover';
import Sparkline from '../ui/Sparkline';
import Delta from '../ui/Delta';
import Stamp from '../ui/Stamp';

const GRID =
  'grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-x-4 md:grid-cols-[56px_minmax(0,1fr)_96px_150px_80px_84px]';

export function ClaimTableHead() {
  const { t } = useLang();
  return (
    <div className={`${GRID} eyebrow hidden border-b border-ink pb-2 md:grid`}>
      <span />
      <span>{t('list.colSong')}</span>
      <span>{t('list.colPicked')}</span>
      <span className="text-right">{t('list.colNumbers')}</span>
      <span className="text-center">{t('list.colTrend')}</span>
      <span className="text-right">{t('list.colChange')}</span>
    </div>
  );
}

function StatusMark({ claim, stale }: { claim: Claim; stale: boolean }) {
  const { t } = useLang();
  if (claim.status === 'hit') return <Stamp />;
  if (claim.status === 'dropped') return <span className="eyebrow">{t('status.dropped')}</span>;
  if (stale) return <span className="up text-[11px] font-medium">{t('list.due')}</span>;
  return null;
}

export default function ClaimRow({ claim, staleDays }: { claim: Claim; staleDays: number }) {
  const { t, lang } = useLang();
  const h = headline(claim);
  const m = baseMetric(claim);
  const series = m ? claim.snapshots.flatMap(s => (s.values[m] != null ? [s.values[m]!] : [])) : [];
  const stale = isStale(claim, staleDays);

  return (
    <li className={`border-b border-rule ${claim.status === 'dropped' ? 'opacity-55' : ''}`}>
      <Link to={`/p/${claim.id}`} className={`${GRID} -mx-2 px-2 py-3 transition-colors hover:bg-sunk/70`}>
        <Cover claim={claim} className="h-12 w-12 rounded-sm text-sm md:h-14 md:w-14" />

        <div className="min-w-0">
          <p className="truncate font-medium leading-snug">{claim.track}</p>
          <p className="truncate text-sm text-ink-2">{claim.artist}</p>
          <p className="num mt-0.5 truncate text-[12px] text-ink-3 md:hidden">
            {fmtDate(claim.claimedAt)} · {dPlus(claim.claimedAt)}
            {h && ` · ${t(`metric.${h.metric}`)} ${fmtCompact(h.latest, lang)}`}
          </p>
        </div>

        <div className="num hidden text-[13px] leading-5 md:block">
          <p>{fmtDate(claim.claimedAt)}</p>
          <p className="text-ink-3">{dPlus(claim.claimedAt)}</p>
        </div>

        <div className="num hidden text-right text-[13px] leading-5 md:block">
          {h ? (
            <>
              <p className="text-ink-3">
                {fmtCompact(h.entry, lang)} → <span className="text-ink">{fmtCompact(h.latest, lang)}</span>
              </p>
              <p className="font-sans text-[12px] text-ink-3">{t(`metric.${h.metric}`)}</p>
            </>
          ) : (
            <span className="text-ink-3">—</span>
          )}
        </div>

        <div className="hidden justify-center md:flex">
          <Sparkline values={series} />
        </div>

        <div className="flex flex-col items-end gap-1.5">
          {h?.mult != null ? (
            <Delta mult={h.mult} className="text-[15px] font-medium" />
          ) : (
            <span className="num text-[13px] text-ink-3">{t('list.noCheckin')}</span>
          )}
          <StatusMark claim={claim} stale={stale} />
        </div>
      </Link>
    </li>
  );
}
