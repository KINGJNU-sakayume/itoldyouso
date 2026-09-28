import { describe, expect, it } from 'vitest';
import { coverUrl, parseYouTubeId } from './youtube';

describe('parseYouTubeId', () => {
  it.each([
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtube.com/watch?v=dQw4w9WgXcQ&t=42s',
    'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://music.youtube.com/watch?v=dQw4w9WgXcQ&list=RD',
    'https://youtu.be/dQw4w9WgXcQ?si=abc',
    'https://www.youtube.com/shorts/dQw4w9WgXcQ',
    'https://www.youtube.com/embed/dQw4w9WgXcQ',
    'https://www.youtube.com/live/dQw4w9WgXcQ',
    'youtube.com/watch?v=dQw4w9WgXcQ',
    'dQw4w9WgXcQ',
  ])('%s', url => {
    expect(parseYouTubeId(url)).toBe('dQw4w9WgXcQ');
  });

  it.each(['', 'https://vimeo.com/123', 'https://youtube.com/watch?v=short', 'https://youtube.com/@channel', 'not a url'])(
    'rejects %j',
    url => {
      expect(parseYouTubeId(url)).toBeNull();
    },
  );

  it('prefers an explicit cover image over the thumbnail', () => {
    expect(coverUrl({ youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ' })).toContain('/vi/dQw4w9WgXcQ/');
    expect(coverUrl({ youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ', imageUrl: 'https://x/y.jpg' })).toBe('https://x/y.jpg');
    expect(coverUrl({})).toBeNull();
  });
});
