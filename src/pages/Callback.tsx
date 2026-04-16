import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { exchangeCodeForToken, storeTokens } from '../lib/spotify';
import { useAuthStore } from '../store/authStore';

export default function Callback() {
  const navigate = useNavigate();
  const { setAccessToken } = useAuthStore();
  const { t } = useTranslation();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    const handleCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const state = params.get('state');
      const error = params.get('error');

      if (error) {
        navigate('/?error=access_denied');
        return;
      }

      const storedState = localStorage.getItem('spotify_auth_state');
      if (!code || state !== storedState) {
        navigate('/?error=state_mismatch');
        return;
      }

      try {
        const tokens = await exchangeCodeForToken(code);
        storeTokens(tokens.access_token, tokens.refresh_token, tokens.expires_in);
        setAccessToken(tokens.access_token);

        await useAuthStore.getState().initialize();
        navigate('/');
      } catch (err) {
        console.error('Auth error:', err);
        navigate('/?error=auth_failed');
      }
    };

    handleCallback();
  }, []);

  return (
    <div className="min-h-screen gradient-bg flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center"
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="w-12 h-12 rounded-xl bg-[var(--color-text)] flex items-center justify-center mx-auto mb-4"
        >
          <Sparkles size={20} className="text-white" />
        </motion.div>
        <p className="serif text-lg text-[var(--color-text)]">{t('callback.connecting')}</p>
        <p className="text-sm text-[var(--color-text-3)] mt-2">{t('callback.syncing')}</p>
      </motion.div>
    </div>
  );
}
