import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from './store/authStore';
import Header from './components/layout/Header';
import Landing from './pages/Landing';
import Home from './pages/Home';
import Vault from './pages/Vault';
import Badges from './pages/Badges';
import Callback from './pages/Callback';

function AppContent() {
  const { isInitialized, initialize, accessToken } = useAuthStore();
  const location = useLocation();
  const { i18n } = useTranslation();

  useEffect(() => {
    document.documentElement.lang = i18n.language;
    document.documentElement.classList.toggle('lang-ko', i18n.language === 'ko');
  }, [i18n.language]);

  const searchParams = new URLSearchParams(location.search);
  const hasCode = !!searchParams.get('code');

  useEffect(() => {
    if (!hasCode) {
      initialize();
    }
  }, []);

  if (hasCode) {
    return (
      <div className="min-h-screen gradient-bg">
        <Callback />
      </div>
    );
  }

  if (!isInitialized) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="w-8 h-8 rounded-xl bg-[var(--color-text)] animate-pulse" />
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-bg">
      <Routes>
        <Route path="/callback" element={<Callback />} />
        <Route
          path="/"
          element={
            accessToken ? (
              <>
                <Header />
                <Home />
              </>
            ) : (
              <Landing />
            )
          }
        />
        <Route
          path="/vault"
          element={
            <>
              <Header />
              <Vault />
            </>
          }
        />
        <Route
          path="/badges"
          element={
            <>
              <Header />
              <Badges />
            </>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
