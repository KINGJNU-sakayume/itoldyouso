const ID_RE = /^[\w-]{11}$/;

/** Accepts watch, youtu.be, shorts, embed, live and music.youtube.com links, or a bare id. */
export function parseYouTubeId(input: string | undefined | null): string | null {
  const raw = input?.trim();
  if (!raw) return null;
  if (ID_RE.test(raw)) return raw;

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^(www|m|music)\./, '');
  let id: string | null = null;
  if (host === 'youtu.be') {
    id = url.pathname.split('/')[1] ?? null;
  } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (url.pathname === '/watch') {
      id = url.searchParams.get('v');
    } else {
      const [, kind, rest] = url.pathname.split('/');
      if (['shorts', 'embed', 'live', 'v'].includes(kind)) id = rest ?? null;
    }
  }
  return id && ID_RE.test(id) ? id : null;
}

/** 16:9, no letterbox bars. */
export function youtubeThumb(id: string): string {
  return `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
}

/** 4:3 with bars — crop with object-fit: cover. */
export function youtubeThumbLarge(id: string): string {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

export function youtubeWatchUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`;
}

/** Cover art for a pick: the explicit image, else the YouTube thumbnail. */
export function coverUrl(c: { imageUrl?: string; youtubeUrl?: string }, large = false): string | null {
  if (c.imageUrl) return c.imageUrl;
  const id = parseYouTubeId(c.youtubeUrl);
  if (!id) return null;
  return large ? youtubeThumbLarge(id) : youtubeThumb(id);
}
