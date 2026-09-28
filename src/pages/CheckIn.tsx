import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import type { Claim, MetricKey, Metrics } from '../types';
import { useVault } from '../store/vaultStore';
import { toast } from '../store/toastStore';
import { useLang } from '../lib/i18n';
import { fmtAgo, fmtMult, parseAmount } from '../lib/format';
import { headline, isStale, lastUpdateAt, latestPoint, trackedMetrics } from '../lib/metrics';
import { parseYouTubeId, youtubeWatchUrl } from '../lib/youtube';
import Cover from '../components/ui/Cover';
import AmountInput from '../components/ui/AmountInput';
import Delta from '../components/ui/Delta';
import Stamp from '../components/ui/Stamp';

type RowValues = Partial<Record<MetricKey, string>>;

function parseRow(values: RowValues | undefined): { parsed: Metrics; invalid: boolean; filled: boolean } {
  const parsed: Metrics = {};
  let invalid = false;
  let filled = false;
  for (const [m, raw] of Object.entries(values ?? {}) as [MetricKey, string][]) {
    if (!raw.trim()) continue;
    filled = true;
    const v = parseAmount(raw);
    if (v == null) invalid = true;
    else parsed[m] = v;
  }
  return { parsed, invalid, filled };
}

export default function CheckIn() {
  const { t } = useLang();
  const claims = useVault(s => s.claims);
  const settings = useVault(s => s.settings);
  const addSnapshot = useVault(s => s.addSnapshot);

  const dueCount = claims.filter(c => isStale(c, settings.staleDays)).length;
  const [scope, setScope] = useState<'due' | 'all'>(() => (dueCount > 0 ? 'due' : 'all'));
  const [values, setValues] = useState<Record<string, RowValues>>({});
  // Rows saved during this visit stay on screen (with their result) even once they're no longer due.
  const [saved, setSaved] = useState<Record<string, true>>({});

  const rows = claims
    .filter(c => saved[c.id] || (c.status === 'watching' && (scope === 'all' || isStale(c, settings.staleDays))))
    .sort((a, b) => lastUpdateAt(a).localeCompare(lastUpdateAt(b)));
  const watchingCount = claims.filter(c => c.status === 'watching').length;

  const pending = rows.filter(c => {
    const r = parseRow(values[c.id]);
    return r.filled && !r.invalid;
  });

  const saveRow = (c: Claim) => {
    const { parsed, invalid, filled } = parseRow(values[c.id]);
    if (!filled || invalid) return false;
    const { newlyHit } = addSnapshot(c.id, { at: new Date().toISOString(), values: parsed });
    setValues(v => ({ ...v, [c.id]: {} }));
    setSaved(s => ({ ...s, [c.id]: true }));
    if (newlyHit) {
      const updated = useVault.getState().claims.find(x => x.id === c.id);
      toast({
        kind: 'hit',
        title: t('toast.hit', { track: c.track }),
        body: updated?.hitReason === 'target' ? t('toast.hitTarget') : t('toast.hitGrowth', { mult: fmtMult(settings.hitMultiplier) }),
      });
    }
    return true;
  };

  const saveAll = () => {
    const n = pending.filter(saveRow).length;
    if (n > 1) toast({ kind: 'info', title: t('checkin.savedMany', { count: n }) });
  };

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold">{t('checkin.title')}</h1>
      <p className="mt-2 text-sm text-ink-2">{t('checkin.lead')}</p>

      <div role="tablist" className="seg mt-6">
        <button role="tab" aria-selected={scope === 'due'} onClick={() => setScope('due')}>
          {t('checkin.due', { days: settings.staleDays })} <span className="num text-[12px] text-ink-3">{dueCount}</span>
        </button>
        <button role="tab" aria-selected={scope === 'all'} onClick={() => setScope('all')}>
          {t('checkin.all')} <span className="num text-[12px] text-ink-3">{watchingCount}</span>
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="py-16 text-center">
          {watchingCount === 0 ? (
            <>
              <p className="text-ink-2">{t('checkin.emptyNone')}</p>
              <Link to="/new" className="btn btn-line mt-5">
                {t('nav.new')}
              </Link>
            </>
          ) : (
            <>
              <p className="text-ink-2">{t('checkin.emptyDue', { days: settings.staleDays })}</p>
              <button className="btn btn-line mt-5" onClick={() => setScope('all')}>
                {t('checkin.showAll')}
              </button>
            </>
          )}
        </div>
      ) : (
        <ul>
          {rows.map(c => (
            <Row
              key={c.id}
              claim={c}
              values={values[c.id] ?? {}}
              saved={!!saved[c.id]}
              stale={isStale(c, settings.staleDays)}
              onChange={v => setValues(prev => ({ ...prev, [c.id]: v }))}
              onSave={() => saveRow(c)}
              onReopen={() =>
                setSaved(s => {
                  const next = { ...s };
                  delete next[c.id];
                  return next;
                })
              }
            />
          ))}
        </ul>
      )}

      {pending.length > 1 && (
        <div className="sticky bottom-[calc(60px+env(safe-area-inset-bottom))] z-10 -mx-4 mt-4 flex items-center justify-between gap-3 border-t border-ink bg-paper/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 md:bottom-0">
          <p className="text-sm">{t('checkin.pending', { count: pending.length })}</p>
          <button className="btn btn-primary" onClick={saveAll}>
            {t('checkin.saveAll')}
          </button>
        </div>
      )}
    </div>
  );
}

function Row({
  claim,
  values,
  saved,
  stale,
  onChange,
  onSave,
  onReopen,
}: {
  claim: Claim;
  values: RowValues;
  saved: boolean;
  stale: boolean;
  onChange: (v: RowValues) => void;
  onSave: () => void;
  onReopen: () => void;
}) {
  const { t, lang } = useLang();
  const tracked = trackedMetrics(claim);
  const videoId = parseYouTubeId(claim.youtubeUrl);
  const { filled, invalid } = parseRow(values);
  const h = headline(claim);

  return (
    <li className="border-b border-rule py-5">
      <div className="flex items-center gap-3">
        <Cover claim={claim} className="h-11 w-11 shrink-0 rounded-sm text-xs" />
        <div className="min-w-0 flex-1">
          <Link to={`/p/${claim.id}`} className="block truncate font-medium hover:underline">
            {claim.track}
          </Link>
          <p className="truncate text-sm text-ink-2">{claim.artist}</p>
        </div>
        <div className="shrink-0 text-right text-[12px] leading-5">
          <p className={stale && !saved ? 'up' : 'text-ink-3'}>{fmtAgo(lastUpdateAt(claim), lang)}</p>
          {(videoId || claim.link) && (
            <a
              href={videoId ? youtubeWatchUrl(videoId) : claim.link}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-ink-3 hover:text-ink"
            >
              {videoId ? 'YouTube' : t('detail.link')}
              <ExternalLink size={11} />
            </a>
          )}
        </div>
      </div>

      {saved ? (
        <div className="mt-3 flex items-center gap-3 pl-14 text-sm">
          <span className="text-ink-2">{t('checkin.saved')}</span>
          {h?.mult != null && <Delta mult={h.mult} className="font-medium" />}
          {claim.status === 'hit' && <Stamp animate />}
          <button onClick={onReopen} className="ml-auto text-[13px] text-ink-3 hover:text-ink">
            {t('checkin.again')}
          </button>
        </div>
      ) : (
        <form
          className="mt-3 flex flex-wrap items-end gap-x-3"
          onSubmit={e => {
            e.preventDefault();
            onSave();
          }}
        >
          {tracked.map(m => {
            const last = latestPoint(claim, m);
            return (
              <div key={m} className="w-[calc(50%-0.375rem)] sm:w-44">
                <label htmlFor={`${claim.id}-${m}`} className="mb-1 block text-[12px] text-ink-3">
                  {t(`metric.${m}`)}
                </label>
                <AmountInput
                  id={`${claim.id}-${m}`}
                  value={values[m] ?? ''}
                  onChange={v => onChange({ ...values, [m]: v })}
                  placeholder={last?.value.toLocaleString('en-US')}
                  compareTo={last?.value}
                />
              </div>
            );
          })}
          {/* mb matches the reading line under each field so the button lines up with the inputs */}
          <button type="submit" className="btn btn-line h-10 w-full sm:mb-[1.35rem] sm:w-auto" disabled={!filled || invalid}>
            {t('checkin.save')}
          </button>
        </form>
      )}
    </li>
  );
}
