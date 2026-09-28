import type { Lang } from '../types';

export const DAY = 86_400_000;

const locales: Record<Lang, string> = { ko: 'ko-KR', en: 'en-US' };
const compactFormatters = new Map<Lang, Intl.NumberFormat>();

/** 1234567 → "123.5만" (ko) / "1.2M" (en) */
export function fmtCompact(n: number | null | undefined, lang: Lang): string {
  if (n == null || !Number.isFinite(n)) return '—';
  let f = compactFormatters.get(lang);
  if (!f) {
    f = new Intl.NumberFormat(locales[lang], { notation: 'compact', maximumFractionDigits: 1 });
    compactFormatters.set(lang, f);
  }
  return f.format(n);
}

export function fmtFull(n: number | null | undefined, lang: Lang): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toLocaleString(locales[lang]);
}

/** 2.43 → "×2.4", 0.87 → "×0.87", 12.6 → "×13" */
export function fmtMult(x: number | null | undefined): string {
  if (x == null || !Number.isFinite(x)) return '—';
  const digits = x >= 10 ? 0 : x >= 2 ? 1 : 2;
  return '×' + Number(x.toFixed(digits)).toString();
}

/** Takes a multiplier. 3.2 → "+220%", 0.9 → "−10%" */
export function fmtPct(mult: number | null | undefined): string {
  if (mult == null || !Number.isFinite(mult)) return '—';
  const p = (mult - 1) * 100;
  const abs = Math.abs(p);
  const shown = abs.toLocaleString('en-US', { maximumFractionDigits: abs < 10 ? 1 : 0 });
  if (shown === '0') return '0%';
  return (p > 0 ? '+' : '−') + shown + '%';
}

export function trend(mult: number | null | undefined): 'up' | 'down' | 'flat' {
  if (mult == null || !Number.isFinite(mult)) return 'flat';
  if (mult > 1.0005) return 'up';
  if (mult < 0.9995) return 'down';
  return 'flat';
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "2026.03.14" */
export function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

/** "2026.03.14 02:31" */
export function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return `${fmtDate(iso)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "03.14" */
export function fmtShortDate(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

function startOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Calendar days from `iso` to `now` (0 = same day). */
export function daysSince(iso: string, now: number = Date.now()): number {
  return Math.round((startOfDay(now) - startOfDay(new Date(iso).getTime())) / DAY);
}

export function dPlus(iso: string, now: number = Date.now()): string {
  return `D+${Math.max(0, daysSince(iso, now))}`;
}

const relFormatters = new Map<Lang, Intl.RelativeTimeFormat>();

/** "오늘", "어제", "12일 전", "3개월 전" */
export function fmtAgo(iso: string, lang: Lang, now: number = Date.now()): string {
  let f = relFormatters.get(lang);
  if (!f) {
    f = new Intl.RelativeTimeFormat(locales[lang], { numeric: 'auto' });
    relFormatters.set(lang, f);
  }
  const days = daysSince(iso, now);
  if (days < 45) return f.format(-days, 'day');
  if (days < 365) return f.format(-Math.round(days / 30.4), 'month');
  return f.format(-Math.floor(days / 365), 'year');
}

/** Value for <input type="datetime-local"> in local time. */
export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Value for <input type="date"> in local time. */
export function toLocalDateInput(iso: string): string {
  return toLocalInput(iso).slice(0, 10);
}

export function fromLocalInput(value: string): string | null {
  // "YYYY-MM-DDTHH:mm" is parsed as local time by the Date constructor.
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** A date picked in <input type="date">: today keeps the current time, other days use noon. */
export function fromLocalDateInput(value: string, now: Date = new Date()): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
  if (Number.isNaN(d.getTime())) return null;
  if (d.toDateString() === now.toDateString()) return now.toISOString();
  return d.toISOString();
}

const KO_SMALL: Record<string, number> = { 천: 1e3, 백: 1e2, 십: 10 };
const KO_BIG: Record<string, number> = { 억: 1e8, 만: 1e4 };
const EN_UNITS: Record<string, number> = { k: 1e3, m: 1e6, b: 1e9 };

function parseKorean(s: string): number | null {
  const tokens = s.match(/\d+(?:\.\d+)?|[억만천백십]/g);
  if (!tokens || tokens.join('') !== s || !/\d/.test(s)) return null;
  let total = 0;
  let group = 0;
  let num: number | null = null;
  for (const tok of tokens) {
    if (KO_BIG[tok]) {
      total += (group + (num ?? 0) || 1) * KO_BIG[tok];
      group = 0;
      num = null;
    } else if (KO_SMALL[tok]) {
      group += (num ?? 1) * KO_SMALL[tok];
      num = null;
    } else {
      if (num !== null) return null;
      num = parseFloat(tok);
    }
  }
  return Math.round(total + group + (num ?? 0));
}

/**
 * Parses what people actually type when copying numbers off YouTube or Spotify:
 * "12,345", "1.2M", "3.4k", "12만", "1억 2천만", "4.5만회".
 */
export function parseAmount(raw: string): number | null {
  const s = raw
    .trim()
    .toLowerCase()
    .replace(/[,\s_]/g, '')
    .replace(/(회|명|views?|plays?|streams?|listeners?)$/, '');
  if (!s) return null;

  if (/[억만천백십]/.test(s)) return parseKorean(s);

  const m = /^(\d+(?:\.\d+)?)([kmb])?$/.exec(s);
  if (!m) return null;
  return Math.round(parseFloat(m[1]) * (m[2] ? EN_UNITS[m[2]] : 1));
}
