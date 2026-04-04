import { motion } from 'framer-motion';
import { Sparkles, TrendingUp, Award, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { initiateSpotifyLogin } from '../lib/spotify';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: 'easeOut' as const },
  }),
};

const sampleCards = [
  {
    cover: 'https://images.pexels.com/photos/1105666/pexels-photo-1105666.jpeg?auto=compress&cs=tinysrgb&w=400',
    artist: 'Nova Reyes',
    track: 'Afterglow',
    popularity: 12,
    validated: true,
  },
  {
    cover: 'https://images.pexels.com/photos/1916824/pexels-photo-1916824.jpeg?auto=compress&cs=tinysrgb&w=400',
    artist: 'Sol Maren',
    track: 'Glass Shore',
    popularity: 8,
    validated: false,
  },
  {
    cover: 'https://images.pexels.com/photos/1699161/pexels-photo-1699161.jpeg?auto=compress&cs=tinysrgb&w=400',
    artist: 'Idle Current',
    track: 'Tide Lines',
    popularity: 22,
    validated: true,
  },
  {
    cover: 'https://images.pexels.com/photos/2426085/pexels-photo-2426085.jpeg?auto=compress&cs=tinysrgb&w=400',
    artist: 'Cerulean Days',
    track: 'Pale Signal',
    popularity: 5,
    validated: false,
  },
  {
    cover: 'https://images.pexels.com/photos/167636/pexels-photo-167636.jpeg?auto=compress&cs=tinysrgb&w=400',
    artist: 'The Margins',
    track: 'Open Field',
    popularity: 31,
    validated: true,
  },
  {
    cover: 'https://images.pexels.com/photos/1190297/pexels-photo-1190297.jpeg?auto=compress&cs=tinysrgb&w=400',
    artist: 'Wren Volta',
    track: 'Low Season',
    popularity: 17,
    validated: false,
  },
];

export default function Landing() {
  const { t } = useTranslation();
  const hasClientId = !!import.meta.env.VITE_SPOTIFY_CLIENT_ID;

  const features = [
    { icon: TrendingUp, title: t('landing.feature1Title'), body: t('landing.feature1Desc') },
    { icon: Award, title: t('landing.feature2Title'), body: t('landing.feature2Desc') },
    { icon: Users, title: t('landing.feature3Title'), body: t('landing.feature3Desc') },
  ];

  return (
    <div className="min-h-screen gradient-bg">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-32">
        <motion.div
          initial="hidden"
          animate="visible"
          className="text-center max-w-3xl mx-auto"
        >
          <motion.div
            custom={0}
            variants={fadeUp}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium mb-8"
            style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)' }}
          >
            <Sparkles size={12} />
            {t('landing.tagline')}
          </motion.div>

          <motion.h1
            custom={1}
            variants={fadeUp}
            className="text-5xl sm:text-6xl md:text-7xl font-bold text-[var(--color-text)] mb-6"
          >
            I Told
            <br />
            <em className="italic not-italic" style={{ color: 'var(--color-primary)' }}>You So.</em>
          </motion.h1>

          <motion.p
            custom={2}
            variants={fadeUp}
            className="text-lg sm:text-xl text-[var(--color-text-2)] mb-12 max-w-xl mx-auto leading-relaxed"
          >
            {t('landing.subtitle')}
          </motion.p>

          <motion.div custom={3} variants={fadeUp}>
            {hasClientId ? (
              <button onClick={initiateSpotifyLogin} className="spotify-btn mx-auto">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                </svg>
                {t('landing.cta')}
              </button>
            ) : (
              <div className="card p-6 max-w-md mx-auto text-left">
                <p className="text-sm font-semibold text-[var(--color-text)] mb-2">{t('landing.setupRequired')}</p>
                <p className="text-sm text-[var(--color-text-2)] mb-3">
                  {t('landing.setupDesc')}
                </p>
                <div className="bg-[var(--color-surface-2)] rounded-xl p-3 font-mono text-xs text-[var(--color-text-2)] space-y-1">
                  <div>VITE_SPOTIFY_CLIENT_ID=your_client_id</div>
                  <div>VITE_SPOTIFY_REDIRECT_URI=http://localhost:5173/callback</div>
                </div>
                <p className="text-xs text-[var(--color-text-3)] mt-3">
                  {t('landing.setupNote').split('developer.spotify.com')[0]}
                  <span className="text-[var(--color-primary)]">developer.spotify.com</span>
                </p>
              </div>
            )}
          </motion.div>
        </motion.div>

        <div className="mt-32 grid grid-cols-1 md:grid-cols-3 gap-8">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              custom={4 + i}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              className="card p-8"
            >
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5"
                style={{ background: 'var(--color-primary-light)' }}
              >
                <f.icon size={22} style={{ color: 'var(--color-primary)' }} />
              </div>
              <h3 className="text-lg font-bold text-[var(--color-text)] mb-2">{f.title}</h3>
              <p className="text-sm text-[var(--color-text-2)] leading-relaxed">{f.body}</p>
            </motion.div>
          ))}
        </div>

        <div className="mt-24">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="text-center text-xs font-medium uppercase tracking-widest text-[var(--color-text-3)] mb-10"
          >
            {t('landing.liveClaims')}
          </motion.p>
          <div className="masonry-grid">
            {sampleCards.map((card, i) => (
              <motion.div
                key={i}
                className="masonry-item"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9 + i * 0.06 }}
              >
                <div className="card overflow-hidden pointer-events-none">
                  <div className="relative aspect-square">
                    <img src={card.cover} alt={card.artist} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <p className="text-white font-semibold text-sm">{card.artist}</p>
                      <p className="text-white/70 text-xs">{card.track}</p>
                    </div>
                    {card.validated && (
                      <div className="absolute top-3 right-3">
                        <span className="validated-stamp text-[10px]">✓ Validated</span>
                      </div>
                    )}
                  </div>
                  <div className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-3)]">{t('genre.entryPop')}</p>
                      <p className="text-sm font-semibold text-[var(--color-text)]">{card.popularity}/100</p>
                    </div>
                    <div className="w-7 h-7 rounded-full flex items-center justify-center shimmer" />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
