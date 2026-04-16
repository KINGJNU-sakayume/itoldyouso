import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Music, Loader2, CheckCircle2, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { SpotifyTrack } from '../../types';
import { searchSpotify } from '../../lib/spotify';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

type SearchResult = {
  track: SpotifyTrack;
  artistName: string;
  artistId: string;
};

type Step = 'spotify' | 'insight';

export default function NewClaimModal({ onClose, onSuccess }: Props) {
  const { accessToken } = useAuthStore();
  const { t } = useTranslation();

  const [step, setStep] = useState<Step>('spotify');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [insight, setInsight] = useState('');
  const [manualListeners, setManualListeners] = useState<number | ''>('');
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim() || !accessToken) return;
    setIsSearching(true);
    try {
      const data = await searchSpotify(q, accessToken);
      const tracks = data.tracks?.items || [];
      const results: SearchResult[] = tracks.slice(0, 8).map((track) => ({
        track,
        artistName: track.artists[0]?.name || '',
        artistId: track.artists[0]?.id || '',
      })).filter(r => r.artistName);
      setResults(results);
    } catch {
      setError(t('newClaim.errorSearchFailed'));
    } finally {
      setIsSearching(false);
    }
  }, [accessToken, t]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (query.length < 2) { setResults([]); return; }
    debounceRef.current = setTimeout(() => doSearch(query), 400);
    return () => clearTimeout(debounceRef.current);
  }, [query, doSearch]);

  const handleSelectTrack = (result: SearchResult) => {
    setSelected(result);
    setQuery('');
    setResults([]);
    setStep('insight');
  };

  const handleSubmit = async () => {
    if (!selected || !insight.trim() || !accessToken) return;
    if (insight.trim().length < 20) {
      setError(t('newClaim.errorMinChars'));
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const { track, artistName, artistId } = selected;

      const { data: pioneerCheck } = await supabase
        .from('claims')
        .select('id')
        .eq('spotify_artist_id', artistId)
        .maybeSingle();

      const isPioneer = !pioneerCheck;

      const listenersValue = typeof manualListeners === 'number' ? manualListeners : 0;

      const { data: claimData, error: claimError } = await supabase
        .from('claims')
        .insert({
          user_id: 'local-user',
          spotify_artist_id: artistId,
          artist_name: artistName,
          artist_image_url: track.album?.images?.[0]?.url || '',
          track_id: track.id,
          track_name: track.name,
          album_cover_url: track.album?.images?.[0]?.url || '',
          genres: [],
          entry_listeners: listenersValue,
          entry_playcount: 0,
          current_listeners: listenersValue,
          current_playcount: 0,
          vibe_index: 0,
          insight: insight.trim(),
          is_pioneer: isPioneer,
          youtube_video_id: null,
          youtube_video_title: null,
          youtube_view_count: null,
          youtube_like_count: null,
          entry_youtube_view_count: null,
          entry_youtube_like_count: null,
        })
        .select()
        .single();

      if (claimError) throw claimError;

      await supabase.from('artist_snapshots').insert({
        claim_id: claimData.id,
        spotify_artist_id: artistId,
        listeners: listenersValue,
        playcount: 0,
        vibe_index: 0,
      });

      setSubmitted(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch {
      setError(t('newClaim.errorSubmitFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        />

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="relative w-full sm:max-w-xl bg-white rounded-t-3xl sm:rounded-3xl overflow-hidden max-h-[92vh] flex flex-col"
        >
          {submitted ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="w-16 h-16 rounded-full bg-[var(--color-validated-light)] flex items-center justify-center mb-4"
              >
                <CheckCircle2 size={32} style={{ color: 'var(--color-validated)' }} />
              </motion.div>
              <h3 className="text-2xl font-bold text-[var(--color-text)] mb-2">{t('newClaim.claimRegistered')}</h3>
              <p className="text-sm text-[var(--color-text-2)]">{t('newClaim.claimRegisteredDesc')}</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[var(--color-border)]">
                <div>
                  <h2 className="text-xl font-bold text-[var(--color-text)]">{t('newClaim.title')}</h2>
                </div>

                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full hover:bg-[var(--color-surface-2)] flex items-center justify-center transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="overflow-y-auto flex-1 scrollbar-none">
                <AnimatePresence mode="wait">
                  {step === 'spotify' && (
                    <motion.div
                      key="spotify"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="p-6 space-y-5"
                    >
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-3)] mb-2">
                          {t('newClaim.searchPlaceholder')}
                        </label>
                        <div className="relative">
                          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-3)]" />
                          <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={t('newClaim.searchHint')}
                            className="w-full pl-9 pr-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-3)]"
                            autoFocus
                          />
                          {isSearching && (
                            <Loader2 size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-3)] animate-spin" />
                          )}
                        </div>
                      </div>

                      <AnimatePresence>
                        {results.length > 0 && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="space-y-2"
                          >
                            {results.map((result) => (
                              <button
                                key={result.track.id}
                                onClick={() => handleSelectTrack(result)}
                                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-[var(--color-surface-2)] transition-colors text-left group"
                              >
                                <img
                                  src={result.track.album?.images?.[2]?.url || result.track.album?.images?.[0]?.url}
                                  alt={result.track.album?.name}
                                  className="w-12 h-12 rounded-lg object-cover"
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-[var(--color-text)] truncate">{result.track.name}</p>
                                  <p className="text-xs text-[var(--color-text-3)] truncate">{result.artistName}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="text-right shrink-0">
                                    <p className="text-xs text-[var(--color-text-3)]">{t('newClaim.selectToSeeStats')}</p>
                                  </div>
                                  <ChevronRight size={14} className="text-[var(--color-text-3)] opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {!results.length && !isSearching && (
                        <div className="text-center py-8">
                          <Music size={32} className="mx-auto mb-3 text-[var(--color-text-3)]" />
                          <p className="text-sm text-[var(--color-text-3)]">{t('newClaim.searchPrompt')}</p>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {step === 'insight' && selected && (
                    <motion.div
                      key="insight"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="p-6 space-y-4"
                    >
                      <div className="flex items-center gap-3 p-3 rounded-2xl bg-[var(--color-surface-2)]">
                        <img
                          src={selected.track.album?.images?.[2]?.url || selected.track.album?.images?.[0]?.url}
                          alt={selected.track.album?.name}
                          className="w-10 h-10 rounded-lg object-cover"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[var(--color-text)] truncate">{selected.track.name}</p>
                          <p className="text-xs text-[var(--color-text-3)] truncate">{selected.artistName}</p>
                        </div>
                        <button
                          onClick={() => { setSelected(null); setStep('spotify'); }}
                          className="p-1.5 rounded-lg hover:bg-[var(--color-border)] transition-colors"
                        >
                          <X size={12} className="text-[var(--color-text-3)]" />
                        </button>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-3)] mb-2">
                          {t('newClaim.listenersLabel')}
                          <span className="normal-case tracking-normal font-normal ml-2 text-[var(--color-text-3)]">
                            {t('newClaim.listenersHint')}
                          </span>
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={manualListeners}
                          onChange={(e) => setManualListeners(e.target.value === '' ? '' : Number(e.target.value))}
                          placeholder={t('newClaim.listenersPlaceholder')}
                          className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-3)]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-3)] mb-2">
                          {t('newClaim.insightLabel')}
                          <span className="normal-case tracking-normal font-normal ml-2 text-[var(--color-text-3)]">
                            {t('newClaim.insightHint')}
                          </span>
                        </label>
                        <textarea
                          value={insight}
                          onChange={(e) => setInsight(e.target.value)}
                          placeholder={t('newClaim.insightPlaceholder')}
                          rows={4}
                          className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-3)] resize-none"
                          autoFocus
                        />
                        <div className="flex justify-between mt-1">
                          <p className="text-xs text-[var(--color-text-3)]">
                            {insight.length < 20 ? `${20 - insight.length} ${t('newClaim.moreCharsNeeded')}` : t('newClaim.looksGood')}
                          </p>
                          <p className="text-xs text-[var(--color-text-3)]">{insight.length}/300</p>
                        </div>
                      </div>

                      {error && (
                        <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="px-6 py-4 border-t border-[var(--color-border)] bg-white flex gap-3">
                {step === 'insight' && (
                  <button
                    onClick={handleSubmit}
                    disabled={!selected || insight.length < 20 || isSubmitting}
                    className="flex-1 btn-primary justify-center disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        {t('newClaim.registering')}
                      </>
                    ) : (
                      t('newClaim.stakeClaim')
                    )}
                  </button>
                )}
              </div>
            </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
