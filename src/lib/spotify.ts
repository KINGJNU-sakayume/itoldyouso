import type { SpotifyUser, SpotifyArtist, SpotifyTrack, SpotifySearchResult } from '../types';

const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID as string;
const REDIRECT_URI = import.meta.env.VITE_SPOTIFY_REDIRECT_URI || `${window.location.origin}/callback`;

const SCOPES = [
  'user-read-private',
  'user-read-email',
  'user-top-read',
  'playlist-read-private',
].join(' ');

function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const randomValues = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(randomValues).map(v => chars[v % chars.length]).join('');
}

async function generateCodeChallenge(codeVerifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

export async function initiateSpotifyLogin(): Promise<void> {
  const codeVerifier = generateRandomString(128);
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = generateRandomString(16);

  localStorage.setItem('spotify_code_verifier', codeVerifier);
  localStorage.setItem('spotify_auth_state', state);

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
    state,
    scope: SCOPES,
  });

  window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
}

export async function exchangeCodeForToken(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const codeVerifier = localStorage.getItem('spotify_code_verifier');
  if (!codeVerifier) throw new Error('No code verifier found');

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: codeVerifier,
    }),
  });

  if (!response.ok) throw new Error('Token exchange failed');
  return response.json();
}

export async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
}> {
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) throw new Error('Token refresh failed');
  return response.json();
}

export function getStoredToken(): string | null {
  const expiry = localStorage.getItem('spotify_token_expiry');
  if (!expiry || Date.now() > parseInt(expiry)) return null;
  return localStorage.getItem('spotify_access_token');
}

export function storeTokens(accessToken: string, refreshToken: string, expiresIn: number): void {
  localStorage.setItem('spotify_access_token', accessToken);
  localStorage.setItem('spotify_refresh_token', refreshToken);
  localStorage.setItem('spotify_token_expiry', String(Date.now() + expiresIn * 1000 - 60000));
}

export function clearTokens(): void {
  localStorage.removeItem('spotify_access_token');
  localStorage.removeItem('spotify_refresh_token');
  localStorage.removeItem('spotify_token_expiry');
  localStorage.removeItem('spotify_code_verifier');
  localStorage.removeItem('spotify_auth_state');
}

export async function apiRequestBatch<T>(endpoint: string, token: string): Promise<T> {
  const response = await fetch(`https://api.spotify.com/v1${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (response.status === 401) throw new Error('UNAUTHORIZED');
  if (!response.ok) throw new Error(`Spotify API error: ${response.status}`);
  return response.json();
}

async function apiRequest<T>(endpoint: string, token: string): Promise<T> {
  const response = await fetch(`https://api.spotify.com/v1${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (response.status === 401) throw new Error('UNAUTHORIZED');
  if (!response.ok) throw new Error(`Spotify API error: ${response.status}`);
  return response.json();
}

export async function getSpotifyUser(token: string): Promise<SpotifyUser> {
  return apiRequest<SpotifyUser>('/me', token);
}

export async function searchSpotify(query: string, token: string): Promise<SpotifySearchResult> {
  const params = new URLSearchParams({ q: query, type: 'track,artist', limit: '10' });
  return apiRequest<SpotifySearchResult>(`/search?${params}`, token);
}

export async function getArtist(artistId: string, token: string): Promise<SpotifyArtist> {
  return apiRequest<SpotifyArtist>(`/artists/${artistId}`, token);
}

export async function getTrack(trackId: string, token: string): Promise<SpotifyTrack> {
  return apiRequest<SpotifyTrack>(`/tracks/${trackId}`, token);
}

export function computeVibeIndex(
  currentPopularity: number,
  entryPopularity: number,
  currentFollowers: number,
  entryFollowers: number
): number {
  const popularityGrowth = entryPopularity > 0
    ? (currentPopularity - entryPopularity) / entryPopularity
    : currentPopularity / 100;

  const followerGrowth = entryFollowers > 0
    ? (currentFollowers - entryFollowers) / entryFollowers
    : 0;

  return Math.round(((popularityGrowth * 0.4) + (followerGrowth * 0.6)) * 100);
}
