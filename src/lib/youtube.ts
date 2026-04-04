const API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY as string;
const BASE_URL = 'https://www.googleapis.com/youtube/v3';

export interface YouTubeVideo {
  id: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  viewCount: number;
  likeCount: number;
  publishedAt: string;
}

export async function searchYouTubeVideos(
  trackName: string,
  artistName: string
): Promise<YouTubeVideo[]> {
  if (!API_KEY) throw new Error('YouTube API key not configured');

  const query = `${artistName} ${trackName} official`;
  const searchParams = new URLSearchParams({
    part: 'snippet',
    q: query,
    type: 'video',
    maxResults: '6',
    key: API_KEY,
  });

  const searchRes = await fetch(`${BASE_URL}/search?${searchParams}`);
  if (!searchRes.ok) throw new Error(`YouTube search failed: ${searchRes.status}`);

  const searchData = await searchRes.json();
  const videoIds: string[] = (searchData.items || []).map(
    (item: { id: { videoId: string } }) => item.id.videoId
  );

  if (videoIds.length === 0) return [];

  const statsParams = new URLSearchParams({
    part: 'statistics,snippet',
    id: videoIds.join(','),
    key: API_KEY,
  });

  const statsRes = await fetch(`${BASE_URL}/videos?${statsParams}`);
  if (!statsRes.ok) throw new Error(`YouTube stats fetch failed: ${statsRes.status}`);

  const statsData = await statsRes.json();

  return (statsData.items || []).map((item: {
    id: string;
    snippet: {
      title: string;
      channelTitle: string;
      thumbnails: { medium?: { url: string }; default?: { url: string } };
      publishedAt: string;
    };
    statistics: {
      viewCount?: string;
      likeCount?: string;
    };
  }) => ({
    id: item.id,
    title: item.snippet.title,
    channelTitle: item.snippet.channelTitle,
    thumbnailUrl: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || '',
    viewCount: parseInt(item.statistics?.viewCount || '0', 10),
    likeCount: parseInt(item.statistics?.likeCount || '0', 10),
    publishedAt: item.snippet.publishedAt,
  }));
}

export function formatCount(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}
