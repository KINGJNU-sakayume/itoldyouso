import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Download, Loader2, Sparkles, TrendingUp, Eye, ThumbsUp } from 'lucide-react';
import html2canvas from 'html2canvas';
import { useTranslation } from 'react-i18next';
import type { Claim } from '../../types';
import { extractDominantColors } from '../../lib/colors';

function formatCount(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

interface Props {
  claim: Claim;
  onClose: () => void;
}

interface ColorScheme {
  primary: string;
  secondary: string;
  accent: string;
  isDark: boolean;
}

export default function ProofOfTasteCard({ claim, onClose }: Props) {
  const { t } = useTranslation();
  const cardRef = useRef<HTMLDivElement>(null);
  const [colors, setColors] = useState<ColorScheme>({
    primary: 'rgb(26,24,20)',
    secondary: 'rgb(50,46,40)',
    accent: 'rgb(196,149,106)',
    isDark: true,
  });
  const [isCapturing, setIsCapturing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const vibePositive = claim.vibe_index >= 0;
  const vibeDisplay = `${vibePositive ? '+' : ''}${claim.vibe_index}%`;
  const claimDate = new Date(claim.created_at).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  useEffect(() => {
    const imageUrl = claim.album_cover_url || claim.artist_image_url;
    if (imageUrl) {
      extractDominantColors(imageUrl).then(setColors);
    }
  }, [claim]);

  const gradientBg = `linear-gradient(160deg, ${colors.primary} 0%, ${colors.secondary} 50%, ${colors.primary} 100%)`;

  const handleCapture = async () => {
    if (!cardRef.current) return;
    setIsCapturing(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
        logging: false,
      });
      setPreviewUrl(canvas.toDataURL('image/png', 1.0));
    } catch (err) {
      console.error('Card capture error', err);
    } finally {
      setIsCapturing(false);
    }
  };

  const handleDownload = () => {
    if (!previewUrl) return;
    const a = document.createElement('a');
    a.href = previewUrl;
    a.download = `proof-of-taste-${claim.artist_name.replace(/\s+/g, '-').toLowerCase()}.png`;
    a.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="relative bg-white rounded-3xl overflow-hidden shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto scrollbar-none"
      >
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[var(--color-border)]">
          <div>
            <h2 className="text-xl font-bold text-[var(--color-text)]">{t('proofCard.title')}</h2>
            <p className="text-xs text-[var(--color-text-3)] mt-0.5">{t('proofCard.format')}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-[var(--color-surface-2)] flex items-center justify-center"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-6">
          {previewUrl ? (
            <div className="space-y-4">
              <img
                src={previewUrl}
                alt="Proof of Taste Card"
                className="w-full rounded-2xl shadow-lg"
                style={{ maxHeight: '500px', objectFit: 'contain' }}
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setPreviewUrl(null)}
                  className="flex-1 btn-ghost border border-[var(--color-border)] justify-center"
                >
                  {t('proofCard.regenerate')}
                </button>
                <button
                  onClick={handleDownload}
                  className="flex-1 btn-primary justify-center"
                >
                  <Download size={15} />
                  {t('proofCard.download')}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex justify-center">
                <div
                  ref={cardRef}
                  className="relative overflow-hidden rounded-2xl"
                  style={{
                    width: '280px',
                    height: '497px',
                    background: gradientBg,
                    fontFamily: "'Inter', system-ui, sans-serif",
                  }}
                >
                  <div
                    className="absolute inset-0 opacity-10"
                    style={{
                      backgroundImage: `repeating-linear-gradient(
                        45deg,
                        transparent,
                        transparent 10px,
                        rgba(255,255,255,0.05) 10px,
                        rgba(255,255,255,0.05) 20px
                      )`,
                    }}
                  />

                  <div className="absolute inset-0 flex flex-col p-6">
                    <div className="flex items-center justify-between mb-auto">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center">
                          <Sparkles size={12} className="text-white" />
                        </div>
                        <span className="text-white/80 text-[10px] font-semibold tracking-widest uppercase">
                          {t('proofCard.brandTitle')}
                        </span>
                      </div>
                      {claim.is_validated && (
                        <span className="px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider bg-green-400/20 text-green-300 border border-green-400/30">
                          ✓ {t('proofCard.validated')}
                        </span>
                      )}
                    </div>

                    <div className="flex justify-center my-4">
                      <div className="relative">
                        <img
                          src={claim.album_cover_url || claim.artist_image_url}
                          alt={claim.artist_name}
                          crossOrigin="anonymous"
                          className="rounded-2xl object-cover"
                          style={{ width: '160px', height: '160px' }}
                        />
                        <div
                          className="absolute inset-0 rounded-2xl"
                          style={{
                            boxShadow: `0 8px 32px ${colors.primary}80`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="text-center mb-4">
                      <p className="text-white font-bold text-xl leading-tight" style={{ fontFamily: 'Georgia, serif' }}>
                        {claim.artist_name}
                      </p>
                      <p className="text-white/60 text-xs mt-1">{claim.track_name}</p>
                    </div>

                    <div
                      className="rounded-xl p-3 mb-4"
                      style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
                    >
                      <p className="text-white/50 text-[9px] uppercase tracking-widest mb-2 text-center">{t('proofCard.entryPoint')}</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="text-center">
                          <div className="flex items-center justify-center gap-1 mb-0.5">
                            <Eye size={8} className="text-white/40" />
                          </div>
                          <p className="text-white font-bold text-base">
                            {claim.entry_youtube_view_count != null ? formatCount(claim.entry_youtube_view_count) : '—'}
                          </p>
                          <p className="text-white/40 text-[8px] uppercase tracking-wider">{t('proofCard.views')}</p>
                        </div>
                        <div className="text-center">
                          <div className="flex items-center justify-center gap-1 mb-0.5">
                            <ThumbsUp size={8} className="text-white/40" />
                          </div>
                          <p className="text-white font-bold text-base">
                            {claim.entry_youtube_like_count != null ? formatCount(claim.entry_youtube_like_count) : '—'}
                          </p>
                          <p className="text-white/40 text-[8px] uppercase tracking-wider">{t('proofCard.likes')}</p>
                        </div>
                      </div>
                      {claim.vibe_index !== 0 && (
                        <div className="flex items-center justify-center gap-1.5 mt-2 pt-2 border-t border-white/10">
                          <TrendingUp size={10} className={vibePositive ? 'text-green-400' : 'text-red-400'} />
                          <span className={`text-xs font-bold ${vibePositive ? 'text-green-400' : 'text-red-400'}`}>
                            {vibeDisplay} {t('proofCard.vibeIndex')}
                          </span>
                        </div>
                      )}
                    </div>

                    <div
                      className="rounded-xl p-3 mb-4"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                    >
                      <p className="text-white/80 text-[10px] italic leading-relaxed text-center line-clamp-3">
                        "{claim.insight.length > 100 ? claim.insight.slice(0, 97) + '...' : claim.insight}"
                      </p>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white/40 text-[8px] uppercase tracking-wider">{t('proofCard.claimedBy')}</p>
                        <p className="text-white/80 text-[10px] font-medium mt-0.5">
                          Anonymous
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-white/40 text-[8px] uppercase tracking-wider">{t('proofCard.date')}</p>
                        <p className="text-white/80 text-[10px] font-medium mt-0.5">{claimDate}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={handleCapture}
                disabled={isCapturing}
                className="w-full btn-primary justify-center"
              >
                {isCapturing ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    {t('proofCard.generating')}
                  </>
                ) : (
                  <>
                    <Sparkles size={15} />
                    {t('proofCard.generate')}
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
