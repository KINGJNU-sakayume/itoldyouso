import { describe, expect, it } from 'vitest';
import { fmtCompact, fmtMult, fmtPct, parseAmount, daysSince, fromLocalDateInput } from './format';

describe('parseAmount', () => {
  it.each([
    ['12345', 12345],
    ['12,345', 12345],
    [' 1 234 567 ', 1234567],
    ['1.2M', 1_200_000],
    ['3.4k', 3400],
    ['2b', 2_000_000_000],
    ['12만', 120_000],
    ['3.5만', 35_000],
    ['1억 2천만', 120_000_000],
    ['1억2345만6789', 123_456_789],
    ['12만5천', 125_000],
    ['2천', 2000],
    ['4.5만회', 45_000],
    ['1,234 views', 1234],
    ['0', 0],
  ])('%s → %d', (input, expected) => {
    expect(parseAmount(input)).toBe(expected);
  });

  it.each(['', 'abc', '만', '12x', '1.2.3', '-5', '12만abc'])('rejects %j', input => {
    expect(parseAmount(input)).toBeNull();
  });
});

describe('number formatting', () => {
  it('uses Korean units in ko and K/M in en', () => {
    expect(fmtCompact(1_234_567, 'ko')).toBe('123.5만');
    expect(fmtCompact(1_234_567, 'en')).toBe('1.2M');
    expect(fmtCompact(undefined, 'en')).toBe('—');
  });

  it('formats multipliers and percentages', () => {
    expect(fmtMult(2.43)).toBe('×2.4');
    expect(fmtMult(0.874)).toBe('×0.87');
    expect(fmtMult(12.6)).toBe('×13');
    expect(fmtPct(3.2)).toBe('+220%');
    expect(fmtPct(0.9)).toBe('−10%');
    expect(fmtPct(1.055)).toBe('+5.5%');
    expect(fmtPct(1)).toBe('0%');
    expect(fmtPct(101)).toBe('+10,000%');
  });
});

describe('dates', () => {
  it('counts calendar days, not 24h blocks', () => {
    const now = new Date(2026, 2, 15, 0, 30).getTime();
    expect(daysSince(new Date(2026, 2, 14, 23, 50).toISOString(), now)).toBe(1);
    expect(daysSince(new Date(2026, 2, 15, 0, 5).toISOString(), now)).toBe(0);
  });

  it('keeps the current time for today and uses noon for other days', () => {
    const now = new Date(2026, 8, 28, 21, 15);
    expect(fromLocalDateInput('2026-09-28', now)).toBe(now.toISOString());
    expect(fromLocalDateInput('2026-09-20', now)).toBe(new Date(2026, 8, 20, 12).toISOString());
    expect(fromLocalDateInput('nope', now)).toBeNull();
  });
});
