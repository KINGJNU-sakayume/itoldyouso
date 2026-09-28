/** Tiny trend line of a pick's primary metric. Index-spaced, min–max scaled. */
export default function Sparkline({ values, width = 76, height = 22 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) {
    return (
      <svg width={width} height={height} aria-hidden className="text-rule">
        <line x1="2" x2={width - 2} y1={height / 2} y2={height / 2} stroke="currentColor" strokeDasharray="2 3" />
      </svg>
    );
  }
  const pad = 2.5;
  const min = Math.min(...values);
  const span = Math.max(...values) - min || 1;
  const pts = values.map((v, i) => [
    pad + (i / (values.length - 1)) * (width - pad * 2),
    height - pad - ((v - min) / span) * (height - pad * 2),
  ]);
  const [lx, ly] = pts[pts.length - 1];
  const up = values[values.length - 1] >= values[0];
  return (
    <svg width={width} height={height} aria-hidden className="overflow-visible text-ink-2">
      <polyline points={pts.map(p => p.join(',')).join(' ')} fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r="2.25" fill={`rgb(var(--${up ? 'accent' : 'down'}))`} />
    </svg>
  );
}
