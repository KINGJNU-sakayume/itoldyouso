import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { UserBadge } from '../../types';
import { getBadgeIcon } from './badgeIcons';

interface Props {
  userBadge: UserBadge;
  index: number;
  onDismiss: () => void;
}

const rarityColors: Record<string, { bg: string; text: string; border: string }> = {
  common: { bg: '#EBF4EB', text: '#4A7C4A', border: '#B8D8B8' },
  rare: { bg: '#E3F0F8', text: '#2A6B9B', border: '#A8CBE0' },
  epic: { bg: '#EDE9F7', text: '#5B4FA0', border: '#C4B8E8' },
  legendary: { bg: '#FBF0DC', text: '#9B6A1A', border: '#E8C87C' },
};

export default function BadgeEarnedToast({ userBadge, index, onDismiss }: Props) {
  const badge = userBadge.badge;
  const { t } = useTranslation();
  if (!badge) return null;

  const Icon = getBadgeIcon(badge.icon);
  const colors = rarityColors[badge.rarity] || rarityColors.common;

  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 80, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 80, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25, delay: index * 0.15 }}
      className="fixed bottom-6 right-6 z-50 max-w-sm"
      style={{
        bottom: `${24 + index * 80}px`,
      }}
    >
      <div
        className="rounded-2xl p-4 shadow-2xl flex items-center gap-3"
        style={{
          background: colors.bg,
          border: `1.5px solid ${colors.border}`,
        }}
      >
        <motion.div
          initial={{ rotate: -20, scale: 0 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 15, delay: 0.1 }}
          className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: colors.border }}
        >
          <Icon size={22} style={{ color: colors.text }} />
        </motion.div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider mb-0.5" style={{ color: colors.text }}>
            {t('badgeToast.unlocked')}
          </p>
          <p className="font-semibold text-sm text-[var(--color-text)] truncate">
            {t(`badgeNames.${badge.id}`, { defaultValue: badge.name })}
          </p>
          <p className="text-xs text-[var(--color-text-2)] truncate mt-0.5">
            {t(`badgeDesc.${badge.id}`, { defaultValue: badge.description })}
          </p>
        </div>
        <button
          onClick={onDismiss}
          className="p-1.5 rounded-lg hover:bg-black/10 transition-colors shrink-0"
          style={{ color: colors.text }}
        >
          <X size={12} />
        </button>
      </div>
    </motion.div>
  );
}
