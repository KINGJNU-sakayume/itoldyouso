import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useBadgeStore } from '../../store/badgeStore';
import { getBadgeIcon } from './badgeIcons';
import type { Badge, UserBadge } from '../../types';

interface Props {
  userId: string;
  compact?: boolean;
}

const rarityColors: Record<string, string> = {
  common: 'badge-rarity-common',
  rare: 'badge-rarity-rare',
  epic: 'badge-rarity-epic',
  legendary: 'badge-rarity-legendary',
};

const rarityGlow: Record<string, string> = {
  common: '',
  rare: 'ring-1 ring-blue-200',
  epic: 'ring-1 ring-purple-200',
  legendary: 'ring-2 ring-amber-200',
};

interface BadgeItemProps {
  badge: Badge;
  earned: UserBadge | null;
  earnedAt?: string;
}

function BadgeItem({ badge, earned, earnedAt }: BadgeItemProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const { t, i18n } = useTranslation();
  const anchorRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const Icon = getBadgeIcon(badge.icon);

  const badgeName = t(`badgeNames.${badge.id}`, { defaultValue: badge.name });
  const badgeDesc = t(`badgeDesc.${badge.id}`, { defaultValue: badge.description });
  const dateLocale = i18n.language === 'ko' ? 'ko-KR' : 'en-US';

  useEffect(() => {
    if (!showTooltip || !anchorRef.current || !tooltipRef.current) return;
    const anchor = anchorRef.current.getBoundingClientRect();
    const tip = tooltipRef.current;
    const tipW = tip.offsetWidth;
    const tipH = tip.offsetHeight;
    let left = anchor.left + anchor.width / 2 - tipW / 2;
    let top = anchor.top + window.scrollY - tipH - 10;
    if (left < 8) left = 8;
    if (left + tipW > window.innerWidth - 8) left = window.innerWidth - tipW - 8;
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  }, [showTooltip]);

  return (
    <div className="relative">
      <motion.div
        ref={anchorRef}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onHoverStart={() => setShowTooltip(true)}
        onHoverEnd={() => setShowTooltip(false)}
        className={`relative p-3 rounded-2xl text-center cursor-default select-none transition-all ${
          earned
            ? `${rarityColors[badge.rarity]} ${rarityGlow[badge.rarity]}`
            : 'bg-[var(--color-surface-2)]'
        }`}
      >
        <div className={`w-8 h-8 mx-auto mb-2 flex items-center justify-center ${earned ? '' : 'opacity-30 grayscale'}`}>
          <Icon size={22} />
        </div>
        <p className={`text-[10px] font-semibold leading-tight break-words ${earned ? '' : 'text-[var(--color-text-3)]'}`}>
          {badgeName}
        </p>
        {!earned && (
          <div className="absolute inset-0 flex items-end justify-end p-1.5 pointer-events-none">
            <Lock size={9} className="text-[var(--color-text-3)]" />
          </div>
        )}
      </motion.div>

      <AnimatePresence>
        {showTooltip && (
          <motion.div
            ref={tooltipRef}
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="fixed z-[200] bg-[var(--color-text)] text-white rounded-xl p-3 shadow-xl pointer-events-none"
            style={{ width: '210px' }}
          >
            <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider mb-1.5 ${rarityColors[badge.rarity]}`}>
              {badge.rarity}
            </span>
            <p className="text-xs font-semibold mb-1 leading-snug">{badgeName}</p>
            <p className="text-[11px] text-white/70 leading-relaxed">{badgeDesc}</p>
            {earnedAt && (
              <p className="text-[10px] text-white/50 mt-2 pt-2 border-t border-white/10">
                {t('badgeTooltip.earned')} {new Date(earnedAt).toLocaleDateString(dateLocale, { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const CATEGORY_ORDER = ['milestone', 'discovery', 'growth', 'accuracy', 'social', 'achievement'];

export default function BadgeGrid({ userId, compact }: Props) {
  const { allBadges, userBadges, fetchBadges, fetchUserBadges } = useBadgeStore();
  const { t } = useTranslation();
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const CATEGORY_LABELS: Record<string, string> = {
    discovery: t('badgeGrid.filterDiscovery'),
    growth: t('badgeGrid.filterGrowth'),
    accuracy: t('badgeGrid.filterAccuracy'),
    social: t('badgeGrid.filterSocial'),
    achievement: t('badgeGrid.filterAchievement'),
    milestone: t('badgeGrid.filterMilestones'),
  };

  useEffect(() => {
    fetchBadges();
    fetchUserBadges(userId);
  }, [userId]);

  const earnedMap = new Map(userBadges.map(ub => [ub.badge_id, ub]));
  const earnedCount = userBadges.length;

  const categories = CATEGORY_ORDER.filter(cat => allBadges.some(b => b.category === cat));

  const filteredBadges = filterCategory === 'all'
    ? allBadges
    : allBadges.filter(b => b.category === filterCategory);

  if (compact) {
    const earnedBadges = allBadges.filter(b => earnedMap.has(b.id));
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-[var(--color-text)]">{t('badgeGrid.achievements')}</h3>
            <p className="text-xs text-[var(--color-text-3)] mt-0.5">
              {earnedCount} / {allBadges.length} {t('badgeGrid.unlocked')}
            </p>
          </div>
        </div>
        {earnedBadges.length === 0 ? (
          <div className="text-center py-6 bg-[var(--color-surface-2)] rounded-2xl">
            <p className="text-sm text-[var(--color-text-3)]">{t('badgeGrid.firstBadgePrompt')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
            {earnedBadges.slice(0, 12).map(badge => (
              <BadgeItem
                key={badge.id}
                badge={badge}
                earned={earnedMap.get(badge.id) || null}
                earnedAt={earnedMap.get(badge.id)?.earned_at}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-[var(--color-text)]">{t('badgeGrid.collection')}</h2>
          <p className="text-sm text-[var(--color-text-3)] mt-1">
            {earnedCount} / {allBadges.length} {t('badgeGrid.achievementsUnlocked')}
          </p>
        </div>
        <div className="h-2 w-32 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${(earnedCount / allBadges.length) * 100}%` }}
            transition={{ duration: 0.8 }}
            className="h-full rounded-full"
            style={{ background: 'var(--color-gold)' }}
          />
        </div>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto scrollbar-none pb-1">
        <button
          onClick={() => setFilterCategory('all')}
          className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
            filterCategory === 'all'
              ? 'bg-[var(--color-text)] text-white'
              : 'bg-[var(--color-surface-2)] text-[var(--color-text-2)] hover:bg-[var(--color-border)]'
          }`}
        >
          {t('badgeGrid.filterAll')} ({allBadges.length})
        </button>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
              filterCategory === cat
                ? 'bg-[var(--color-text)] text-white'
                : 'bg-[var(--color-surface-2)] text-[var(--color-text-2)] hover:bg-[var(--color-border)]'
            }`}
          >
            {CATEGORY_LABELS[cat]} ({allBadges.filter(b => b.category === cat).length})
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3">
        {filteredBadges.map(badge => (
          <BadgeItem
            key={badge.id}
            badge={badge}
            earned={earnedMap.get(badge.id) || null}
            earnedAt={earnedMap.get(badge.id)?.earned_at}
          />
        ))}
      </div>
    </div>
  );
}
