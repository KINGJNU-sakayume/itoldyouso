import { useLayoutEffect, useRef, useState } from 'react';
import type { Claim, MetricKey } from '../../types';
import { baseMetric } from '../../lib/metrics';
import { DAY, fmtCompact, fmtDate, fmtFull, fmtMult, fmtPct, fmtShortDate } from '../../lib/format';
import { useLang } from '../../lib/i18n';

const H = 232;
const PAD = { top: 18, right: 14, bottom: 30, left: 50 };

/** Rounds up to 1, 2, 2.5 or 5 × 10^k so gridlines land on readable numbers. */
function niceCeil(v: number): number {
  if (v <= 0) return 1;
  const exp = 10 ** Math.floor(Math.log10(v));
  const f = v / exp;
  const step = [1, 2, 2.5, 5, 10].find(s => f <= s) ?? 10;
  return step * exp;
}

interface Props {
  claim: Claim;
  metric: MetricKey;
  hitMultiplier: number;
}

/** Time-scaled line of one metric, with the hit line and the target drawn in. */
export default function ClaimChart({ claim, metric, hitMultiplier }: Props) {
  const { t, lang } = useLang();
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [active, setActive] = useState<number | null>(null);
  const [logPref, setLogPref] = useState<boolean | null>(null);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const points = claim.snapshots.flatMap(s => {
    const v = s.values[metric];
    return v != null ? [{ at: s.at, t: Date.parse(s.at), v }] : [];
  });
  if (!points.length) return null;

  const entry = points[0].v;
  const refs: { value: number; label: string }[] = [];
  if (entry > 0 && metric === baseMetric(claim)) {
    refs.push({ value: entry * hitMultiplier, label: `${t('detail.hitLine')} ${fmtMult(hitMultiplier)}` });
  }
  if (claim.target?.metric === metric) refs.push({ value: claim.target.value, label: t('detail.targetLine') });

  const maxV = Math.max(...points.map(p => p.v));
  // A reference line far above the data would flatten the curve; leave it out.
  const shownRefs = refs.filter(r => r.value <= Math.max(maxV, 1) * 3);
  const top = Math.max(maxV, ...shownRefs.map(r => r.value));

  // Songs that grow ×50 turn a linear chart into a flat line and a cliff;
  // offer a log scale once the range spans an order of magnitude.
  const positives = points.map(p => p.v).filter(v => v > 0);
  const spread = positives.length ? top / Math.min(...positives) : 1;
  const canLog = spread >= 10;
  const log = canLog && (logPref ?? spread >= 30);

  const logLo = log ? 10 ** Math.floor(Math.log10(Math.min(...positives))) : 0;
  const logHi = log ? 10 ** Math.ceil(Math.log10(top * 1.02)) : 0;
  const yMax = log ? logHi : niceCeil(top * 1.06);
  const ticks = log
    ? Array.from({ length: Math.round(Math.log10(logHi / logLo)) + 1 }, (_, i) => logLo * 10 ** i).filter(
        (_, i, all) => all.length <= 6 || i % 2 === (all.length - 1) % 2,
      )
    : [0, yMax / 2, yMax];

  const t0 = points[0].t;
  const t1 = Math.max(points[points.length - 1].t, t0 + DAY);
  const innerW = Math.max(40, width - PAD.left - PAD.right);
  const innerH = H - PAD.top - PAD.bottom;
  const x = (tm: number) => PAD.left + ((tm - t0) / (t1 - t0)) * innerW;
  const y = (v: number) => {
    const f = log
      ? (Math.log10(Math.max(v, logLo)) - Math.log10(logLo)) / (Math.log10(logHi) - Math.log10(logLo))
      : v / yMax;
    return PAD.top + (1 - f) * innerH;
  };

  const line = points.map(p => `${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  const hovered = active != null ? points[active] : null;

  const onPointer = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    let best = 0;
    points.forEach((p, i) => {
      if (Math.abs(x(p.t) - px) < Math.abs(x(points[best].t) - px)) best = i;
    });
    setActive(best);
  };

  const xLabels = points.length > 1 ? [points[0], points[points.length - 1]] : [points[0]];

  return (
    <div ref={box} className="relative select-none">
      {canLog && (
        <div className="mb-1 flex justify-end gap-3 text-[12px]">
          {[false, true].map(v => (
            <button
              key={String(v)}
              onClick={() => setLogPref(v)}
              aria-pressed={log === v}
              className={log === v ? 'font-medium text-ink' : 'text-ink-3 hover:text-ink'}
            >
              {t(v ? 'detail.scaleLog' : 'detail.scaleLinear')}
            </button>
          ))}
        </div>
      )}
      <svg
        width={width}
        height={H}
        className="block touch-pan-y"
        onPointerMove={onPointer}
        onPointerDown={onPointer}
        onPointerLeave={() => setActive(null)}
        role="img"
        aria-label={t('detail.chartLabel', { metric: t(`metric.${metric}`) })}
      >
        {ticks.map((v, i) => (
          <g key={v}>
            <line
              x1={PAD.left}
              x2={width - PAD.right}
              y1={y(v)}
              y2={y(v)}
              stroke="rgb(var(--rule))"
              strokeWidth={i === 0 ? 1.25 : 1}
            />
            <text x={PAD.left - 8} y={y(v) + 4} textAnchor="end" className="fill-ink-3 font-mono text-[11px]">
              {fmtCompact(v, lang)}
            </text>
          </g>
        ))}

        {shownRefs.map(r => (
          <g key={r.label}>
            <line
              x1={PAD.left}
              x2={width - PAD.right}
              y1={y(r.value)}
              y2={y(r.value)}
              stroke="rgb(var(--accent))"
              strokeDasharray="4 4"
              strokeWidth={1}
            />
            <text x={width - PAD.right} y={y(r.value) - 6} textAnchor="end" className="fill-accent text-[11px]">
              {r.label}
            </text>
          </g>
        ))}

        {xLabels.map((p, i) => (
          <text
            key={p.at}
            x={x(p.t)}
            y={H - 8}
            textAnchor={i === 0 ? 'start' : 'end'}
            className="fill-ink-3 font-mono text-[11px]"
          >
            {fmtShortDate(p.at)}
          </text>
        ))}

        {points.length > 1 && (
          <polyline points={line} fill="none" stroke="rgb(var(--ink))" strokeWidth={1.75} strokeLinejoin="round" />
        )}

        {hovered && (
          <line x1={x(hovered.t)} x2={x(hovered.t)} y1={PAD.top} y2={H - PAD.bottom} stroke="rgb(var(--ink-3))" strokeWidth={1} />
        )}

        {points.map((p, i) => (
          <rect
            key={p.at + i}
            x={x(p.t) - (i === active ? 4.5 : 3)}
            y={y(p.v) - (i === active ? 4.5 : 3)}
            width={i === active ? 9 : 6}
            height={i === active ? 9 : 6}
            fill={i === 0 ? 'rgb(var(--paper))' : 'rgb(var(--ink))'}
            stroke={i === 0 ? 'rgb(var(--accent))' : 'none'}
            strokeWidth={2}
          />
        ))}
      </svg>

      {hovered && (
        <div
          className="pointer-events-none absolute top-0 rounded-sm border border-ink/70 bg-paper px-2.5 py-1.5 text-[12px] shadow-sm"
          style={{
            left: Math.min(Math.max(x(hovered.t) - 70, 0), width - 150),
          }}
        >
          <p className="num text-ink-3">
            {fmtDate(hovered.at)}
            {active === 0 && ` · ${t('detail.entryPoint')}`}
          </p>
          <p className="num font-medium">
            {fmtFull(hovered.v, lang)}
            {active !== 0 && entry > 0 && <span className="ml-2 text-ink-2">{fmtPct(hovered.v / entry)}</span>}
          </p>
        </div>
      )}
    </div>
  );
}
