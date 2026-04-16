import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Filter, Sparkles, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import type { Claim } from '../types';
import { useAuthStore } from '../store/authStore';
import ClaimCard from '../components/feed/ClaimCard';
import NewClaimModal from '../components/feed/NewClaimModal';
import ProofOfTasteCard from '../components/card-generator/ProofOfTasteCard';

type FilterType = 'all' | 'validated' | 'pioneer' | 'trending';

export default function Home() {
  const { accessToken } = useAuthStore();
  const { t } = useTranslation();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [showNewClaim, setShowNewClaim] = useState(false);
  const [shareTarget, setShareTarget] = useState<Claim | null>(null);

  const fetchClaims = useCallback(async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('claims')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(60);

      if (filter === 'validated') query = query.eq('is_validated', true);
      if (filter === 'pioneer') query = query.eq('is_pioneer', true);
      if (filter === 'trending') query = query.order('vibe_index', { ascending: false });

      const { data } = await query;
      if (!data) return;

      let enrichedClaims = data as Claim[];

      if (accessToken) {
        const { data: respects } = await supabase
          .from('respects')
          .select('claim_id')
          .eq('user_id', 'local-user');

        const respectedIds = new Set((respects || []).map(r => r.claim_id));
        enrichedClaims = enrichedClaims.map(c => ({
          ...c,
          has_respected: respectedIds.has(c.id),
        }));
      }

      setClaims(enrichedClaims);
    } finally {
      setIsLoading(false);
    }
  }, [filter, accessToken]);

  useEffect(() => { fetchClaims(); }, [fetchClaims]);

  const FILTERS: { id: FilterType; label: string }[] = [
    { id: 'all', label: t('home.filterAll') },
    { id: 'validated', label: t('home.filterValidated') },
    { id: 'pioneer', label: t('home.filterPioneers') },
    { id: 'trending', label: t('home.filterRising') },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-8">
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-[var(--color-text)]">{t('home.title')}</h1>
          <p className="text-sm text-[var(--color-text-3)] mt-1">
            {claims.length} {t('home.claimsTracked')}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchClaims}
            className="p-2.5 rounded-xl hover:bg-[var(--color-surface-2)] transition-colors text-[var(--color-text-3)]"
          >
            <RefreshCw size={16} />
          </button>
          {accessToken && (
            <button
              onClick={() => setShowNewClaim(true)}
              className="btn-primary"
            >
              <Plus size={16} />
              {t('home.newClaim')}
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 mb-8 overflow-x-auto scrollbar-none pb-1">
        <Filter size={14} className="text-[var(--color-text-3)] shrink-0" />
        {FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
              filter === f.id
                ? 'bg-[var(--color-text)] text-white'
                : 'bg-[var(--color-surface-2)] text-[var(--color-text-2)] hover:bg-[var(--color-border)]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="masonry-grid">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="masonry-item">
              <div className="rounded-2xl overflow-hidden">
                <div className="shimmer aspect-square" />
                <div className="p-4 bg-white space-y-2">
                  <div className="shimmer h-3 w-3/4 rounded" />
                  <div className="shimmer h-3 w-1/2 rounded" />
                  <div className="shimmer h-10 rounded-xl" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : claims.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-24 text-center"
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: 'var(--color-primary-light)' }}
          >
            <Sparkles size={28} style={{ color: 'var(--color-primary)' }} />
          </div>
          <h3 className="text-xl font-bold text-[var(--color-text)] mb-2">
            {filter === 'all' ? t('home.noClaimsYet') : t('home.noMatches')}
          </h3>
          <p className="text-sm text-[var(--color-text-2)] max-w-xs">
            {filter === 'all' && accessToken
              ? t('home.noClaimsDesc')
              : t('home.noMatchesDesc')}
          </p>
          {filter === 'all' && accessToken && (
            <button
              onClick={() => setShowNewClaim(true)}
              className="btn-primary mt-6"
            >
              <Plus size={16} />
              {t('home.makeFirstClaim')}
            </button>
          )}
        </motion.div>
      ) : (
        <div className="masonry-grid">
          <AnimatePresence>
            {claims.map(claim => (
              <ClaimCard
                key={claim.id}
                claim={claim}
                onUpdate={fetchClaims}
                onShareCard={setShareTarget}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      <AnimatePresence>
        {showNewClaim && (
          <NewClaimModal
            onClose={() => setShowNewClaim(false)}
            onSuccess={() => { fetchClaims(); setShowNewClaim(false); }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {shareTarget && (
          <ProofOfTasteCard
            claim={shareTarget}
            onClose={() => setShareTarget(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
