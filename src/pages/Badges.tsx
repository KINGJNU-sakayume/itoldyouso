import { useTranslation } from 'react-i18next';
import BadgeGrid from '../components/badges/BadgeGrid';

export default function Badges() {
  const { t } = useTranslation();

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[var(--color-text)]">{t('badges.title')}</h1>
        <p className="text-sm text-[var(--color-text-3)] mt-1">
          {t('badges.subtitle')}
        </p>
      </div>
      <BadgeGrid userId="local-user" />
    </div>
  );
}
