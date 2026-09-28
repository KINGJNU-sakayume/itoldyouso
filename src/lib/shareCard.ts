import type { Claim } from '../types';
import { coverUrl } from './youtube';

/**
 * Draws the proof card straight onto a canvas. Fixed light palette so the
 * image looks the same whatever theme the app is in.
 */
export type CardFormat = 'story' | 'square';

export interface CardContent {
  brand: string;
  number: string;
  pickedLabel: string;
  pickedValue: string;
  dPlus: string;
  numbersLabel: string;
  numbersValue: string;
  /** "×3.2" — omitted before the first check-in. */
  big?: string;
  bigSub?: string;
  direction: 'up' | 'down' | 'flat';
  /** Shown instead of the big number when there is no growth yet. */
  pending?: string;
  hitLabel?: string;
  hitDate?: string;
  note?: string;
  footerLeft: string;
  footerRight: string;
}

const C = {
  paper: '#F3F1EC',
  ink: '#161513',
  ink2: '#58544D',
  ink3: '#88837A',
  rule: '#D6D1C7',
  accent: '#CE371E',
  down: '#2654CC',
};
const SANS = '"IBM Plex Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
const MONO = '"IBM Plex Mono", "IBM Plex Sans KR", ui-monospace, Menlo, monospace';

async function ensureFonts(sample: string, timeout = 2500) {
  if (!document.fonts?.load) return;
  // Korean fonts are served in unicode-range slices; passing the text loads the right ones.
  const loads = Promise.allSettled([
    document.fonts.load(`700 80px "IBM Plex Sans KR"`, sample),
    document.fonts.load(`500 40px "IBM Plex Sans KR"`, sample),
    document.fonts.load(`400 40px "IBM Plex Sans KR"`, sample),
    document.fonts.load(`600 80px "IBM Plex Mono"`, sample),
    document.fonts.load(`400 30px "IBM Plex Mono"`, sample),
  ]);
  // A slow font server must not hold the card hostage; fall back to system faces.
  await Promise.race([loads, new Promise(resolve => setTimeout(resolve, timeout))]);
}

function loadImage(src: string, timeout = 6000): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const timer = setTimeout(() => resolve(null), timeout);
    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
    img.src = src;
  });
}

/** Word wrap that falls back to per-character breaks for long words. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const fits = (s: string) => ctx.measureText(s).width <= maxWidth;
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (fits(next)) {
      line = next;
      continue;
    }
    if (line) lines.push(line);
    line = '';
    for (const ch of word) {
      if (line && !fits(line + ch)) {
        lines.push(line);
        line = ch;
      } else line += ch;
    }
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1];
  while (last && !fits(last + '…')) last = last.slice(0, -1);
  kept[maxLines - 1] = last.trimEnd() + '…';
  return kept;
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / img.width, h / img.height);
  const sw = w / scale;
  const sh = h / scale;
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
}

function drawStamp(ctx: CanvasRenderingContext2D, cx: number, cy: number, label: string, sub: string | undefined, size: number) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((-8 * Math.PI) / 180);
  ctx.font = `700 ${size}px ${SANS}`;
  const w = ctx.measureText(label.toUpperCase()).width + size * 0.9;
  const h = size * (sub ? 1.75 : 1.35);
  ctx.strokeStyle = C.accent;
  ctx.fillStyle = C.accent;
  ctx.globalAlpha = 0.93;
  ctx.lineWidth = size * 0.08;
  ctx.strokeRect(-w / 2, -h / 2, w, h);
  ctx.lineWidth = size * 0.035;
  const inset = size * 0.14;
  ctx.strokeRect(-w / 2 + inset, -h / 2 + inset, w - inset * 2, h - inset * 2);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label.toUpperCase(), 0, sub ? -size * 0.2 : size * 0.04);
  if (sub) {
    ctx.font = `400 ${size * 0.3}px ${MONO}`;
    ctx.fillText(sub, 0, size * 0.52);
  }
  ctx.restore();
}

export async function renderShareCard(
  claim: Pick<Claim, 'track' | 'artist' | 'imageUrl' | 'youtubeUrl'>,
  content: CardContent,
  format: CardFormat,
): Promise<{ canvas: HTMLCanvasElement; coverMissing: boolean }> {
  const W = 1080;
  const H = format === 'story' ? 1920 : 1080;
  const M = 88;
  const inner = W - M * 2;
  const story = format === 'story';

  await ensureFonts([claim.track, claim.artist, content.note ?? '', ...Object.values(content)].join(' '));
  const src = story ? coverUrl(claim, true) : null;
  const img = src ? await loadImage(src) : null;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = C.paper;
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = 'alphabetic';

  // Masthead
  let y = story ? 118 : 104;
  ctx.font = `500 28px ${MONO}`;
  ctx.fillStyle = C.ink;
  ctx.textAlign = 'left';
  ctx.fillText(content.brand, M, y);
  ctx.textAlign = 'right';
  ctx.fillStyle = C.ink3;
  ctx.fillText(content.number, W - M, y);
  ctx.textAlign = 'left';
  y += 26;
  ctx.fillStyle = C.ink;
  ctx.fillRect(M, y, inner, 3);
  y += story ? 58 : 70;

  const footerTop = H - (story ? 150 : 120);
  if (img) {
    const h = Math.round((inner * 9) / 16);
    drawCover(ctx, img, M, y, inner, h);
    y += h + 84;
  }

  /** Title through note. With dry = true it only measures, returning the bottom edge. */
  const body = (y0: number, dry: boolean): number => {
    let y = y0;
    const text = (t: string, x: number, yy: number) => !dry && ctx.fillText(t, x, yy);
    const rect = (x: number, yy: number, w: number, h: number) => !dry && ctx.fillRect(x, yy, w, h);

    const titleSize = story ? 88 : 76;
    ctx.font = `700 ${titleSize}px ${SANS}`;
    ctx.fillStyle = C.ink;
    const titleLines = wrap(ctx, claim.track, inner, img || !story ? 2 : 3);
    titleLines.forEach((l, i) => text(l, M, y + i * titleSize * 1.18));
    y += (titleLines.length - 1) * titleSize * 1.18 + (story ? 70 : 62);
    ctx.font = `500 ${story ? 46 : 40}px ${SANS}`;
    ctx.fillStyle = C.ink2;
    text(wrap(ctx, claim.artist, inner, 1)[0] ?? '', M, y);
    y += story ? 58 : 46;
    ctx.fillStyle = C.rule;
    rect(M, y, inner, 2);

    const label = (t: string, yy: number) => {
      ctx.font = `400 26px ${MONO}`;
      ctx.fillStyle = C.ink3;
      text(t.toUpperCase(), M, yy);
    };
    const value = (t: string, yy: number) => {
      ctx.font = `500 42px ${MONO}`;
      ctx.fillStyle = C.ink;
      text(t, M, yy);
    };
    y += story ? 76 : 64;
    label(content.pickedLabel, y);
    y += 54;
    value(content.pickedValue, y);
    ctx.fillStyle = C.ink3;
    text(`  ${content.dPlus}`, M + ctx.measureText(content.pickedValue).width, y);
    y += story ? 78 : 66;
    label(content.numbersLabel, y);
    y += 54;
    ctx.font = `500 42px ${MONO}`;
    value(wrap(ctx, content.numbersValue, inner, 1)[0] ?? '', y);

    // The number
    const bigSize = story ? 232 : 184;
    y += story ? 60 : 44;
    const bigY = y + bigSize * 0.82;
    if (content.big) {
      ctx.font = `600 ${bigSize}px ${MONO}`;
      ctx.fillStyle = content.direction === 'down' ? C.down : content.direction === 'up' ? C.accent : C.ink;
      text(content.big, M - bigSize * 0.04, bigY);
      const bigW = ctx.measureText(content.big).width;
      if (content.bigSub) {
        ctx.font = `500 40px ${MONO}`;
        text(content.bigSub, M, bigY + 66);
      }
      if (content.hitLabel && !dry) {
        const size = (story ? 92 : 78) * (content.hitLabel.length > 4 ? 0.68 : 1);
        ctx.font = `700 ${size}px ${SANS}`;
        const stampW = ctx.measureText(content.hitLabel.toUpperCase()).width + size * 0.9;
        // Beside the number if it fits, otherwise pressed onto its tail like a real stamp.
        const cx = Math.min(W - 44 - stampW / 2, M + bigW + stampW / 2 + 24);
        drawStamp(ctx, cx, bigY - bigSize * 0.36, content.hitLabel, content.hitDate, size);
      }
      y = bigY + (content.bigSub ? 66 : 0);
    } else if (content.pending) {
      ctx.font = `600 ${story ? 64 : 56}px ${SANS}`;
      ctx.fillStyle = C.ink2;
      y += 64;
      text(content.pending, M, y);
    }

    if (story && content.note) {
      y += 104;
      ctx.font = `400 38px ${SANS}`;
      const lh = 56;
      const room = Math.floor((footerTop - 40 - y) / lh);
      const lines = room > 0 ? wrap(ctx, content.note, inner - 36, Math.min(5, room)) : [];
      if (lines.length) {
        ctx.fillStyle = C.accent;
        rect(M, y - 40, 6, lines.length * lh - 4);
        ctx.fillStyle = C.ink2;
        lines.forEach((l, i) => text(l, M + 36, y + i * lh));
        y += (lines.length - 1) * lh;
      }
    }
    return y;
  };

  // Without a cover the story card would be top-heavy; sit the block a little above centre.
  const cap = (story ? 88 : 76) * 0.78;
  let top = y + cap;
  if (story && !img) {
    const height = body(top, true) - y;
    top += Math.max(0, (footerTop - 60 - y - height) * 0.42);
  } else if (!img) {
    top += 40;
  }
  body(top, false);

  // Footer
  ctx.fillStyle = C.ink;
  ctx.fillRect(M, footerTop, inner, 2);
  ctx.font = `400 26px ${MONO}`;
  ctx.fillStyle = C.ink3;
  ctx.fillText(content.footerLeft, M, footerTop + 56);
  ctx.textAlign = 'right';
  ctx.fillText(content.footerRight, W - M, footerTop + 56);

  return { canvas, coverMissing: !!src && !img };
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'),
  );
}
