import { Link } from 'react-router-dom';
import type { Claim } from '../../types';
import { ACHIEVEMENT_GROUPS, type AchievementResult, type Progress } from '../../lib/achievements';
import { fmtDate, fmtMult } from '../../lib/format';
import { useLang } from '../../lib/i18n';
import Seal from '../ui/Seal';

function ProgressLine({ p }: { p: Progress }) {
  const ratio = Math.max(0, Math.min(1, p.current / p.goal));
  const label =
    p.kind === 'mult'
      ? `${fmtMult(p.current || 1)} / ${fmtMult(p.goal)}`
      : p.kind === 'percent'
        ? `${p.current}% / ${p.goal}%`
        : `${p.current} / ${p.goal}`;
  return (
    <div className="mt-2 flex items-center gap-3">
      <div className="h-[3px] flex-1 bg-rule">
        <div className="h-full bg-ink-2" style={{ width: `${ratio * 100}%` }} />
      </div>
      <span className="num shrink-0 text-[11px] text-ink-3">{label}</span>
    </div>
  );
}

function Pips({ tier }: { tier: number }) {
  return (
    <span className="inline-flex gap-[3px]" aria-hidden>
      {[1, 2, 3, 4].map(i => (
        <span key={i} className={`h-[5px] w-[5px] ${i <= tier ? (tier === 4 ? 'bg-accent' : 'bg-ink-2') : 'bg-rule'}`} />
      ))}
    </span>
  );
}

export default function AchievementGrid({ results, claims }: { results: AchievementResult[]; claims: Claim[] }) {
  const { t } = useLang();
  const byId = new Map(claims.map(c => [c.id, c]));

  return (
    <div className="space-y-10">
      {ACHIEVEMENT_GROUPS.map(group => {
        const items = results.filter(r => r.group === group);
        const earned = items.filter(r => r.earnedAt).length;
        return (
          <section key={group}>
            <div className="flex items-baseline justify-between border-b border-ink pb-2">
              <h3 className="text-[15px] font-semibold">{t(`achGroup.${group}`)}</h3>
              <span className="num text-[12px] text-ink-3">
                {earned}/{items.length}
              </span>
            </div>
            <ul className="grid gap-x-10 sm:grid-cols-2">
              {items.map(r => {
                const claim = r.claimId ? byId.get(r.claimId) : undefined;
                return (
                  <li key={r.id} className="flex gap-3 border-b border-rule py-3.5">
                    <Seal glyph={r.glyph} tier={r.tier} earned={!!r.earnedAt} size={46} />
                    <div className="min-w-0 flex-1 pt-1.5">
                      <div className="flex items-center gap-2">
                        <p className={`font-medium ${r.earnedAt ? '' : 'text-ink-2'}`}>{t(`ach.${r.id}.name`)}</p>
                        <Pips tier={r.tier} />
                      </div>
                      <p className="mt-0.5 text-[13px] leading-snug text-ink-2">{t(`ach.${r.id}.desc`)}</p>
                      {r.earnedAt ? (
                        <p className="num mt-1.5 truncate text-[12px] text-ink-3">
                          {fmtDate(r.earnedAt)}
                          {claim && (
                            <>
                              {' · '}
                              <Link to={`/p/${claim.id}`} className="font-sans underline-offset-2 hover:text-ink hover:underline">
                                {claim.track}
                              </Link>
                            </>
                          )}
                        </p>
                      ) : (
                        r.progress && r.progress.goal > 1 && <ProgressLine p={r.progress} />
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
