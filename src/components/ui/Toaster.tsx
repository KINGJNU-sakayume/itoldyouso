import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useToasts, type Toast } from '../../store/toastStore';
import { useLang } from '../../lib/i18n';

function Item({ toast }: { toast: Toast }) {
  const { t } = useLang();
  const dismiss = useToasts(s => s.dismiss);
  const ttl = toast.ttl ?? (toast.action ? 6500 : 4200);
  const id = useRef(toast.id);

  useEffect(() => {
    if (!ttl) return;
    const timer = setTimeout(() => dismiss(id.current), ttl);
    return () => clearTimeout(timer);
  }, [ttl, dismiss]);

  const mark =
    toast.kind === 'hit' ? (
      <span className="stamp stamp-in text-[11px]">{toast.mark ?? t('stamp.hit')}</span>
    ) : toast.mark ? (
      <span className="grid h-9 min-w-9 place-items-center rounded-full bg-ink px-1.5 font-mono text-[11px] font-semibold text-paper">
        {toast.mark}
      </span>
    ) : null;

  return (
    <div
      role={toast.kind === 'error' ? 'alert' : 'status'}
      className={`toast-in pointer-events-auto flex w-full max-w-md items-center gap-3 rounded border bg-paper px-4 py-3 shadow-[0_10px_30px_-12px_rgb(0_0_0/0.35)] ${
        toast.kind === 'error' ? 'border-accent' : 'border-ink/80'
      }`}
    >
      {mark}
      <div className="min-w-0 flex-1">
        {toast.kind === 'achievement' && <p className="eyebrow mb-0.5">{t('toast.achievement')}</p>}
        <p className="text-sm font-medium">{toast.title}</p>
        {toast.body && <p className="mt-0.5 text-[13px] text-ink-2">{toast.body}</p>}
      </div>
      {toast.action && (
        <button
          className="shrink-0 text-sm font-medium underline underline-offset-4 hover:text-accent"
          onClick={() => {
            toast.action!.run();
            dismiss(toast.id);
          }}
        >
          {toast.action.label}
        </button>
      )}
      <button onClick={() => dismiss(toast.id)} className="-mr-1 shrink-0 text-ink-3 hover:text-ink" aria-label={t('common.close')}>
        <X size={15} />
      </button>
    </div>
  );
}

export default function Toaster() {
  const toasts = useToasts(s => s.toasts);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6"
    >
      {toasts.map(t => (
        <Item key={t.id} toast={t} />
      ))}
    </div>
  );
}
