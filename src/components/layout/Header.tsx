import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Music, LayoutDashboard, LogOut, Menu, X, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';

export default function Header() {
  const { accessToken, logout } = useAuthStore();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const { t, i18n } = useTranslation();

  const isActive = (path: string) => location.pathname === path;

  const toggleLanguage = () => {
    const next = i18n.language === 'en' ? 'ko' : 'en';
    i18n.changeLanguage(next);
    localStorage.setItem('language', next);
  };

  const navLinks = [
    { href: '/', label: t('nav.discoveryWall'), icon: Music },
    { href: '/vault', label: t('nav.vault'), icon: LayoutDashboard },
    { href: '/badges', label: t('nav.badges'), icon: Sparkles },
  ];

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-[var(--color-border)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-xl bg-[var(--color-text)] flex items-center justify-center">
              <Sparkles size={16} className="text-white" />
            </div>
            <span className="serif text-lg font-semibold text-[var(--color-text)] hidden sm:block">
              {t('nav.title')}
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                to={href}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive(href)
                    ? 'bg-[var(--color-text)] text-white'
                    : 'text-[var(--color-text-2)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]'
                }`}
              >
                <Icon size={15} />
                {label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold border border-[var(--color-border)] hover:bg-[var(--color-surface-2)] transition-all duration-200 text-[var(--color-text-2)] hover:text-[var(--color-text)] select-none"
              title={i18n.language === 'en' ? '한국어로 변경' : 'Switch to English'}
            >
              <span className={i18n.language === 'en' ? 'text-[var(--color-text)]' : 'text-[var(--color-text-3)]'}>EN</span>
              <span className="text-[var(--color-text-3)]">/</span>
              <span className={i18n.language === 'ko' ? 'text-[var(--color-text)]' : 'text-[var(--color-text-3)]'}>KO</span>
            </button>

            {accessToken && (
              <button
                onClick={logout}
                className="hidden md:flex btn-ghost text-xs"
                title={t('nav.signOut')}
              >
                <LogOut size={15} />
              </button>
            )}

            <button
              className="md:hidden p-2 rounded-xl hover:bg-[var(--color-surface-2)] transition-colors"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-[var(--color-border)] bg-white"
          >
            <div className="px-4 py-3 space-y-1">
              {navLinks.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  to={href}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    isActive(href)
                      ? 'bg-[var(--color-text)] text-white'
                      : 'text-[var(--color-text-2)] hover:bg-[var(--color-surface-2)]'
                  }`}
                >
                  <Icon size={16} />
                  {label}
                </Link>
              ))}
              {accessToken && (
                <button
                  onClick={() => { logout(); setMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-[var(--color-text-2)] hover:bg-[var(--color-surface-2)] transition-all"
                >
                  <LogOut size={16} />
                  {t('nav.signOut')}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
