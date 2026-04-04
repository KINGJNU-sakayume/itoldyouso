import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Music, Loader2, CheckCircle2, Youtube, Eye, ThumbsUp, ChevronRight, ChevronLeft, AlertCircle, Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { SpotifyTrack } from '../../types';
import { searchSpotify } from '../../lib/spotify';
import { getLastFmArtistInfo, parseLastFmCount, getLastFmImageUrl, type LastFmArtist } from '../../lib/lastfm';
import { searchYouTubeVideos, formatCount, type YouTubeVideo } from '../../lib/youtube';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { CLAIMS_PER_MONTH, MAX_YOUTUBE_VIEWS_FOR_CLAIM, MAX_YOUTUBE_LIKES_FOR_CLAIM, MAX_LASTFM_LISTENERS_FOR_CLAIM } from '../../types';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

type SearchResult = {
  track: SpotifyTrack;
  artistName: string;
  artistId: string;
};

type Step = 'spotify' | 'youtube' | 'insight';

export default function NewClaimModal({ onClose, onSuccess }: Props) {
  const { profile, accessToken } = useAuthStore();
  const { t } = useTranslation();

  const [step, setStep] = useState<Step>('spotify');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [youtubeVideos, setYoutubeVideos] = useState<YouTubeVideo[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<YouTubeVideo | null>(null);
  const [isLoadingYoutube, setIsLoadingYoutube] = useState(false);
  const [youtubeError, setYoutubeError] = useState('');
  const [insight, setInsight] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [lastFmArtist, setLastFmArtist] = useState<LastFmArtist | null>(null);
  const [isLoadingLastFm, setIsLoadingLastFm] = useState(false);
  const [lastFmError, setLastFmError] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const remainingClaims = profile ? CLAIMS_PER_MONTH - profile.claims_this_month : 0;
  const hasYoutubeKey = !!import.meta.env.VITE_YOUTUBE_API_KEY;
  const hasLastFmKey = !!import.meta.env.VITE_LASTFM_API_KEY;

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

  const handleSelectTrack = async (result: SearchResult) => {
    setSelected(result);
    setQuery('');
    setResults([]);
    setLastFmArtist(null);
    setLastFmError('');

    // Fetch Last.fm artist data
    if (hasLastFmKey) {
      setIsLoadingLastFm(true);
      try {
        const lfm = await getLastFmArtistInfo(result.artistName);
        setLastFmArtist(lfm);
      } catch {
        setLastFmError(t('lastfm.error'));
      } finally {
        setIsLoadingLastFm(false);
      }
    }

    if (!hasYoutubeKey) {
      setStep('insight');
      return;
    }

    setStep('youtube');
    setIsLoadingYoutube(true);
    setYoutubeError('');
    try {
      const videos = await searchYouTubeVideos(result.track.name, result.artistName);
      setYoutubeVideos(videos);
    } catch {
      setYoutubeError(t('newClaim.youtubeSearchFailed'));
    } finally {
      setIsLoadingYoutube(false);
    }
  };

  const isTooFamous = (video: YouTubeVideo): boolean => {
    return video.viewCount > MAX_YOUTUBE_VIEWS_FOR_CLAIM || video.likeCount > MAX_YOUTUBE_LIKES_FOR_CLAIM;
  };

  const isTooFamousOnLastFm = (artist: LastFmArtist | null): boolean => {
    if (!artist) return false;
    return parseLastFmCount(artist.stats.listeners) > MAX_LASTFM_LISTENERS_FOR_CLAIM;
  };

  const handleSelectVideo = (video: YouTubeVideo) => {
    if (isTooFamous(video)) return;
    setSelectedVideo(video);
    setStep('insight');
  };

  const handleSubmit = async () => {
    if (!selected || !insight.trim() || !profile || !accessToken) return;
    if (insight.trim().length < 20) {
      setError(t('newClaim.errorMinChars'));
      return;
    }
    if (remainingClaims <= 0) {
      setError(t('newClaim.errorQuotaExceeded'));
      return;
    }
    if (hasYoutubeKey && !selectedVideo) {
      setError(t('newClaim.errorYoutubeRequired'));
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

      const entryListeners = lastFmArtist ? parseLastFmCount(lastFmArtist.stats.listeners) : 0;
      const entryPlaycount = lastFmArtist ? parseLastFmCount(lastFmArtist.stats.playcount) : 0;
      const artistImageUrl = lastFmArtist
        ? getLastFmImageUrl(lastFmArtist.image, 'extralarge') || track.album?.images?.[0]?.url || ''
        : track.album?.images?.[0]?.url || '';
      const genres = lastFmArtist?.tags?.tag?.map(tag => tag.name) || [];

      const { data: claimData, error: claimError } = await supabase
        .from('claims')
        .insert({
          user_id: profile.id,
          spotify_artist_id: artistId,
          artist_name: artistName,
          artist_image_url: artistImageUrl,
          track_id: track.id,
          track_name: track.name,
          album_cover_url: track.album?.images?.[0]?.url || '',
          genres,
          entry_listeners: entryListeners,
          entry_playcount: entryPlaycount,
          current_listeners: entryListeners,
          current_playcount: entryPlaycount,
          vibe_index: 0,
          insight: insight.trim(),
          is_pioneer: isPioneer,
          youtube_video_id: selectedVideo?.id || null,
          youtube_video_title: selectedVideo?.title || null,
          youtube_view_count: selectedVideo?.viewCount ?? null,
          youtube_like_count: selectedVideo?.likeCount ?? null,
          entry_youtube_view_count: selectedVideo?.viewCount ?? null,
          entry_youtube_like_count: selectedVideo?.likeCount ?? null,
        })
        .select()
        .single();

      if (claimError) throw claimError;

      await supabase.from('artist_snapshots').insert({
        claim_id: claimData.id,
        spotify_artist_id: artistId,
        listeners: entryListeners,
        playcount: entryPlaycount,
        vibe_index: 0,
      });

      const now = new Date();
      const lastReset = new Date(profile.last_claim_reset);
      const sameMonth = now.getMonth() === lastReset.getMonth() && now.getFullYear() === lastReset.getFullYear();

      if (sameMonth) {
        await supabase
          .from('profiles')
          .update({ claims_this_month: profile.claims_this_month + 1 })
          .eq('id', profile.id);
      } else {
        await supabase
          .from('profiles')
          .update({ claims_this_month: 1, last_claim_reset: now.toISOString() })
          .eq('id', profile.id);
      }

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

  const stepLabels: Record<Step, string> = {
    spotify: '1',
    youtube: '2',
    insight: '3',
  };

  const stepOrder: Step[] = hasYoutubeKey ? ['spotify', 'youtube', 'insight'] : ['spotify', 'insight'];

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
                  <p className="text-xs text-[var(--color-text-3)] mt-0.5">
                    {remainingClaims} {t('newClaim.remaining')}
                  </p>
                </div>

                {hasYoutubeKey && (
                  <div className="flex items-center gap-1.5 mr-auto ml-4">
                    {stepOrder.map((s, i) => (
                      <div key={s} className="flex items-center gap-1.5">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-300 ${
                            step === s
                              ? 'bg-[var(--color-primary)] text-white scale-110'
                              : stepOrder.indexOf(step) > i
                              ? 'bg-[var(--color-validated)] text-white'
                              : 'bg-[var(--color-surface-2)] text-[var(--color-text-3)]'
                          }`}
                        >
                          {stepOrder.indexOf(step) > i ? <CheckCircle2 size={12} /> : stepLabels[s]}
                        </div>
                        {i < stepOrder.length - 1 && (
                          <div className={`w-4 h-0.5 rounded transition-all duration-300 ${
                            stepOrder.indexOf(step) > i ? 'bg-[var(--color-validated)]' : 'bg-[var(--color-border)]'
                          }`} />
                        )}
                      </div>
                    ))}
                  </div>
                )}

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

                  {step === 'youtube' && selected && (
                    <motion.div
                      key="youtube"
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
                        {isLoadingLastFm && (
                          <Loader2 size={12} className="text-[var(--color-text-3)] animate-spin shrink-0" />
                        )}
                        {lastFmArtist && isTooFamousOnLastFm(lastFmArtist) && (
                          <span className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg bg-red-50 text-red-600 text-[10px] font-medium">
                            <Lock size={9} />
                            {t('lastfm.tooFamous')}
                          </span>
                        )}
                        {lastFmArtist && !isTooFamousOnLastFm(lastFmArtist) && (
                          <span className="shrink-0 text-[10px] text-[var(--color-text-3)]">
                            {formatCount(parseLastFmCount(lastFmArtist.stats.listeners))} {t('lastfm.listeners')}
                          </span>
                        )}
                        <button
                          onClick={() => { setSelected(null); setStep('spotify'); }}
                          className="p-1.5 rounded-lg hover:bg-[var(--color-border)] transition-colors"
                        >
                          <X size={12} className="text-[var(--color-text-3)]" />
                        </button>
                      </div>

                      {lastFmError && (
                        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-50 text-amber-700 text-[11px]">
                          <AlertCircle size={12} />
                          <span>{lastFmError}</span>
                        </div>
                      )}

                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <Youtube size={16} className="text-red-500" />
                          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-3)]">
                            {t('newClaim.youtubeSelectLabel')}
                          </p>
                        </div>

                        {isLoadingYoutube && (
                          <div className="flex flex-col items-center justify-center py-10 gap-3">
                            <Loader2 size={24} className="animate-spin text-red-500" />
                            <p className="text-xs text-[var(--color-text-3)]">{t('newClaim.youtubeSearching')}</p>
                          </div>
                        )}

                        {youtubeError && !isLoadingYoutube && (
                          <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 text-amber-700 text-xs">
                            <AlertCircle size={14} />
                            <span>{youtubeError}</span>
                          </div>
                        )}

                        {!isLoadingYoutube && !youtubeError && youtubeVideos.length > 0 && (
                          <div className="space-y-2">
                            <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-50 text-amber-700 text-[11px] mb-3">
                              <Lock size={12} className="shrink-0 mt-0.5" />
                              <span>{t('newClaim.youtubeClaimRule')}</span>
                            </div>
                            {youtubeVideos.map((video) => {
                              const tooFamous = isTooFamous(video);
                              return (
                                <button
                                  key={video.id}
                                  onClick={() => handleSelectVideo(video)}
                                  disabled={tooFamous}
                                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left group ${
                                    tooFamous
                                      ? 'border-red-100 bg-red-50 opacity-60 cursor-not-allowed'
                                      : 'border-transparent hover:border-[var(--color-primary-light)] hover:bg-[var(--color-primary-light)]/20'
                                  }`}
                                >
                                  <div className="relative shrink-0">
                                    <img
                                      src={video.thumbnailUrl}
                                      alt={video.title}
                                      className="w-20 h-14 rounded-lg object-cover"
                                    />
                                    {!tooFamous && (
                                      <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Youtube size={18} className="text-white" />
                                      </div>
                                    )}
                                    {tooFamous && (
                                      <div className="absolute inset-0 flex items-center justify-center bg-red-500/20 rounded-lg">
                                        <Lock size={16} className="text-red-500" />
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-[var(--color-text)] line-clamp-2 leading-snug mb-1">{video.title}</p>
                                    <p className="text-[10px] text-[var(--color-text-3)] truncate mb-1.5">{video.channelTitle}</p>
                                    <div className="flex items-center gap-3">
                                      <span className={`flex items-center gap-1 text-[10px] font-medium ${
                                        video.viewCount > MAX_YOUTUBE_VIEWS_FOR_CLAIM ? 'text-red-500' : 'text-[var(--color-text-3)]'
                                      }`}>
                                        <Eye size={10} />
                                        {formatCount(video.viewCount)}
                                        {video.viewCount > MAX_YOUTUBE_VIEWS_FOR_CLAIM && ' — too famous'}
                                      </span>
                                      <span className={`flex items-center gap-1 text-[10px] font-medium ${
                                        video.likeCount > MAX_YOUTUBE_LIKES_FOR_CLAIM ? 'text-red-500' : 'text-[var(--color-text-3)]'
                                      }`}>
                                        <ThumbsUp size={10} />
                                        {formatCount(video.likeCount)}
                                        {video.likeCount > MAX_YOUTUBE_LIKES_FOR_CLAIM && ' — too famous'}
                                      </span>
                                    </div>
                                  </div>
                                  {!tooFamous && (
                                    <ChevronRight size={14} className="text-[var(--color-text-3)] shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {!isLoadingYoutube && youtubeVideos.length === 0 && !youtubeError && (
                          <div className="text-center py-6">
                            <p className="text-xs text-[var(--color-text-3)]">{t('newClaim.youtubeNoResults')}</p>
                          </div>
                        )}
                      </div>
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
                        {selectedVideo ? (
                          <div className="shrink-0 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-red-50">
                            <Youtube size={10} className="text-red-500" />
                            <span className="text-[10px] font-medium text-red-600">{t('newClaim.youtubeLinked')}</span>
                          </div>
                        ) : hasYoutubeKey && (
                          <div className="shrink-0 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-50">
                            <AlertCircle size={10} className="text-amber-500" />
                            <span className="text-[10px] font-medium text-amber-600">{t('newClaim.youtubeRequired')}</span>
                          </div>
                        )}
                      </div>

                      {selectedVideo && (
                        <div className="flex items-center gap-3 p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]">
                          <img
                            src={selectedVideo.thumbnailUrl}
                            alt={selectedVideo.title}
                            className="w-14 h-10 rounded-lg object-cover shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-medium text-[var(--color-text)] line-clamp-1">{selectedVideo.title}</p>
                            <div className="flex items-center gap-3 mt-0.5">
                              <span className="flex items-center gap-1 text-[10px] text-[var(--color-text-3)]">
                                <Eye size={9} />
                                {formatCount(selectedVideo.viewCount)}
                              </span>
                              <span className="flex items-center gap-1 text-[10px] text-[var(--color-text-3)]">
                                <ThumbsUp size={9} />
                                {formatCount(selectedVideo.likeCount)}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => { setSelectedVideo(null); setStep('youtube'); }}
                            className="p-1.5 rounded-lg hover:bg-[var(--color-border)] transition-colors"
                          >
                            <X size={12} className="text-[var(--color-text-3)]" />
                          </button>
                        </div>
                      )}

                      {lastFmArtist && (
                        <div className="flex items-center gap-3 p-2.5 rounded-xl bg-[var(--color-surface-2)] text-xs">
                          <span className="text-[var(--color-text-3)]">{t('lastfm.entryListeners')}:</span>
                          <span className="font-semibold text-[var(--color-text)]">
                            {formatCount(parseLastFmCount(lastFmArtist.stats.listeners))}
                          </span>
                          {isTooFamousOnLastFm(lastFmArtist) && (
                            <span className="flex items-center gap-1 text-red-500 text-[10px]">
                              <Lock size={9} />
                              {t('lastfm.tooFamous')}
                            </span>
                          )}
                        </div>
                      )}

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
                {step === 'insight' && hasYoutubeKey && (
                  <button
                    onClick={() => setStep('youtube')}
                    className="flex items-center gap-1.5 px-4 py-3 rounded-xl border border-[var(--color-border)] text-sm font-medium text-[var(--color-text-2)] hover:bg-[var(--color-surface-2)] transition-colors"
                  >
                    <ChevronLeft size={16} />
                    {t('newClaim.back')}
                  </button>
                )}

                {step === 'insight' && (
                  <button
                    onClick={handleSubmit}
                    disabled={!selected || insight.length < 20 || isSubmitting || remainingClaims <= 0 || (hasYoutubeKey && !selectedVideo)}
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
