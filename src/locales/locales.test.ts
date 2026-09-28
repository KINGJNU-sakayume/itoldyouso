import { describe, expect, it } from 'vitest';
import ko from './ko.json';
import en from './en.json';
import { evaluateAchievements, ACHIEVEMENT_GROUPS } from '../lib/achievements';

function keys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`.replace(/_(one|other)$/, '')],
  );
}

describe('locales', () => {
  it('ko and en define the same keys', () => {
    expect([...new Set(keys(en))].sort()).toEqual([...new Set(keys(ko))].sort());
  });

  it('every achievement and group has copy', () => {
    for (const lang of [ko, en] as object[]) {
      const flat = new Set(keys(lang));
      for (const { id } of evaluateAchievements([])) {
        expect(flat.has(`ach.${id}.name`), id).toBe(true);
        expect(flat.has(`ach.${id}.desc`), id).toBe(true);
      }
      for (const g of ACHIEVEMENT_GROUPS) expect(flat.has(`achGroup.${g}`), g).toBe(true);
    }
  });
});
