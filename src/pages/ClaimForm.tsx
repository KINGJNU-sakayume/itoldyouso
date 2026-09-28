import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { METRIC_KEYS } from '../types';
import type { Claim, ClaimDraft, MetricKey, Metrics, Target } from '../types';
import { useVault } from '../store/vaultStore';
import { toast } from '../store/toastStore';
import { useLang } from '../lib/i18n';
import { fmtDate, fromLocalInput, parseAmount, toLocalInput } from '../lib/format';
import { isSameMonth } from '../lib/metrics';
import { parseYouTubeId, youtubeThumb, youtubeWatchUrl } from '../lib/youtube';
import AmountInput from '../components/ui/AmountInput';
import TagInput from '../components/ui/TagInput';
import NotFound from './NotFound';

type Amounts = Record<MetricKey, string>;

interface FormState {
  artist: string;
  track: string;
  youtubeUrl: string;
  link: string;
  imageUrl: string;
  tags: string[];
  note: string;
  primary: MetricKey;
  amounts: Amounts;
  targetMetric: MetricKey;
  targetText: string;
  claimedAt: string;
}

type Errors = Partial<Record<'artist' | 'track' | 'amounts' | 'youtubeUrl' | 'link' | 'imageUrl' | 'target' | 'claimedAt' | 'limit' | MetricKey, string>>;

const URL_RE = /^https?:\/\/\S+$/i;
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

function initialState(existing: Claim | undefined): FormState {
  const entry = existing?.snapshots[0]?.values ?? {};
  return {
    artist: existing?.artist ?? '',
    track: existing?.track ?? '',
    youtubeUrl: existing?.youtubeUrl ?? '',
    link: existing?.link ?? '',
    imageUrl: existing?.imageUrl ?? '',
    tags: existing?.tags ?? [],
    note: existing?.note ?? '',
    primary: existing?.primary ?? 'views',
    amounts: Object.fromEntries(
      METRIC_KEYS.map(m => [m, entry[m] != null ? entry[m]!.toLocaleString('en-US') : '']),
    ) as Amounts,
    targetMetric: existing?.target?.metric ?? existing?.primary ?? 'views',
    targetText: existing?.target ? existing.target.value.toLocaleString('en-US') : '',
    claimedAt: toLocalInput(existing?.claimedAt ?? new Date().toISOString()),
  };
}

function Section({ n, title, hint, children }: { n: string; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4 border-t border-rule py-7 md:grid-cols-[190px_minmax(0,1fr)] md:gap-10">
      <div>
        <p className="num text-[12px] text-ink-3">{n}</p>
        <h2 className="mt-1 font-semibold">{title}</h2>
        {hint && <p className="mt-1.5 text-[13px] leading-snug text-ink-3">{hint}</p>}
      </div>
      <div className="min-w-0 space-y-5">{children}</div>
    </section>
  );
}

function FieldError({ msg }: { msg?: string }) {
  return msg ? <p className="up mt-1.5 text-[13px]">{msg}</p> : null;
}

export default function ClaimForm() {
  const { id } = useParams();
  const existing = useVault(s => (id ? s.claims.find(c => c.id === id) : undefined));
  if (id && !existing) return <NotFound />;
  return <Form key={id ?? 'new'} existing={existing} />;
}

function Form({ existing }: { existing?: Claim }) {
  const { t } = useLang();
  const navigate = useNavigate();
  const claims = useVault(s => s.claims);
  const settings = useVault(s => s.settings);
  const addClaim = useVault(s => s.addClaim);
  const updateClaim = useVault(s => s.updateClaim);

  const [s, setS] = useState<FormState>(() => initialState(existing));
  const [submitted, setSubmitted] = useState(false);
  // Until the user edits it, a new pick is stamped with the moment it is saved.
  const [timeTouched, setTimeTouched] = useState(!!existing);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setS(prev => ({ ...prev, [key]: value }));

  const tagSuggestions = useMemo(() => {
    const freq = new Map<string, number>();
    claims.forEach(c => c.tags.forEach(tag => freq.set(tag, (freq.get(tag) ?? 0) + 1)));
    return [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([tag]) => tag);
  }, [claims]);

  const entry: Metrics = {};
  for (const m of METRIC_KEYS) {
    const v = parseAmount(s.amounts[m]);
    if (v != null) entry[m] = v;
  }
  const primary: MetricKey = entry[s.primary] != null ? s.primary : (METRIC_KEYS.find(m => entry[m] != null) ?? s.primary);

  const duplicate =
    !existing && s.artist.trim() && s.track.trim()
      ? claims.find(c => norm(c.artist) === norm(s.artist) && norm(c.track) === norm(s.track))
      : undefined;

  const monthFull =
    !existing && settings.monthlyLimit > 0 && claims.filter(c => isSameMonth(c.claimedAt, new Date())).length >= settings.monthlyLimit;

  function validate(): { errors: Errors; draft: ClaimDraft | null } {
    const errors: Errors = {};
    if (!s.artist.trim()) errors.artist = t('form.errRequired');
    if (!s.track.trim()) errors.track = t('form.errRequired');

    for (const m of METRIC_KEYS) {
      if (s.amounts[m].trim() && entry[m] == null) errors[m] = t('form.amountInvalid');
    }
    if (!Object.keys(entry).length && !METRIC_KEYS.some(m => errors[m])) errors.amounts = t('form.errNoAmount');

    if (s.youtubeUrl.trim() && !parseYouTubeId(s.youtubeUrl)) errors.youtubeUrl = t('form.errYoutube');
    if (s.link.trim() && !URL_RE.test(s.link.trim())) errors.link = t('form.errUrl');
    if (s.imageUrl.trim() && !URL_RE.test(s.imageUrl.trim())) errors.imageUrl = t('form.errUrl');

    let target: Target | undefined;
    if (s.targetText.trim()) {
      const v = parseAmount(s.targetText);
      const base = entry[s.targetMetric];
      if (v == null) errors.target = t('form.amountInvalid');
      else if (base != null && v <= base) errors.target = t('form.errTargetLow');
      else target = { metric: s.targetMetric, value: v };
    }

    const claimedAt = timeTouched ? fromLocalInput(s.claimedAt) : new Date().toISOString();
    if (!claimedAt) errors.claimedAt = t('form.errDate');
    else if (Date.parse(claimedAt) > Date.now() + 5 * 60_000) errors.claimedAt = t('form.errFuture');
    else if (existing?.snapshots[1] && claimedAt > existing.snapshots[1].at) {
      errors.claimedAt = t('form.errAfterCheckin', { date: fmtDate(existing.snapshots[1].at) });
    }

    if (!existing && claimedAt && settings.monthlyLimit > 0) {
      const month = new Date(claimedAt);
      if (claims.filter(c => isSameMonth(c.claimedAt, month)).length >= settings.monthlyLimit) {
        errors.limit = t('form.errLimit', { limit: settings.monthlyLimit });
      }
    }

    if (Object.keys(errors).length || !claimedAt) return { errors, draft: null };
    return {
      errors,
      draft: {
        artist: s.artist,
        track: s.track,
        youtubeUrl: s.youtubeUrl,
        link: s.link,
        imageUrl: s.imageUrl,
        tags: s.tags,
        note: s.note,
        primary,
        target,
        claimedAt,
        entry,
      },
    };
  }

  const { errors } = submitted ? validate() : { errors: {} as Errors };

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    setSubmitted(true);
    const { draft } = validate();
    if (!draft) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"], [data-error]')?.focus());
      return;
    }
    if (existing) {
      updateClaim(existing.id, draft);
      navigate(`/p/${existing.id}`, { replace: true });
    } else {
      const claim = addClaim(draft);
      toast({ kind: 'info', title: t('toast.picked', { track: claim.track }) });
      navigate(`/p/${claim.id}`, { replace: true });
    }
  };

  const videoId = parseYouTubeId(s.youtubeUrl);
  const errorCount = Object.keys(errors).length;

  return (
    <form
      onSubmit={submit}
      onKeyDown={e => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit();
      }}
      noValidate
      className="mx-auto max-w-3xl"
    >
      <div className="mb-6 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">{existing ? t('form.editTitle') : t('form.newTitle')}</h1>
        <Link to={existing ? `/p/${existing.id}` : '/'} className="text-sm text-ink-2 hover:text-ink">
          {t('common.cancel')}
        </Link>
      </div>

      {monthFull && (
        <div className="mb-6 border border-accent px-4 py-3 text-sm">
          <p className="up font-medium">{t('form.limitTitle', { limit: settings.monthlyLimit })}</p>
          <p className="mt-1 text-ink-2">
            {t('form.limitBody')}{' '}
            <Link to="/settings" className="underline underline-offset-2">
              {t('nav.settings')}
            </Link>
          </p>
        </div>
      )}

      <Section n="01" title={t('form.secSong')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="artist" className="label">
              {t('form.artist')}
            </label>
            <input
              id="artist"
              value={s.artist}
              onChange={e => set('artist', e.target.value)}
              className={`field ${errors.artist ? 'field-error' : ''}`}
              aria-invalid={!!errors.artist || undefined}
              autoComplete="off"
              autoFocus={!existing}
            />
            <FieldError msg={errors.artist} />
          </div>
          <div>
            <label htmlFor="track" className="label">
              {t('form.track')}
            </label>
            <input
              id="track"
              value={s.track}
              onChange={e => set('track', e.target.value)}
              className={`field ${errors.track ? 'field-error' : ''}`}
              aria-invalid={!!errors.track || undefined}
              autoComplete="off"
            />
            <FieldError msg={errors.track} />
          </div>
        </div>
        {duplicate && (
          <p className="text-[13px] text-ink-2">
            {t('form.duplicate', { date: fmtDate(duplicate.claimedAt) })}{' '}
            <Link to={`/p/${duplicate.id}`} className="underline underline-offset-2">
              {t('form.duplicateOpen')}
            </Link>
          </p>
        )}
        <div>
          <label htmlFor="youtube" className="label">
            {t('form.youtube')}
          </label>
          <div className="flex gap-3">
            <input
              id="youtube"
              type="url"
              inputMode="url"
              value={s.youtubeUrl}
              onChange={e => set('youtubeUrl', e.target.value)}
              placeholder="https://youtu.be/…"
              className={`field ${errors.youtubeUrl ? 'field-error' : ''}`}
              aria-invalid={!!errors.youtubeUrl || undefined}
            />
            {videoId && (
              <a
                href={youtubeWatchUrl(videoId)}
                target="_blank"
                rel="noreferrer"
                className="relative block aspect-video h-10 shrink-0 overflow-hidden rounded-sm bg-sunk"
                title={t('form.openVideo')}
              >
                <img src={youtubeThumb(videoId)} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
              </a>
            )}
          </div>
          <FieldError msg={errors.youtubeUrl} />
          {!errors.youtubeUrl && <p className="mt-1.5 text-[12px] text-ink-3">{t('form.youtubeHint')}</p>}
        </div>
      </Section>

      <Section n="02" title={existing ? t('form.secEntryEdit') : t('form.secEntry')} hint={t('form.secEntryHint')}>
        <div className="grid gap-x-4 gap-y-2 sm:grid-cols-3">
          {METRIC_KEYS.map(m => (
            <div key={m}>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <label htmlFor={`amount-${m}`} className="text-[13px] font-medium text-ink-2">
                  {t(`metric.${m}`)}
                </label>
                <label
                  className={`flex items-center gap-1 text-[12px] ${entry[m] != null ? 'cursor-pointer text-ink-2' : 'text-ink-3/60'}`}
                  title={t('form.baseHint')}
                >
                  <input
                    type="radio"
                    name="primary"
                    className="accent-ink"
                    checked={primary === m && entry[m] != null}
                    disabled={entry[m] == null}
                    onChange={() => set('primary', m)}
                  />
                  {t('form.base')}
                </label>
              </div>
              <AmountInput
                id={`amount-${m}`}
                value={s.amounts[m]}
                onChange={v => set('amounts', { ...s.amounts, [m]: v })}
                placeholder={t(`metricHint.${m}`)}
              />
            </div>
          ))}
        </div>
        {errors.amounts && (
          <p className="up text-[13px]" data-error tabIndex={-1}>
            {errors.amounts}
          </p>
        )}
        <p className="text-[12px] leading-relaxed text-ink-3">{t('form.amountHint')}</p>
      </Section>

      <Section n="03" title={t('form.secWhy')} hint={t('form.secWhyHint')}>
        <div>
          <textarea
            id="note"
            rows={4}
            value={s.note}
            onChange={e => set('note', e.target.value)}
            placeholder={t('form.notePlaceholder')}
            className="field"
          />
          <p className="num mt-1 text-right text-[12px] text-ink-3">{s.note.trim().length}</p>
        </div>
      </Section>

      <Section n="04" title={t('form.secTarget')} hint={t('form.secTargetHint', { mult: settings.hitMultiplier })}>
        <div className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] gap-3">
          <select
            value={s.targetMetric}
            onChange={e => set('targetMetric', e.target.value as MetricKey)}
            className="field"
            aria-label={t('form.targetMetric')}
          >
            {METRIC_KEYS.map(m => (
              <option key={m} value={m}>
                {t(`metric.${m}`)}
              </option>
            ))}
          </select>
          <AmountInput
            value={s.targetText}
            onChange={v => set('targetText', v)}
            placeholder={t('form.targetPlaceholder')}
            compareTo={entry[s.targetMetric]}
            aria-label={t('form.targetValue')}
          />
        </div>
        <FieldError msg={errors.target} />
      </Section>

      <Section n="05" title={t('form.secMore')}>
        <div>
          <label htmlFor="tags" className="label">
            {t('form.tags')}
          </label>
          <TagInput id="tags" tags={s.tags} onChange={v => set('tags', v)} suggestions={tagSuggestions} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="link" className="label">
              {t('form.link')}
            </label>
            <input
              id="link"
              type="url"
              inputMode="url"
              value={s.link}
              onChange={e => set('link', e.target.value)}
              placeholder="https://open.spotify.com/…"
              className={`field ${errors.link ? 'field-error' : ''}`}
              aria-invalid={!!errors.link || undefined}
            />
            <FieldError msg={errors.link} />
          </div>
          <div>
            <label htmlFor="image" className="label">
              {t('form.image')}
            </label>
            <input
              id="image"
              type="url"
              inputMode="url"
              value={s.imageUrl}
              onChange={e => set('imageUrl', e.target.value)}
              placeholder={t('form.imagePlaceholder')}
              className={`field ${errors.imageUrl ? 'field-error' : ''}`}
              aria-invalid={!!errors.imageUrl || undefined}
            />
            <FieldError msg={errors.imageUrl} />
          </div>
        </div>
        <div>
          <label htmlFor="claimedAt" className="label">
            {t('form.claimedAt')}
          </label>
          <input
            id="claimedAt"
            type="datetime-local"
            value={s.claimedAt}
            max={toLocalInput(new Date().toISOString())}
            onChange={e => {
              setTimeTouched(true);
              set('claimedAt', e.target.value);
            }}
            className={`field num sm:max-w-[16rem] ${errors.claimedAt ? 'field-error' : ''}`}
            aria-invalid={!!errors.claimedAt || undefined}
          />
          <FieldError msg={errors.claimedAt} />
          {!errors.claimedAt && !existing && <p className="mt-1.5 text-[12px] text-ink-3">{t('form.claimedAtHint')}</p>}
        </div>
      </Section>

      <div className="sticky bottom-0 z-10 -mx-4 flex items-center justify-end gap-3 border-t border-ink bg-paper/95 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur sm:-mx-6 sm:px-6">
        {errorCount > 0 && (
          <p className="up mr-auto text-[13px]">{errors.limit ?? t('form.errSummary', { count: errorCount })}</p>
        )}
        <Link to={existing ? `/p/${existing.id}` : '/'} className="btn btn-quiet">
          {t('common.cancel')}
        </Link>
        <button type="submit" className="btn btn-primary min-w-[7rem]">
          {existing ? t('common.save') : t('form.submit')}
        </button>
      </div>
      <p className="mt-2 hidden text-right text-[12px] text-ink-3 md:block">{t('form.shortcut')}</p>
    </form>
  );
}

