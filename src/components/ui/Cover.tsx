import { useState } from 'react';
import type { Claim } from '../../types';
import { coverUrl } from '../../lib/youtube';

type CoverSource = Pick<Claim, 'artist' | 'youtubeUrl' | 'imageUrl'>;

function Fallback({ artist, className }: { artist: string; className: string }) {
  return (
    <div aria-hidden className={`grid place-items-center bg-sunk font-mono text-ink-3 ${className}`}>
      <span className="text-[0.8em] font-medium">{artist.trim().slice(0, 2).toUpperCase()}</span>
    </div>
  );
}

function Img({ src, artist, className }: { src: string; artist: string; className: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <Fallback artist={artist} className={className} />;
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`bg-sunk object-cover ${className}`}
    />
  );
}

/** Cover art from the image URL or the YouTube thumbnail, else the artist's initials. */
export default function Cover({ claim, className = '', large = false }: { claim: CoverSource; className?: string; large?: boolean }) {
  const src = coverUrl(claim, large);
  if (!src) return <Fallback artist={claim.artist} className={className} />;
  return <Img key={src} src={src} artist={claim.artist} className={className} />;
}
