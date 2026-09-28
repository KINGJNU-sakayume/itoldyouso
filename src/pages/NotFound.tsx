import { Link } from 'react-router-dom';
import { useLang } from '../lib/i18n';

export default function NotFound() {
  const { t } = useLang();
  return (
    <div className="py-24 text-center">
      <p className="eyebrow">404</p>
      <h1 className="mt-2 text-xl font-semibold">{t('notFound.title')}</h1>
      <Link to="/" className="btn btn-line mt-6">
        {t('notFound.back')}
      </Link>
    </div>
  );
}
