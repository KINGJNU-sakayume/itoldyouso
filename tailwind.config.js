/** @type {import('tailwindcss').Config} */
const v = name => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: v('paper'),
        sunk: v('sunk'),
        ink: { DEFAULT: v('ink'), 2: v('ink-2'), 3: v('ink-3') },
        rule: v('rule'),
        accent: v('accent'),
        down: v('down'),
      },
      fontFamily: {
        sans: ['"IBM Plex Sans KR"', '"Apple SD Gothic Neo"', '"Malgun Gothic"', 'system-ui', 'sans-serif'],
        // Hangul inside numeric/mono text falls back to the sans face, not a system mono.
        mono: ['"IBM Plex Mono"', '"IBM Plex Sans KR"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '3px',
        sm: '2px',
      },
    },
  },
  plugins: [],
};
