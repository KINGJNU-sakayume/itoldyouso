import type { Tier } from '../../lib/achievements';

/**
 * Achievement mark: a round seal with a short glyph. Higher tiers get extra
 * rings; the top tier is struck in the stamp colour. Padding reserves room
 * for the rings so earned and locked seals line up.
 */
export default function Seal({ glyph, tier, earned, size = 52 }: { glyph: string; tier: Tier; earned: boolean; size?: number }) {
  const fontSize = size * (glyph.length <= 2 ? 0.34 : glyph.length === 3 ? 0.28 : 0.23);
  const rings = earned ? Math.min(2, tier - 1) : 0;
  const ring = tier === 4 ? 'var(--accent)' : 'var(--ink)';
  const shadow = Array.from({ length: rings }, (_, i) => {
    const gap = 2 + i * 3.5;
    return `0 0 0 ${gap}px rgb(var(--paper)), 0 0 0 ${gap + 1.25}px rgb(${ring})`;
  }).join(', ');
  const tone = !earned
    ? 'border border-dashed border-ink-3/60 text-ink-3'
    : tier === 4
      ? 'bg-accent text-paper'
      : 'bg-ink text-paper';

  return (
    <div aria-hidden className="shrink-0 p-[7px]">
      <div
        className={`grid place-items-center rounded-full font-mono font-semibold leading-none ${tone}`}
        style={{ width: size, height: size, fontSize, boxShadow: shadow || undefined }}
      >
        {glyph}
      </div>
    </div>
  );
}
