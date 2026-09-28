import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, X } from 'lucide-react';
import { METRIC_KEYS } from '../types';
import type { Claim, MetricKey, Metrics } from '../types';
import { useVault } from '../store/vaultStore';
import { toast } from '../store/toastStore';
import { useLang } from '../lib/i18n';
import {
  daysSince,
  dPlus,
  fmtAgo,
  fmtDate,
  fmtDateTime,
  fmtFull,
  fmtMult,
  fmtShortDate,
  fromLocalDateInput,
  parseAmount,
  toLocalDateInput,
} from '../lib/format';
import { baseMetric, entryValue, growthOf, headline, isStale, latestPoint, trackedMetrics } from '../lib/metrics';
import { parseYouTubeId, youtubeWatchUrl } from '../lib/youtube';
import Cover from '../components/ui/Cover';
import Delta from '../components/ui/Delta';
import Stamp from '../components/ui/Stamp';
import AmountInput from '../components/ui/AmountInput';
import ClaimChart from '../components/claims/ClaimChart';
import ShareDialog from '../components/claims/ShareDialog';
import NotFound from './NotFound';

export default function ClaimDetail() {
  const { id } = useParams();
  const claim = useVault(s => s.claims.find(c => c.id === id));
  if (!claim) return <NotFound />;
  return <Detail key={claim.id} claim={claim} />;
}

function SectionHead({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4 border-b border-ink pb-2">
      <h2 className="font-semibold">{title}</h2>
      {children}
    </div>
  );
}

function Detail({ claim }: { claim: Claim }) {
  const { t, lang } = useLang();
  const navigate = useNavigate();
  const settings = useVault(s => s.settings);
  const number = useVault(s => s.claims.filter(c => c.claimedAt <= claim.claimedAt).length);
  const removeClaim = useVault(s => s.removeClaim);
  const restoreClaim = useVault(s => s.restoreClaim);

  const [sharing, setSharing] = useState(false);
  const [justHit, setJustHit] = useState(false);
  const firstInput = useRef<HTMLInputElement>(null);

  const tracked = trackedMetrics(claim);
  const base = baseMetric(claim);
  const h = headline(claim);
  const [chartPick, setChartPick] = useState<MetricKey | undefined>(base);
  const chartMetric = chartPick && tracked.includes(chartPick) ? chartPick : tracked[0];
  const videoId = parseYouTubeId(claim.youtubeUrl);

  const focusCheckin = () => {
    document.getElementById('log')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => firstInput.current?.focus({ preventScroll: true }), 350);
  };

  const onDelete = () => {
    const removed = removeClaim(claim.id);
    navigate('/', { replace: true });
    if (removed) {
      toast({
        kind: 'info',
        title: t('toast.deleted', { track: removed.track }),
        action: { label: t('common.undo'), run: () => restoreClaim(removed) },
      });
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink">
        <ArrowLeft size={15} />
        {t('nav.list')}
      </Link>

      <header className="mt-5 grid gap-6 md:grid-cols-[300px_minmax(0,1fr)] md:gap-10">
        <Cover claim={claim} large className="aspect-video w-full rounded-sm text-3xl" />
        <div className="min-w-0">
          <p className="num text-[12px] text-ink-3">
            № {String(number).padStart(3, '0')} · {fmtDateTime(claim.claimedAt)} · {dPlus(claim.claimedAt)}
          </p>
          <h1 className="mt-2 text-[28px] font-semibold leading-tight md:text-4xl">{claim.track}</h1>
          <p className="mt-1 text-lg text-ink-2">{claim.artist}</p>
          {claim.tags.length > 0 && (
            <p className="mt-3 flex flex-wrap gap-1.5">
              {claim.tags.map(tag => (
                <Link
                  key={tag}
                  to={`/?q=${encodeURIComponent(tag)}`}
                  className="rounded-sm bg-sunk px-2 py-0.5 text-[12px] text-ink-2 hover:text-ink"
                >
                  {tag}
                </Link>
              ))}
            </p>
          )}

          <StatusLine claim={claim} animate={justHit} />

          <div className="mt-5 flex flex-wrap gap-2">
            {claim.status !== 'dropped' && (
              <button className="btn btn-primary" onClick={focusCheckin}>
                {t('detail.addNumbers')}
              </button>
            )}
            <button className="btn btn-line" onClick={() => setSharing(true)}>
              {t('detail.share')}
            </button>
            <Link className="btn btn-quiet" to={`/p/${claim.id}/edit`}>
              {t('common.edit')}
            </Link>
            {videoId && (
              <a className="btn btn-quiet" href={youtubeWatchUrl(videoId)} target="_blank" rel="noreferrer">
                YouTube <ExternalLink size={13} />
              </a>
            )}
            {claim.link && (
              <a className="btn btn-quiet" href={claim.link} target="_blank" rel="noreferrer">
                {t('detail.link')} <ExternalLink size={13} />
              </a>
            )}
          </div>
        </div>
      </header>

      <section className="mt-12">
        <SectionHead title={t('detail.numbers')} />
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_230px] md:gap-8">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[300px] text-sm">
              <thead>
                <tr className="eyebrow">
                  <th className="py-2.5 text-left font-normal">{t('detail.colMetric')}</th>
                  <th className="py-2.5 text-right font-normal">{t('detail.colEntry')}</th>
                  <th className="py-2.5 text-right font-normal">{t('detail.colLatest')}</th>
                  <th className="py-2.5 text-right font-normal">{t('detail.colChange')}</th>
                </tr>
              </thead>
              <tbody>
                {tracked.map(m => {
                  const g = growthOf(claim, m)!;
                  return (
                    <tr key={m} className="border-t border-rule">
                      <td className="py-3">
                        {t(`metric.${m}`)}
                        {m === base && (
                          <span className="ml-2 rounded-sm border border-rule px-1 py-px text-[11px] text-ink-3">{t('form.base')}</span>
                        )}
                      </td>
                      <td className="num py-3 text-right text-ink-2">{fmtFull(g.entry, lang)}</td>
                      <td className="num py-3 text-right">
                        {fmtFull(g.latest, lang)}
                        <span className="block text-[11px] text-ink-3">{fmtShortDate(g.latestAt)}</span>
                      </td>
                      <td className="py-3 text-right">
                        <Delta mult={g.mult} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="border-t border-rule pt-4 md:border-l md:border-t-0 md:pl-8 md:pt-3">
            <p className="eyebrow">{h ? `${t('detail.growth')} · ${t(`metric.${h.metric}`)}` : t('detail.growth')}</p>
            {h?.mult != null ? (
              <>
                <p className="mt-2 text-5xl font-semibold leading-none">
                  <Delta mult={h.mult} as="mult" />
                </p>
                <p className="mt-2 text-sm">
                  <Delta mult={h.mult} />
                </p>
              </>
            ) : (
              <>
                <p className="num mt-2 text-5xl font-semibold leading-none text-ink-3">—</p>
                <p className="mt-2 text-[13px] text-ink-3">{t('detail.noGrowthYet')}</p>
              </>
            )}
            <p className="mt-4 text-[12px] leading-snug text-ink-3">
              {t('detail.hitRule', { mult: fmtMult(settings.hitMultiplier) })}{' '}
              <Link to="/settings" className="underline underline-offset-2 hover:text-ink">
                {t('nav.settings')}
              </Link>
            </p>
          </div>
        </div>
        {claim.target && <TargetProgress claim={claim} />}
      </section>

      {chartMetric && (
        <section className="mt-12">
          <SectionHead title={t('detail.chart')}>
            {tracked.length > 1 && (
              <div role="tablist" className="flex gap-4 text-sm">
                {tracked.map(m => (
                  <button
                    key={m}
                    role="tab"
                    aria-selected={m === chartMetric}
                    onClick={() => setChartPick(m)}
                    className={m === chartMetric ? 'font-medium text-ink' : 'text-ink-3 hover:text-ink'}
                  >
                    {t(`metric.${m}`)}
                  </button>
                ))}
              </div>
            )}
          </SectionHead>
          <div className="pt-5">
            <ClaimChart claim={claim} metric={chartMetric} hitMultiplier={settings.hitMultiplier} />
          </div>
          {claim.snapshots.length < 2 && <p className="mt-2 text-[13px] text-ink-3">{t('detail.chartEmpty')}</p>}
        </section>
      )}

      <section className="mt-12">
        <SectionHead title={t('detail.why')} />
        {claim.note ? (
          <blockquote className="mt-5 whitespace-pre-wrap border-l-2 border-accent pl-4 text-[15px] leading-relaxed">
            {claim.note}
          </blockquote>
        ) : (
          <p className="mt-5 text-sm text-ink-3">
            {t('detail.noNote')}{' '}
            <Link to={`/p/${claim.id}/edit`} className="underline underline-offset-2 hover:text-ink">
              {t('common.edit')}
            </Link>
          </p>
        )}
      </section>

      <section id="log" className="mt-12 scroll-mt-6">
        <SectionHead title={t('detail.log')}>
          <span className="num text-[12px] text-ink-3">{t('detail.checkinCount', { count: claim.snapshots.length - 1 })}</span>
        </SectionHead>
        {claim.status !== 'dropped' && <CheckinForm claim={claim} inputRef={firstInput} onHit={() => setJustHit(true)} />}
        <SnapshotTable claim={claim} />
      </section>

      <Manage claim={claim} onDelete={onDelete} />

      {sharing && <ShareDialog claim={claim} onClose={() => setSharing(false)} />}
    </div>
  );
}

function StatusLine({ claim, animate }: { claim: Claim; animate: boolean }) {
  const { t, lang } = useLang();
  const settings = useVault(s => s.settings);

  if (claim.status === 'hit' && claim.hitAt) {
    const days = daysSince(claim.claimedAt, Date.parse(claim.hitAt));
    const reason =
      claim.hitReason === 'growth'
        ? t('detail.hitByGrowth', { mult: fmtMult(settings.hitMultiplier) })
        : claim.hitReason === 'target'
          ? t('detail.hitByTarget')
          : t('detail.hitManual');
    return (
      <div className="mt-5 flex items-center gap-5">
        <Stamp size="md" animate={animate} />
        <p className="text-sm text-ink-2">
          {t('detail.hitOn', { date: fmtDate(claim.hitAt), days })} · {reason}
          {claim.statusNote && <span className="block text-ink-3">“{claim.statusNote}”</span>}
        </p>
      </div>
    );
  }
  if (claim.status === 'dropped') {
    return (
      <p className="mt-5 text-sm text-ink-3">
        {t('status.dropped')}
        {claim.statusNote && ` · “${claim.statusNote}”`}
      </p>
    );
  }
  const last = claim.snapshots[claim.snapshots.length - 1].at;
  const stale = isStale(claim, settings.staleDays);
  return (
    <p className="mt-5 text-sm text-ink-2">
      {t('status.watching')} ·{' '}
      <span className={stale ? 'up' : ''}>
        {claim.snapshots.length > 1 ? t('detail.lastCheckin', { ago: fmtAgo(last, lang) }) : t('detail.noCheckinYet')}
      </span>
    </p>
  );
}

function TargetProgress({ claim }: { claim: Claim }) {
  const { t, lang } = useLang();
  const target = claim.target!;
  const current = latestPoint(claim, target.metric)?.value;
  const start = entryValue(claim, target.metric) ?? 0;
  const ratio = current == null ? 0 : Math.max(0, Math.min(1, (current - start) / (target.value - start || 1)));
  const reached = current != null && current >= target.value;
  return (
    <div className="mt-6 border border-rule px-4 py-3">
      <div className="flex items-baseline justify-between gap-4 text-sm">
        <span>
          <span className="eyebrow mr-2">{t('detail.target')}</span>
          {t(`metric.${target.metric}`)} <span className="num">{fmtFull(target.value, lang)}</span>
        </span>
        <span className={`num ${reached ? 'up font-medium' : 'text-ink-2'}`}>
          {reached ? t('detail.targetReached') : `${Math.round(ratio * 100)}%`}
        </span>
      </div>
      <div className="mt-2.5 h-[3px] bg-rule">
        <div className="h-full bg-accent" style={{ width: `${ratio * 100}%` }} />
      </div>
    </div>
  );
}

function CheckinForm({
  claim,
  inputRef,
  onHit,
}: {
  claim: Claim;
  inputRef: React.Ref<HTMLInputElement>;
  onHit: () => void;
}) {
  const { t } = useLang();
  const addSnapshot = useVault(s => s.addSnapshot);
  const settings = useVault(s => s.settings);
  const tracked = trackedMetrics(claim);
  const [showAll, setShowAll] = useState(false);
  const metrics = showAll ? METRIC_KEYS : tracked;
  const today = toLocalDateInput(new Date().toISOString());
  const [date, setDate] = useState(today);
  const [values, setValues] = useState<Record<MetricKey, string>>({ views: '', streams: '', listeners: '' });
  const [memo, setMemo] = useState('');

  const parsed: Metrics = {};
  let invalid = false;
  for (const m of METRIC_KEYS) {
    if (!values[m].trim()) continue;
    const v = parseAmount(values[m]);
    if (v == null) invalid = true;
    else parsed[m] = v;
  }
  const ready = !invalid && Object.keys(parsed).length > 0 && !!date;

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const at = fromLocalDateInput(date);
    if (!ready || !at) return;
    const { newlyHit } = addSnapshot(claim.id, { at, values: parsed, memo });
    setValues({ views: '', streams: '', listeners: '' });
    setMemo('');
    setDate(today);
    if (newlyHit) {
      onHit();
      const updated = useVault.getState().claims.find(c => c.id === claim.id);
      toast({
        kind: 'hit',
        title: t('toast.hit', { track: claim.track }),
        body: updated?.hitReason === 'target' ? t('toast.hitTarget') : t('toast.hitGrowth', { mult: fmtMult(settings.hitMultiplier) }),
      });
    }
  };

  return (
    <form onSubmit={save} className="mt-5 border border-rule p-4">
      <div className="grid gap-x-4 gap-y-1 sm:grid-cols-3">
        {metrics.map((m, i) => {
          const last = latestPoint(claim, m);
          return (
            <div key={m}>
              <label htmlFor={`ci-${m}`} className="label">
                {t(`metric.${m}`)}
              </label>
              <AmountInput
                ref={i === 0 ? inputRef : undefined}
                id={`ci-${m}`}
                value={values[m]}
                onChange={v => setValues(prev => ({ ...prev, [m]: v }))}
                placeholder={last ? last.value.toLocaleString('en-US') : t('detail.newMetric')}
                compareTo={last?.value}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1 grid gap-3 sm:grid-cols-[10.5rem_minmax(0,1fr)_auto] sm:items-end">
        <div>
          <label htmlFor="ci-date" className="label">
            {t('detail.date')}
          </label>
          <input
            id="ci-date"
            type="date"
            value={date}
            min={toLocalDateInput(claim.claimedAt)}
            max={today}
            onChange={e => setDate(e.target.value)}
            className="field num"
          />
        </div>
        <div>
          <label htmlFor="ci-memo" className="label">
            {t('detail.memo')}
          </label>
          <input
            id="ci-memo"
            value={memo}
            onChange={e => setMemo(e.target.value)}
            placeholder={t('detail.memoPlaceholder')}
            className="field"
          />
        </div>
        <button type="submit" className="btn btn-primary h-10" disabled={!ready}>
          {t('detail.record')}
        </button>
      </div>
      {tracked.length < METRIC_KEYS.length && (
        <button type="button" onClick={() => setShowAll(v => !v)} className="mt-3 text-[13px] text-ink-3 hover:text-ink">
          {showAll ? t('detail.fewerMetrics') : t('detail.moreMetrics')}
        </button>
      )}
    </form>
  );
}

function SnapshotTable({ claim }: { claim: Claim }) {
  const { t, lang } = useLang();
  const removeSnapshot = useVault(s => s.removeSnapshot);
  const addSnapshot = useVault(s => s.addSnapshot);
  const tracked = trackedMetrics(claim);
  const rows = [...claim.snapshots].reverse();

  const remove = (id: string) => {
    const snap = claim.snapshots.find(s => s.id === id);
    if (!snap) return;
    removeSnapshot(claim.id, id);
    toast({
      kind: 'info',
      title: t('toast.snapshotDeleted', { date: fmtDate(snap.at) }),
      action: { label: t('common.undo'), run: () => addSnapshot(claim.id, { at: snap.at, values: snap.values, memo: snap.memo }) },
    });
  };

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[300px] text-sm">
        <thead>
          <tr className="eyebrow">
            <th className="py-2 text-left font-normal">{t('detail.date')}</th>
            {tracked.map(m => (
              <th key={m} className="py-2 text-right font-normal">
                {t(`metric.${m}`)}
              </th>
            ))}
            <th className="hidden py-2 pl-6 text-left font-normal sm:table-cell">{t('detail.memo')}</th>
            <th className="w-8" />
          </tr>
        </thead>
        <tbody>
          {rows.map(s => {
            const isEntry = s.id === claim.snapshots[0].id;
            return (
              <tr key={s.id} className="border-t border-rule">
                <td className="num py-2.5 text-[13px]">
                  {fmtDate(s.at)}
                  {isEntry && <span className="ml-2 font-sans text-[11px] text-accent">{t('detail.entryPoint')}</span>}
                  {s.memo && <span className="mt-0.5 block font-sans text-[12px] text-ink-3 sm:hidden">{s.memo}</span>}
                </td>
                {tracked.map(m => (
                  <td key={m} className="num py-2.5 text-right text-[13px]">
                    {s.values[m] != null ? fmtFull(s.values[m], lang) : <span className="text-ink-3">·</span>}
                  </td>
                ))}
                <td className="hidden max-w-[16rem] truncate py-2.5 pl-6 text-[13px] text-ink-2 sm:table-cell" title={s.memo}>
                  {s.memo}
                </td>
                <td className="py-2.5 text-right">
                  {!isEntry && (
                    <button
                      onClick={() => remove(s.id)}
                      className="grid h-7 w-7 place-items-center text-ink-3 hover:text-accent"
                      aria-label={t('detail.deleteSnapshot', { date: fmtDate(s.at) })}
                    >
                      <X size={14} />
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Manage({ claim, onDelete }: { claim: Claim; onDelete: () => void }) {
  const { t } = useLang();
  const setStatus = useVault(s => s.setStatus);
  const [pending, setPending] = useState<'hit' | 'dropped' | null>(null);
  const [note, setNote] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const apply = (status: Claim['status']) => {
    setStatus(claim.id, status, note);
    setPending(null);
    setNote('');
  };

  return (
    <section className="mt-16 border-t border-ink pt-5">
      <h2 className="eyebrow">{t('detail.manage')}</h2>

      {pending ? (
        <form
          className="mt-3 flex flex-col gap-2 sm:flex-row"
          onSubmit={e => {
            e.preventDefault();
            apply(pending);
          }}
        >
          <input
            autoFocus
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder={pending === 'hit' ? t('detail.hitNotePlaceholder') : t('detail.dropNotePlaceholder')}
            className="field flex-1"
          />
          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary">
              {pending === 'hit' ? t('detail.markHit') : t('detail.drop')}
            </button>
            <button type="button" className="btn btn-quiet" onClick={() => setPending(null)}>
              {t('common.cancel')}
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {claim.status === 'watching' && (
            <>
              <button className="btn btn-line btn-sm" onClick={() => setPending('hit')}>
                {t('detail.markHit')}
              </button>
              <button className="btn btn-quiet btn-sm" onClick={() => setPending('dropped')}>
                {t('detail.drop')}
              </button>
            </>
          )}
          {claim.status === 'hit' &&
            (claim.hitReason === 'manual' ? (
              <button className="btn btn-quiet btn-sm" onClick={() => apply('watching')}>
                {t('detail.unmarkHit')}
              </button>
            ) : (
              <p className="text-[13px] text-ink-3">{t('detail.autoHitNote')}</p>
            ))}
          {claim.status === 'dropped' && (
            <button className="btn btn-line btn-sm" onClick={() => apply('watching')}>
              {t('detail.resume')}
            </button>
          )}
          <span className="ml-auto flex items-center gap-2">
            {confirmDelete ? (
              <>
                <span className="text-[13px] text-ink-2">{t('detail.deleteConfirm')}</span>
                <button className="btn btn-danger btn-sm" onClick={onDelete}>
                  {t('common.delete')}
                </button>
                <button className="btn btn-quiet btn-sm" onClick={() => setConfirmDelete(false)}>
                  {t('common.cancel')}
                </button>
              </>
            ) : (
              <button className="btn btn-quiet btn-sm hover:text-accent" onClick={() => setConfirmDelete(true)}>
                {t('common.delete')}
              </button>
            )}
          </span>
        </div>
      )}
    </section>
  );
}
