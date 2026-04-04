/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          bg: '#FAF9F7',
          surface: '#FFFFFF',
          surface2: '#F4F3F0',
          border: '#E8E6E0',
          text: '#1A1814',
          text2: '#6B6560',
          text3: '#9B978F',
          primary: '#C4956A',
          primaryLight: '#F0DCC4',
          accent: '#8BAE9F',
          accentLight: '#D4EAE4',
          gold: '#D4A853',
          validated: '#5B9B6E',
          validatedLight: '#D4EDDA',
        },
      },
    },
  },
  plugins: [],
};
