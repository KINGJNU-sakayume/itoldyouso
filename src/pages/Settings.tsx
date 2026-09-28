import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import type { Lang, VaultDoc } from '../types';
import { useVault } from '../store/vaultStore';
import { toast } from '../store/toastStore';
import { setLang, useLang } from '../lib/i18n';
import { applyTheme, getTheme, type Theme } from '../lib/theme';
import { dateStamp, downloadText, normalizeDoc, toBackupJson, toCsv } from '../lib/doc';
import { fmtAgo, fmtDate, fmtDateTime, fmtMult } from '../lib/format';

const LAST_BACKUP_KEY = 'itys-last-backup';

function readLastBackup(): string | null {
  try {
    return localStorage.getItem(LAST_BACKUP_KEY);
  } catch {
    return null;
  }
}

function Group({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6 border-t border-ink pt-4">
      <h2 className="font-semibold">{title}</h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function Row({ label, hint, htmlFor, children }: { label: string; hint?: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-b border-rule py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
      <div className="min-w-0">
        <label htmlFor={htmlFor} className="text-sm font-medium">
          {label}
        </label>
        {hint && <p className="mt-0.5 text-[13px] leading-snug text-ink-3">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export default function Settings() {
  const { t, lang } = useLang();
  const location = useLocation();
  const settings = useVault(s => s.settings);
  const updateSettings = useVault(s => s.updateSettings);
  const [theme, setTheme] = useState<Theme>(getTheme);

  useEffect(() => {
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
  }, [location.hash]);

  return (
    <div className="mx-auto max-w-2xl space-y-12">
      <h1 className="text-2xl font-semibold">{t('settings.title')}</h1>

      <Group title={t('settings.rules')}>
        <Row label={t('settings.hitMultiplier')} hint={t('settings.hitMultiplierHint')} htmlFor="hitMultiplier">
          <select
            id="hitMultiplier"
            className="field w-40"
            value={settings.hitMultiplier}
            onChange={e => updateSettings({ hitMultiplier: Number(e.target.value) })}
          >
            {[...new Set([1.5, 2, 3, 5, 10, settings.hitMultiplier])]
              .sort((a, b) => a - b)
              .map(v => (
                <option key={v} value={v}>
                  {fmtMult(v)} (+{Math.round((v - 1) * 100)}%)
                </option>
              ))}
          </select>
        </Row>
        <Row label={t('settings.monthlyLimit')} hint={t('settings.monthlyLimitHint')} htmlFor="monthlyLimit">
          <input
            id="monthlyLimit"
            type="number"
            min={0}
            max={100}
            inputMode="numeric"
            className="field num w-40"
            value={settings.monthlyLimit}
            onChange={e => {
              const n = Math.round(Number(e.target.value));
              if (Number.isFinite(n) && n >= 0 && n <= 100) updateSettings({ monthlyLimit: n });
            }}
          />
        </Row>
        <Row label={t('settings.staleDays')} hint={t('settings.staleDaysHint')} htmlFor="staleDays">
          <select
            id="staleDays"
            className="field w-40"
            value={settings.staleDays}
            onChange={e => updateSettings({ staleDays: Number(e.target.value) })}
          >
            {[...new Set([7, 14, 30, 60, settings.staleDays])]
              .sort((a, b) => a - b)
              .map(v => (
                <option key={v} value={v}>
                  {t('settings.days', { count: v })}
                </option>
              ))}
          </select>
        </Row>
      </Group>

      <Group title={t('settings.display')}>
        <Row label={t('settings.language')} htmlFor="lang">
          <select id="lang" className="field w-40" value={lang} onChange={e => setLang(e.target.value as Lang)}>
            <option value="ko">한국어</option>
            <option value="en">English</option>
          </select>
        </Row>
        <Row label={t('settings.theme')} htmlFor="theme">
          <select
            id="theme"
            className="field w-40"
            value={theme}
            onChange={e => {
              const next = e.target.value as Theme;
              setTheme(next);
              applyTheme(next);
            }}
          >
            {(['system', 'light', 'dark'] as const).map(v => (
              <option key={v} value={v}>
                {t(`settings.theme_${v}`)}
              </option>
            ))}
          </select>
        </Row>
      </Group>

      <Backup />
      <Danger />

      <p className="num border-t border-rule pt-4 text-[12px] text-ink-3">
        I Told You So · {__BUILD_SHA__} · {fmtDateTime(__BUILD_TIME__)}
      </p>
    </div>
  );
}

function Backup() {
  const { t, lang } = useLang();
  const getDoc = useVault(s => s.getDoc);
  const importDoc = useVault(s => s.importDoc);
  const claimCount = useVault(s => s.claims.length);
  const fileInput = useRef<HTMLInputElement>(null);
  const [incoming, setIncoming] = useState<{ name: string; doc: VaultDoc } | null>(null);
  const [lastBackup, setLastBackup] = useState(readLastBackup);

  const markBackup = () => {
    const now = new Date().toISOString();
    try {
      localStorage.setItem(LAST_BACKUP_KEY, now);
    } catch {
      /* storage blocked */
    }
    setLastBackup(now);
  };

  const exportJson = () => {
    downloadText(`itoldyouso-${dateStamp()}.json`, toBackupJson(getDoc()), 'application/json');
    markBackup();
  };

  const exportCsv = () => downloadText(`itoldyouso-${dateStamp()}.csv`, toCsv(getDoc().claims), 'text/csv;charset=utf-8');

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const doc = normalizeDoc(JSON.parse(await file.text()));
      if (!doc) throw new Error('not a backup');
      setIncoming({ name: file.name, doc });
    } catch {
      toast({ kind: 'error', title: t('settings.importInvalid') });
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const apply = (mode: 'merge' | 'replace') => {
    if (!incoming) return;
    importDoc(incoming.doc, mode);
    toast({ kind: 'info', title: t('settings.imported', { count: incoming.doc.claims.length }) });
    setIncoming(null);
  };

  return (
    <Group id="backup" title={t('settings.backup')}>
      <p className="text-[13px] leading-relaxed text-ink-2">
        {t('settings.backupLead')}
      </p>
      <p className="mt-2 text-[13px] text-ink-3">
        {lastBackup ? t('settings.lastBackup', { ago: fmtAgo(lastBackup, lang) }) : t('settings.neverBackedUp')}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button className="btn btn-primary" onClick={exportJson} disabled={!claimCount}>
          {t('settings.exportJson')}
        </button>
        <button className="btn btn-line" onClick={exportCsv} disabled={!claimCount}>
          {t('settings.exportCsv')}
        </button>
        <button className="btn btn-quiet" onClick={() => fileInput.current?.click()}>
          {t('settings.importJson')}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={e => onFile(e.target.files?.[0])}
        />
      </div>

      {incoming && (
        <div className="mt-4 border border-ink p-4">
          <p className="text-sm font-medium">{incoming.name}</p>
          <p className="mt-1 text-[13px] text-ink-2">
            {t('settings.importSummary', { count: incoming.doc.claims.length, current: claimCount })}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn btn-primary btn-sm" onClick={() => apply('merge')}>
              {t('settings.importMerge')}
            </button>
            <button className="btn btn-danger btn-sm" onClick={() => apply('replace')}>
              {t('settings.importReplace')}
            </button>
            <button className="btn btn-quiet btn-sm" onClick={() => setIncoming(null)}>
              {t('common.cancel')}
            </button>
          </div>
          <p className="mt-2 text-[12px] text-ink-3">{t('settings.importHint')}</p>
        </div>
      )}
    </Group>
  );
}

function Danger() {
  const { t } = useLang();
  const resetAll = useVault(s => s.resetAll);
  const count = useVault(s => s.claims.length);
  const oldest = useVault(s => s.claims.reduce<string | null>((min, c) => (!min || c.claimedAt < min ? c.claimedAt : min), null));
  const [confirm, setConfirm] = useState(false);

  return (
    <Group title={t('settings.data')}>
      <Row
        label={t('settings.resetAll')}
        hint={count ? t('settings.resetHint', { count, since: oldest ? fmtDate(oldest) : '' }) : t('settings.resetEmpty')}
      >
        {confirm ? (
          <div className="flex gap-2">
            <button
              className="btn btn-danger btn-sm"
              onClick={() => {
                resetAll();
                setConfirm(false);
                toast({ kind: 'info', title: t('settings.resetDone') });
              }}
            >
              {t('settings.resetConfirm')}
            </button>
            <button className="btn btn-quiet btn-sm" onClick={() => setConfirm(false)}>
              {t('common.cancel')}
            </button>
          </div>
        ) : (
          <button className="btn btn-quiet btn-sm hover:text-accent" onClick={() => setConfirm(true)} disabled={!count}>
            {t('settings.resetAll')}
          </button>
        )}
      </Row>
    </Group>
  );
}
