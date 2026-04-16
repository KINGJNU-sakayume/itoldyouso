import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Trophy,
  Compass,
  ChevronDown,
  ChevronUp,
  Share2,
  Target,
  Eye,
  ThumbsUp,
  Youtube,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import type { Claim } from '../types';
import ClaimChart from '../components/dashboard/ClaimChart';
import BadgeGrid from '../components/badges/BadgeGrid';
import BadgeEarnedToast from '../components/badges/BadgeEarnedToast';
import ProofOfTasteCard from '../components/card-generator/ProofOfTasteCard';
import { useBadgeStore } from '../store/badgeStore';

function formatFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function formatCount(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function getViewGrowthPct(current: number | null, entry: number | null): string | null {
  if (current == null || entry == null || entry === 0) return null;
  return ((current - entry) / entry * 100).toFixed(1);
}

function VaultClaimRow({ claim, onShare }: { claim: Claim; onShare: (c: Claim) => void }) {
  const [expanded, setExpanded] = useState(false);
  const { t } = useTranslation();
  const growth = claim.entry_listeners > 0
    ? ((claim.current_listeners - claim.entry_listeners) / claim.entry_listeners * 100).toFixed(1)
    : '0';
  const isPositive = Number(growth) >= 0;

  return (
    <motion.div
      layout
      className="card overflow-hidden"
    >
      <div
        className="flex items-center gap-4 p-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="relative shrink-0">
          <img
            src={claim.album_cover_url || claim.artist_image_url}
            alt={claim.artist_name}
            className="w-14 h-14 rounded-xl object-cover"
          />
          {claim.is_validated && (
            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[var(--color-validated)] flex items-center justify-center">
              <Trophy size={10} className="text-white" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="font-semibold text-sm text-[var(--color-text)] truncate">{claim.artist_name}</p>
            {claim.is_pioneer && (
              <Compass size={12} style={{ color: 'var(--color-gold)' }} className="shrink-0" />
            )}
          </div>
          <p className="text-xs text-[var(--color-text-3)] truncate">{claim.track_name}</p>
          <p className="text-xs text-[var(--color-text-3)] mt-0.5">
            {new Date(claim.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        </div>

        <div className="text-right shrink-0">
          <div className={`flex items-center gap-1 justify-end text-sm font-bold ${
            isPositive ? 'text-[var(--color-validated)]' : 'text-red-500'
          }`}>
            {Number(growth) > 0 ? <TrendingUp size={14} /> :
             Number(growth) < 0 ? <TrendingDown size={14} /> :
             <Minus size={14} />}
            {isPositive ? '+' : ''}{growth}%
          </div>
          <p className="text-[10px] text-[var(--color-text-3)] mt-0.5">
            {formatFollowers(claim.current_listeners)} {t('lastfm.listeners')}
          </p>
        </div>

        <div className="shrink-0">
          {expanded ? <ChevronUp size={16} className="text-[var(--color-text-3)]" /> : <ChevronDown size={16} className="text-[var(--color-text-3)]" />}
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-[var(--color-border)] pt-4">
              {claim.entry_youtube_view_count != null ? (
                <div className="mb-4 rounded-xl border border-[var(--color-border)] overflow-hidden">
                  <div className="flex items-center gap-1.5 px-3 py-2 bg-[var(--color-surface-2)] border-b border-[var(--color-border)]">
                    <Youtube size={11} className="text-red-500" />
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-3)]">
                      {t('vault.youtubeSnapshot')}
                    </p>
                  </div>
                  <div className="grid grid-cols-3 divide-x divide-[var(--color-border)]">
                    <div className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <Eye size={10} className="text-[var(--color-text-3)]" />
                        <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-3)]">{t('vault.views')}</p>
                      </div>
                      <p className="text-sm font-bold text-[var(--color-text)]">{formatCount(claim.entry_youtube_view_count)}</p>
                      {(() => {
                        const pct = getViewGrowthPct(claim.youtube_view_count, claim.entry_youtube_view_count);
                        if (!pct) return null;
                        return (
                          <p className={`text-[10px] font-semibold mt-0.5 ${Number(pct) >= 0 ? 'text-[var(--color-validated)]' : 'text-red-500'}`}>
                            {Number(pct) >= 0 ? '+' : ''}{pct}%
                          </p>
                        );
                      })()}
                    </div>
                    <div className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <ThumbsUp size={10} className="text-[var(--color-text-3)]" />
                        <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-3)]">{t('vault.likes')}</p>
                      </div>
                      <p className="text-sm font-bold text-[var(--color-text)]">{formatCount(claim.entry_youtube_like_count)}</p>
                      {(() => {
                        const pct = getViewGrowthPct(claim.youtube_like_count, claim.entry_youtube_like_count);
                        if (!pct) return null;
                        return (
                          <p className={`text-[10px] font-semibold mt-0.5 ${Number(pct) >= 0 ? 'text-[var(--color-validated)]' : 'text-red-500'}`}>
                            {Number(pct) >= 0 ? '+' : ''}{pct}%
                          </p>
                        );
                      })()}
                    </div>
                    <div className="p-3 text-center">
                      <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-3)] mb-1">{t('vault.vibeIndex')}</p>
                      <p className={`text-sm font-bold ${claim.vibe_index >= 0 ? 'text-[var(--color-validated)]' : 'text-red-500'}`}>
                        {claim.vibe_index >= 0 ? '+' : ''}{claim.vibe_index}%
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-[var(--color-surface-2)] rounded-xl p-3 text-center">
                    <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-3)] mb-1">{t('lastfm.entryListeners')}</p>
                    <p className="text-sm font-bold text-[var(--color-text)]">{formatFollowers(claim.entry_listeners)}</p>
                  </div>
                  <div className="bg-[var(--color-surface-2)] rounded-xl p-3 text-center">
                    <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-3)] mb-1">{t('vault.current')}</p>
                    <p className="text-sm font-bold text-[var(--color-text)]">{formatFollowers(claim.current_listeners)}</p>
                  </div>
                  <div className="bg-[var(--color-surface-2)] rounded-xl p-3 text-center">
                    <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-3)] mb-1">{t('vault.vibeIndex')}</p>
                    <p className={`text-sm font-bold ${claim.vibe_index >= 0 ? 'text-[var(--color-validated)]' : 'text-red-500'}`}>
                      {claim.vibe_index >= 0 ? '+' : ''}{claim.vibe_index}%
                    </p>
                  </div>
                </div>
              )}

              <ClaimChart claim={claim} />

              <div className="mt-4 flex items-center gap-2">
                <p className="text-xs italic text-[var(--color-text-2)] flex-1 leading-relaxed">"{claim.insight}"</p>
                <button
                  onClick={(e) => { e.stopPropagation(); onShare(claim); }}
                  className="p-2 rounded-xl hover:bg-[var(--color-surface-2)] transition-colors text-[var(--color-text-3)] shrink-0"
                  title="Generate Proof of Taste card"
                >
                  <Share2 size={14} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function Vault() {
  const { t } = useTranslation();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tab, setTab] = useState<'active' | 'hof'>('active');
  const [shareTarget, setShareTarget] = useState<Claim | null>(null);
  const { fetchUserBadges, checkAndAwardBadges, newlyEarned, clearNewlyEarned } = useBadgeStore();

  const fetchClaims = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await supabase
        .from('claims')
        .select('*')
        .eq('user_id', 'local-user')
        .order('created_at', { ascending: false });

      if (data) {
        setClaims(data);
        await checkAndAwardBadges(data);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClaims();
    fetchUserBadges('local-user');
  }, []);

  const activeClaims = claims.filter(c => !c.is_validated);
  const hofClaims = claims.filter(c => c.is_validated);
  const totalRespects = claims.reduce((sum, c) => sum + c.respect_count, 0);
  const successRate = claims.length > 0 ? Math.round((hofClaims.length / claims.length) * 100) : 0;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[var(--color-text)]">{t('vault.title')}</h1>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
        {[
          { label: t('vault.totalClaims'), value: claims.length, icon: Target },
          { label: t('vault.validated'), value: hofClaims.length, icon: Trophy },
          { label: t('vault.successRate'), value: `${successRate}%`, icon: TrendingUp },
          { label: t('vault.totalRespects'), value: totalRespects.toLocaleString(), icon: Trophy },
        ].map(stat => (
          <div key={stat.label} className="card p-4 text-center">
            <p className="text-2xl font-bold text-[var(--color-text)] mb-1">{stat.value}</p>
            <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-3)]">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="mb-8">
        <BadgeGrid userId="local-user" compact />
      </div>

      <div className="flex gap-2 mb-6">
        {[
          { id: 'active', label: `${t('vault.activeClaims')} (${activeClaims.length})` },
          { id: 'hof', label: `${t('vault.hallOfFame')} (${hofClaims.length})` },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as 'active' | 'hof')}
            className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
              tab === t.id
                ? 'bg-[var(--color-text)] text-white'
                : 'bg-[var(--color-surface-2)] text-[var(--color-text-2)] hover:bg-[var(--color-border)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-2xl overflow-hidden">
              <div className="shimmer h-24" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {tab === 'active' ? (
            activeClaims.length === 0 ? (
              <div className="text-center py-16">
                <Target size={32} className="mx-auto mb-3 text-[var(--color-text-3)]" />
                <p className="text-sm text-[var(--color-text-2)]">{t('vault.noActiveClaims')}</p>
              </div>
            ) : (
              activeClaims.map(claim => (
                <VaultClaimRow key={claim.id} claim={claim} onShare={setShareTarget} />
              ))
            )
          ) : (
            hofClaims.length === 0 ? (
              <div className="text-center py-16">
                <Trophy size={32} className="mx-auto mb-3 text-[var(--color-text-3)]" />
                <p className="text-sm text-[var(--color-text-2)]">{t('vault.noValidatedClaims')}</p>
              </div>
            ) : (
              hofClaims.map(claim => (
                <VaultClaimRow key={claim.id} claim={claim} onShare={setShareTarget} />
              ))
            )
          )}
        </div>
      )}

      <AnimatePresence>
        {shareTarget && (
          <ProofOfTasteCard claim={shareTarget} onClose={() => setShareTarget(null)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {newlyEarned.map((ub, i) => (
          <BadgeEarnedToast
            key={ub.id}
            userBadge={ub}
            index={i}
            onDismiss={clearNewlyEarned}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
