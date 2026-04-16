import { useState } from 'react';
import { motion } from 'framer-motion';
import { Heart, TrendingUp, TrendingDown, Compass, Share2, Youtube, Eye, ThumbsUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Claim } from '../../types';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';

function formatCount(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

interface Props {
  claim: Claim;
  onUpdate: () => void;
  onShareCard?: (claim: Claim) => void;
}

function useTimeAgo() {
  const { t } = useTranslation();
  return (date: string): string => {
    const diff = Date.now() - new Date(date).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return t('claimCard.today');
    if (days === 1) return t('claimCard.yesterday');
    if (days < 30) return `${days}${t('claimCard.daysAgo')}`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}${t('claimCard.monthsAgo')}`;
    return `${Math.floor(months / 12)}${t('claimCard.yearsAgo')}`;
  };
}

export default function ClaimCard({ claim, onUpdate, onShareCard }: Props) {
  const { accessToken } = useAuthStore();
  const { t } = useTranslation();
  const timeAgo = useTimeAgo();
  const [isRespecting, setIsRespecting] = useState(false);
  const [hasRespected, setHasRespected] = useState(claim.has_respected || false);
  const [respectCount, setRespectCount] = useState(claim.respect_count);

  const vibePositive = claim.vibe_index >= 0;
  const vibeDisplay = `${vibePositive ? '+' : ''}${claim.vibe_index}%`;

  const handleRespect = async () => {
    if (!accessToken || isRespecting) return;
    setIsRespecting(true);

    if (hasRespected) {
      await supabase
        .from('respects')
        .delete()
        .eq('claim_id', claim.id)
        .eq('user_id', 'local-user');
      setHasRespected(false);
      setRespectCount(c => Math.max(0, c - 1));
    } else {
      await supabase
        .from('respects')
        .insert({ claim_id: claim.id, user_id: 'local-user' });
      setHasRespected(true);
      setRespectCount(c => c + 1);
    }

    setIsRespecting(false);
    onUpdate();
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="masonry-item"
    >
      <div className="card group">
        <div className="relative overflow-hidden">
          <img
            src={claim.album_cover_url || claim.artist_image_url}
            alt={claim.artist_name}
            className="w-full object-cover transition-transform duration-500 group-hover:scale-105"
            style={{ aspectRatio: '1/1' }}
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

          <div className="absolute top-3 left-3 flex gap-2 flex-wrap">
            {claim.is_pioneer && (
              <span className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[var(--color-gold)]/90 text-white backdrop-blur-sm">
                <Compass size={9} />
                {t('claimCard.pioneer')}
              </span>
            )}
            {claim.is_validated && (
              <span className="validated-stamp text-[10px] bg-white/90 backdrop-blur-sm">
                ✓ {t('claimCard.toldYouSo')}
              </span>
            )}
          </div>

          {claim.vibe_index !== 0 && (
            <div className="absolute top-3 right-3">
              <span className={`vibe-badge backdrop-blur-sm ${vibePositive ? 'positive' : 'negative'} bg-white/90`}>
                {vibePositive ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                {vibeDisplay}
              </span>
            </div>
          )}

          <div className="absolute bottom-0 left-0 right-0 p-4">
            <p className="text-white font-semibold text-sm leading-tight">{claim.artist_name}</p>
            <p className="text-white/70 text-xs mt-0.5">{claim.track_name}</p>
          </div>
        </div>

        <div className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs text-[var(--color-text-3)] ml-auto shrink-0">
              {timeAgo(claim.created_at)}
            </span>
          </div>

          <p className="text-sm text-[var(--color-text-2)] leading-relaxed line-clamp-3 mb-4 italic">
            "{claim.insight}"
          </p>

          {(claim.entry_youtube_view_count != null || claim.entry_youtube_like_count != null) && (
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="bg-[var(--color-surface-2)] rounded-xl p-2.5 text-center">
                <div className="flex items-center justify-center gap-1 mb-0.5">
                  <Eye size={9} className="text-[var(--color-text-3)]" />
                  <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-3)]">{t('claimCard.entryViews')}</p>
                </div>
                <p className="text-sm font-bold text-[var(--color-text)]">
                  {claim.entry_youtube_view_count != null ? formatCount(claim.entry_youtube_view_count) : '—'}
                </p>
              </div>
              <div className="bg-[var(--color-surface-2)] rounded-xl p-2.5 text-center">
                <div className="flex items-center justify-center gap-1 mb-0.5">
                  <ThumbsUp size={9} className="text-[var(--color-text-3)]" />
                  <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-3)]">{t('claimCard.entryLikes')}</p>
                </div>
                <p className="text-sm font-bold text-[var(--color-text)]">
                  {claim.entry_youtube_like_count != null ? formatCount(claim.entry_youtube_like_count) : '—'}
                </p>
              </div>
            </div>
          )}

          {claim.youtube_video_id && (
            <a
              href={`https://www.youtube.com/watch?v=${claim.youtube_video_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 p-2.5 rounded-xl border border-[var(--color-border)] hover:border-red-200 hover:bg-red-50/50 transition-all mb-4 group"
            >
              <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center shrink-0 group-hover:bg-red-500 transition-colors">
                <Youtube size={14} className="text-red-500 group-hover:text-white transition-colors" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-3)] mb-0.5">{t('claimCard.youtubeSnapshot')}</p>
                <div className="flex items-center gap-3">
                  {claim.youtube_view_count != null && (
                    <span className="flex items-center gap-1 text-xs text-[var(--color-text-2)]">
                      <Eye size={10} />
                      {formatCount(claim.youtube_view_count)}
                    </span>
                  )}
                  {claim.youtube_like_count != null && (
                    <span className="flex items-center gap-1 text-xs text-[var(--color-text-2)]">
                      <ThumbsUp size={10} />
                      {formatCount(claim.youtube_like_count)}
                    </span>
                  )}
                </div>
              </div>
            </a>
          )}

          {claim.genres?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {claim.genres.slice(0, 3).map(g => (
                <span
                  key={g}
                  className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                  style={{ background: 'var(--color-accent-light)', color: 'var(--color-accent)' }}
                >
                  {g}
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 pt-3 border-t border-[var(--color-border)]">
            <motion.button
              whileTap={{ scale: 0.85 }}
              onClick={handleRespect}
              disabled={!accessToken || isRespecting}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200 ${
                hasRespected
                  ? 'bg-red-50 text-red-500'
                  : 'hover:bg-[var(--color-surface-2)] text-[var(--color-text-2)]'
              }`}
            >
              <Heart size={14} fill={hasRespected ? 'currentColor' : 'none'} />
              <span>{respectCount > 0 ? respectCount : t('claimCard.respect')}</span>
            </motion.button>

            <div className="ml-auto flex items-center gap-1">
              {onShareCard && (
                <button
                  onClick={() => onShareCard(claim)}
                  className="p-2 rounded-xl hover:bg-[var(--color-surface-2)] transition-colors text-[var(--color-text-3)]"
                  title={t('claimCard.generateCard')}
                >
                  <Share2 size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
