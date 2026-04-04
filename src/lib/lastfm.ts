const API_KEY = import.meta.env.VITE_LASTFM_API_KEY as string;
const BASE_URL = 'https://ws.audioscrobbler.com/2.0/';

export interface LastFmArtist {
  name: string;
  mbid: string;
  url: string;
  image: { '#text': string; size: 'small' | 'medium' | 'large' | 'extralarge' | 'mega' }[];
  stats: {
    listeners: string;
    playcount: string;
  };
  tags: { tag: { name: string; url: string }[] };
  bio?: { summary: string; content: string };
}

export interface LastFmSearchResult {
  name: string;
  listeners: string;
  mbid: string;
  url: string;
  image: { '#text': string; size: string }[];
}

export async function getLastFmArtistInfo(artistName: string): Promise<LastFmArtist> {
  if (!API_KEY) throw new Error('Last.fm API key not configured');
  const params = new URLSearchParams({
    method: 'artist.getInfo',
    artist: artistName,
    api_key: API_KEY,
    format: 'json',
    autocorrect: '1',
  });
  const res = await fetch(`${BASE_URL}?${params}`);
  if (!res.ok) throw new Error(`Last.fm API error: ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(`Last.fm error ${data.error}: ${data.message}`);
  return data.artist as LastFmArtist;
}

export async function searchLastFmArtists(query: string): Promise<LastFmSearchResult[]> {
  if (!API_KEY) throw new Error('Last.fm API key not configured');
  const params = new URLSearchParams({
    method: 'artist.search',
    artist: query,
    api_key: API_KEY,
    format: 'json',
    limit: '5',
  });
  const res = await fetch(`${BASE_URL}?${params}`);
  if (!res.ok) throw new Error(`Last.fm search error: ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(`Last.fm error ${data.error}: ${data.message}`);
  return data.results?.artistmatches?.artist || [];
}

export function parseLastFmCount(value: string | undefined): number {
  if (!value) return 0;
  const n = parseInt(value.replace(/,/g, ''), 10);
  return isNaN(n) ? 0 : n;
}

export function getLastFmImageUrl(
  images: { '#text': string; size: string }[],
  preferredSize: 'extralarge' | 'large' | 'medium' = 'extralarge'
): string {
  const order = ['extralarge', 'mega', 'large', 'medium', 'small'];
  const idx = order.indexOf(preferredSize);
  const attempts = [...order.slice(idx), ...order.slice(0, idx)];
  for (const size of attempts) {
    const img = images.find(i => i.size === size);
    if (img?.['#text']) return img['#text'];
  }
  return '';
}
