import { useLang } from '../../lib/i18n';

export default function Stamp({ size = 'sm', animate = false, label }: { size?: 'sm' | 'md' | 'lg'; animate?: boolean; label?: string }) {
  const { t } = useLang();
  const sizes = { sm: 'text-[10px]', md: 'text-sm', lg: 'text-2xl sm:text-3xl' };
  return <span className={`stamp ${sizes[size]} ${animate ? 'stamp-in' : ''}`}>{label ?? t('stamp.hit')}</span>;
}
