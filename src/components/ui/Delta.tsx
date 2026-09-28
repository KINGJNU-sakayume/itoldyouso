import { fmtMult, fmtPct, trend } from '../../lib/format';

/** Growth figure coloured by direction: red up, blue down (Korean market convention). */
export default function Delta({ mult, as = 'pct', className = '' }: { mult: number | null | undefined; as?: 'pct' | 'mult'; className?: string }) {
  const dir = trend(mult);
  const tone = dir === 'up' ? 'up' : dir === 'down' ? 'down' : 'text-ink-3';
  return <span className={`num ${tone} ${className}`}>{as === 'pct' ? fmtPct(mult) : fmtMult(mult)}</span>;
}
