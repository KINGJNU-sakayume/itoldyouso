export interface Profile {
  id: string;
  spotify_id: string;
  display_name: string;
  avatar_url: string;
  spotify_url: string;
  claims_this_month: number;
  last_claim_reset: string;
  created_at: string;
  updated_at: string;
}

export interface Claim {
  id: string;
  user_id: string;
  spotify_artist_id: string;
  artist_name: string;
  artist_image_url: string;
  track_id: string;
  track_name: string;
  album_cover_url: string;
  genres: string[];
  entry_listeners: number;
  entry_playcount: number;
  current_listeners: number;
  current_playcount: number;
  vibe_index: number;
  insight: string;
  is_validated: boolean;
  validated_at: string | null;
  respect_count: number;
  is_pioneer: boolean;
  youtube_video_id: string | null;
  youtube_video_title: string | null;
  youtube_view_count: number | null;
  youtube_like_count: number | null;
  entry_youtube_view_count: number | null;
  entry_youtube_like_count: number | null;
  created_at: string;
  updated_at: string;
  profile?: Profile;
  has_respected?: boolean;
}

export interface ArtistSnapshot {
  id: string;
  claim_id: string;
  spotify_artist_id: string;
  listeners: number;
  playcount: number;
  vibe_index: number;
  snapshot_date: string;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

export interface UserBadge {
  id: string;
  user_id: string;
  badge_id: string;
  claim_id: string | null;
  earned_at: string;
  badge?: Badge;
  claim?: Claim;
}

export interface SpotifyUser {
  id: string;
  display_name: string;
  email: string;
  images: { url: string }[];
  external_urls: { spotify: string };
}

export interface SpotifyArtist {
  id: string;
  name: string;
  images: { url: string; width: number; height: number }[];
  genres: string[];
  external_urls: { spotify: string };
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: { id: string; name: string }[];
  album: {
    id: string;
    name: string;
    images: { url: string; width: number; height: number }[];
  };
  popularity: number;
  preview_url: string | null;
  external_urls: { spotify: string };
}

export interface SpotifySearchResult {
  tracks: {
    items: SpotifyTrack[];
  };
  artists: {
    items: SpotifyArtist[];
  };
}

export type BadgeRarity = 'common' | 'rare' | 'epic' | 'legendary';

export const CLAIMS_PER_MONTH = 5;
export const VALIDATION_THRESHOLD = 50;
export const PIONEER_CHECK = true;

export const MAX_YOUTUBE_VIEWS_FOR_CLAIM = 5_000_000;
export const MAX_YOUTUBE_LIKES_FOR_CLAIM = 100_000;
export const MAX_LASTFM_LISTENERS_FOR_CLAIM = 1_000_000;
