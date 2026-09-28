import { useEffect, useMemo, useState } from 'react';
import { Download, Share } from 'lucide-react';
import type { Claim } from '../../types';
import Modal from '../ui/Modal';
import { canvasToBlob, renderShareCard, type CardContent, type CardFormat } from '../../lib/shareCard';
import { headline } from '../../lib/metrics';
import { dPlus, fmtCompact, fmtDate, fmtFull, fmtMult, fmtPct, trend } from '../../lib/format';
import { useLang } from '../../lib/i18n';
import { useVault } from '../../store/vaultStore';

interface Rendered {
  url: string;
  file: File;
  coverMissing: boolean;
}

export default function ShareDialog({ claim, onClose }: { claim: Claim; onClose: () => void }) {
  const { t, lang } = useLang();
  const number = useVault(s => s.claims.filter(c => c.claimedAt <= claim.claimedAt).length);
  const [format, setFormat] = useState<CardFormat>('story');
  const [rendered, setRendered] = useState<Rendered | null>(null);
  const [failed, setFailed] = useState(false);

  const content = useMemo<CardContent>(() => {
    const h = headline(claim);
    const mult = h?.mult ?? null;
    const metric = h ? t(`metric.${h.metric}`) : '';
    return {
      brand: 'I TOLD YOU SO',
      number: `№ ${String(number).padStart(3, '0')}`,
      pickedLabel: t('share.picked'),
      pickedValue: fmtDate(claim.claimedAt),
      dPlus: dPlus(claim.claimedAt),
      numbersLabel: h ? `${metric} · ${t(mult != null ? 'share.thenNow' : 'share.atPick')}` : '',
      numbersValue: h ? (mult != null ? `${fmtFull(h.entry, lang)} → ${fmtFull(h.latest, lang)}` : fmtFull(h.entry, lang)) : '',
      big: mult != null ? fmtMult(mult) : undefined,
      bigSub: mult != null ? fmtPct(mult) : undefined,
      direction: trend(mult),
      pending:
        mult != null
          ? undefined
          : claim.target
            ? t('share.prediction', {
                metric: t(`metric.${claim.target.metric}`),
                value: fmtCompact(claim.target.value, lang),
              })
            : t('share.watching'),
      hitLabel: claim.status === 'hit' ? t('stamp.hit') : undefined,
      hitDate: claim.status === 'hit' && claim.hitAt ? fmtDate(claim.hitAt) : undefined,
      note: claim.note || undefined,
      footerLeft: 'itoldyouso',
      footerRight: t('share.asOf', { date: fmtDate(h?.latestAt ?? claim.claimedAt) }),
    };
  }, [claim, number, lang, t]);

  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;
    setRendered(null);
    setFailed(false);
    renderShareCard(claim, content, format)
      .then(async ({ canvas, coverMissing }) => {
        const blob = await canvasToBlob(canvas);
        if (cancelled) return;
        const slug = `${claim.artist}-${claim.track}`.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 60);
        url = URL.createObjectURL(blob);
        setRendered({ url, file: new File([blob], `itys-${slug || 'card'}.png`, { type: 'image/png' }), coverMissing });
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [claim, content, format]);

  const canShare =
    !!rendered && typeof navigator.canShare === 'function' && navigator.canShare({ files: [rendered.file] });

  const download = () => {
    if (!rendered) return;
    const a = document.createElement('a');
    a.href = rendered.url;
    a.download = rendered.file.name;
    a.click();
  };

  const share = async () => {
    if (!rendered) return;
    try {
      await navigator.share({ files: [rendered.file], title: `${claim.artist} — ${claim.track}` });
    } catch {
      /* dismissed */
    }
  };

  return (
    <Modal title={t('share.title')} onClose={onClose}>
      <div role="tablist" className="seg mb-4">
        {(['story', 'square'] as const).map(f => (
          <button key={f} role="tab" aria-selected={format === f} onClick={() => setFormat(f)}>
            {t(`share.${f}`)}
          </button>
        ))}
      </div>

      <div className="grid min-h-[320px] place-items-center bg-sunk p-4">
        {rendered ? (
          <img
            src={rendered.url}
            alt={t('share.previewAlt')}
            className={`w-auto border border-rule ${format === 'story' ? 'max-h-[52dvh]' : 'max-h-[44dvh]'}`}
          />
        ) : failed ? (
          <p className="text-sm text-accent">{t('share.failed')}</p>
        ) : (
          <p className="text-sm text-ink-3">{t('share.rendering')}</p>
        )}
      </div>
      {rendered?.coverMissing && <p className="mt-2 text-[12px] text-ink-3">{t('share.coverMissing')}</p>}

      <div className="mt-5 flex justify-end gap-2">
        {canShare && (
          <button className="btn btn-line" onClick={share}>
            <Share size={15} />
            {t('share.share')}
          </button>
        )}
        <button className="btn btn-primary" onClick={download} disabled={!rendered}>
          <Download size={15} />
          {t('share.save')}
        </button>
      </div>
    </Modal>
  );
}
