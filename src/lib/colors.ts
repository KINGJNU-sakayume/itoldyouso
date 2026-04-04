export async function extractDominantColors(imageUrl: string): Promise<{
  primary: string;
  secondary: string;
  accent: string;
  isDark: boolean;
}> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas not supported');

        canvas.width = 50;
        canvas.height = 50;
        ctx.drawImage(img, 0, 0, 50, 50);

        const data = ctx.getImageData(0, 0, 50, 50).data;
        const colors: { r: number; g: number; b: number }[] = [];

        for (let i = 0; i < data.length; i += 20) {
          colors.push({ r: data[i], g: data[i + 1], b: data[i + 2] });
        }

        const avgR = Math.round(colors.reduce((s, c) => s + c.r, 0) / colors.length);
        const avgG = Math.round(colors.reduce((s, c) => s + c.g, 0) / colors.length);
        const avgB = Math.round(colors.reduce((s, c) => s + c.b, 0) / colors.length);

        const brightness = (avgR * 299 + avgG * 587 + avgB * 114) / 1000;
        const isDark = brightness < 128;

        const primary = `rgb(${avgR}, ${avgG}, ${avgB})`;
        const secondary = `rgb(${Math.min(255, avgR + 30)}, ${Math.min(255, avgG + 30)}, ${Math.min(255, avgB + 30)})`;
        const accent = `rgb(${Math.max(0, avgR - 20)}, ${Math.max(0, avgG - 20)}, ${Math.max(0, avgB - 20)})`;

        resolve({ primary, secondary, accent, isDark });
      } catch {
        resolve({
          primary: 'rgb(30, 30, 30)',
          secondary: 'rgb(50, 50, 50)',
          accent: 'rgb(200, 180, 140)',
          isDark: true,
        });
      }
    };

    img.onerror = () => {
      resolve({
        primary: 'rgb(30, 30, 30)',
        secondary: 'rgb(50, 50, 50)',
        accent: 'rgb(200, 180, 140)',
        isDark: true,
      });
    };

    img.src = imageUrl;
  });
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}
