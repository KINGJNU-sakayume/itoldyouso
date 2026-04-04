import { create } from 'zustand';
import type { Badge, UserBadge, Claim, Profile } from '../types';
import { supabase } from '../lib/supabase';

interface BadgeState {
  allBadges: Badge[];
  userBadges: UserBadge[];
  newlyEarned: UserBadge[];
  fetchBadges: () => Promise<void>;
  fetchUserBadges: (userId: string) => Promise<void>;
  checkAndAwardBadges: (profile: Profile, claims: Claim[]) => Promise<UserBadge[]>;
  clearNewlyEarned: () => void;
}

async function awardBadge(userId: string, badgeId: string, claimId?: string): Promise<UserBadge | null> {
  const { data, error } = await supabase
    .from('user_badges')
    .insert({ user_id: userId, badge_id: badgeId, claim_id: claimId || null })
    .select('*, badge:badges(*)')
    .maybeSingle();

  if (error) return null;
  return data;
}

export const useBadgeStore = create<BadgeState>((set, get) => ({
  allBadges: [],
  userBadges: [],
  newlyEarned: [],

  fetchBadges: async () => {
    const { data } = await supabase.from('badges').select('*');
    if (data) set({ allBadges: data });
  },

  fetchUserBadges: async (userId: string) => {
    const { data } = await supabase
      .from('user_badges')
      .select('*, badge:badges(*), claim:claims(*)')
      .eq('user_id', userId)
      .order('earned_at', { ascending: false });
    if (data) set({ userBadges: data });
  },

  checkAndAwardBadges: async (profile: Profile, claims: Claim[]): Promise<UserBadge[]> => {
    const { userBadges } = get();
    const earnedIds = new Set(userBadges.map(ub => ub.badge_id));
    const newlyEarned: UserBadge[] = [];

    const award = async (badgeId: string, claimId?: string) => {
      if (earnedIds.has(badgeId)) return;
      const badge = await awardBadge(profile.id, badgeId, claimId);
      if (badge) {
        earnedIds.add(badgeId);
        newlyEarned.push(badge);
      }
    };

    const validatedClaims = claims.filter(c => c.is_validated);
    const totalRespects = claims.reduce((sum, c) => sum + c.respect_count, 0);
    const allGenres = [...new Set(claims.flatMap(c => c.genres))];
    const now = new Date();

    if (claims.length >= 1) await award('first_blood', claims[0]?.id);

    const pioneerClaim = claims.find(c => c.is_pioneer);
    if (pioneerClaim) await award('pioneer', pioneerClaim.id);

    const undergroundClaim = claims.find(c =>
      c.entry_youtube_view_count != null
        ? c.entry_youtube_view_count < 100_000
        : c.entry_listeners < 100_000
    );
    if (undergroundClaim) await award('underground_oxygen', undergroundClaim.id);

    const deepDiverClaim = claims.find(c =>
      c.entry_youtube_like_count != null
        ? c.entry_youtube_like_count < 1_000
        : c.entry_playcount < 10_000
    );
    if (deepDiverClaim) await award('deep_diver', deepDiverClaim.id);

    if (allGenres.length >= 5) await award('genre_explorer');
    if (allGenres.length >= 10) await award('sound_architect');

    const tenxClaim = claims.find(c => c.vibe_index >= 1000);
    if (tenxClaim) await award('thousand_percent_club', tenxClaim.id);

    const fivexClaim = claims.find(c => c.vibe_index >= 500);
    if (fivexClaim) await award('moonshot', fivexClaim.id);

    const trendsetterClaim = claims.find(c => c.vibe_index >= 1000);
    if (trendsetterClaim) await award('trendsetter_legacy', trendsetterClaim.id);

    const rocketFuelClaim = claims.find(c => {
      if (c.entry_youtube_view_count == null || c.youtube_view_count == null) return false;
      if (c.entry_youtube_view_count === 0) return false;
      const daysSinceClaim = (now.getTime() - new Date(c.created_at).getTime()) / (1000 * 60 * 60 * 24);
      const growth = (c.youtube_view_count - c.entry_youtube_view_count) / c.entry_youtube_view_count;
      return daysSinceClaim <= 30 && growth >= 1.0;
    });
    if (rocketFuelClaim) await award('rocket_fuel', rocketFuelClaim.id);

    const viralCatalystClaim = claims.find(c => {
      if (c.entry_youtube_view_count == null || c.youtube_view_count == null) return false;
      if (c.entry_youtube_view_count === 0) return false;
      const daysSinceClaim = (now.getTime() - new Date(c.created_at).getTime()) / (1000 * 60 * 60 * 24);
      const growth = (c.youtube_view_count - c.entry_youtube_view_count) / c.entry_youtube_view_count;
      return daysSinceClaim <= 90 && growth >= 5.0;
    });
    if (viralCatalystClaim) await award('viral_catalyst', viralCatalystClaim.id);

    if (validatedClaims.length >= 10) await award('trend_whisperer');
    if (validatedClaims.length >= 20) await award('clairvoyant');

    const successRate = claims.length > 0 ? validatedClaims.length / claims.length : 0;
    if (claims.length >= 5 && successRate >= 0.8) await award('the_oracle');

    const culturalClaim = claims.find(c => c.respect_count >= 100);
    if (culturalClaim) await award('cultural_curator', culturalClaim.id);

    const tastemakerClaim = claims.find(c => c.respect_count >= 50);
    if (tastemakerClaim) await award('tastemaker', tastemakerClaim.id);

    if (totalRespects >= 500) await award('respected_voice');
    if (totalRespects >= 1000) await award('community_pillar');
    if (totalRespects >= 5000) await award('icon');

    const totalVibeGrowth = claims.reduce((sum, c) => sum + c.vibe_index, 0);
    if (totalVibeGrowth >= 1000) await award('grand_master');

    if (validatedClaims.length >= 3) await award('hat_trick');

    const currentBadgeCount = earnedIds.size;
    if (currentBadgeCount >= 10) await award('legendary_taste');

    const midnightClaim = claims.find(c => {
      const h = new Date(c.created_at).getHours();
      return h >= 2 && h < 4;
    });
    if (midnightClaim) await award('midnight_finder', midnightClaim.id);

    const earlyBirdClaim = claims.find(c => {
      const d = new Date(c.created_at);
      return d.getDate() === 1 && d.getHours() < 1;
    });
    if (earlyBirdClaim) await award('early_bird', earlyBirdClaim.id);

    const owlClaims = claims.filter(c => {
      const h = new Date(c.created_at).getHours();
      return h >= 0 && h < 6;
    });
    if (owlClaims.length >= 10) await award('night_owl');

    const accountAge = (now.getTime() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24);
    if (accountAge >= 180) await award('loyal_scout');
    if (accountAge >= 365) await award('the_veteran');

    if (validatedClaims.length >= 5) await award('prophetic_vision');
    if (validatedClaims.length >= 3) await award('perfect_record');

    if (newlyEarned.length > 0) {
      const { userBadges: prev } = get();
      set({ userBadges: [...newlyEarned, ...prev], newlyEarned });
    }

    return newlyEarned;
  },

  clearNewlyEarned: () => set({ newlyEarned: [] }),
}));
