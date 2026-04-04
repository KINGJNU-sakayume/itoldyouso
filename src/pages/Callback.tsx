import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { exchangeCodeForToken, storeTokens, getSpotifyUser } from '../lib/spotify';
import { supabase } from '../lib/supabase';
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

        const spotifyUser = await getSpotifyUser(tokens.access_token);

        const { data: { session: existingSession } } = await supabase.auth.getSession();
        let authUserId: string;

        if (existingSession?.user) {
          authUserId = existingSession.user.id;
        } else {
          const fakeEmail = `spotify_${spotifyUser.id}@itoldyouso.app`;
          const fakePassword = `sp_${spotifyUser.id}_itys`;

          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: fakeEmail,
            password: fakePassword,
          });

          if (signInData?.user) {
            authUserId = signInData.user.id;
          } else if (signInError) {
            const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
              email: fakeEmail,
              password: fakePassword,
            });
            if (signUpError || !signUpData.user) throw new Error('Auth account creation failed');
            authUserId = signUpData.user.id;
          } else {
            throw new Error('Auth failed');
          }
        }

        const { data: existing } = await supabase
          .from('profiles')
          .select('id, auth_user_id')
          .eq('spotify_id', spotifyUser.id)
          .maybeSingle();

        if (!existing) {
          await supabase.from('profiles').insert({
            spotify_id: spotifyUser.id,
            display_name: spotifyUser.display_name || 'Anonymous',
            avatar_url: spotifyUser.images?.[0]?.url || '',
            spotify_url: spotifyUser.external_urls?.spotify || '',
            auth_user_id: authUserId,
          });
        } else {
          if (existing.auth_user_id !== authUserId) {
            await supabase.rpc('claim_profile', { p_spotify_id: spotifyUser.id });
          }
          await supabase
            .from('profiles')
            .update({
              display_name: spotifyUser.display_name || '',
              avatar_url: spotifyUser.images?.[0]?.url || '',
            })
            .eq('spotify_id', spotifyUser.id);
        }

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
