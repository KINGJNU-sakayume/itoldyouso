import { forwardRef } from 'react';
import { fmtFull, parseAmount } from '../../lib/format';
import { useLang } from '../../lib/i18n';

interface Props {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Shown under the field: a baseline to compare the typed number against. */
  compareTo?: number;
  className?: string;
  'aria-label'?: string;
}

/**
 * Free-text number field. Accepts "1.2M", "12만", "12,345" and shows how it
 * was read, so a mistyped unit is caught before saving.
 */
const AmountInput = forwardRef<HTMLInputElement, Props>(function AmountInput(
  { id, value, onChange, placeholder, compareTo, className = '', ...rest },
  ref,
) {
  const { t, lang } = useLang();
  const parsed = value.trim() ? parseAmount(value) : null;
  const invalid = value.trim() !== '' && parsed == null;
  const pct = parsed != null && compareTo ? (parsed / compareTo - 1) * 100 : null;
  const echo = parsed != null && fmtFull(parsed, lang) !== value.trim();

  return (
    <div className={className}>
      <input
        ref={ref}
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        className={`field num ${invalid ? 'field-error' : ''}`}
        {...rest}
      />
      <p className="num mt-1 min-h-[1.1rem] text-[12px] text-ink-3">
        {invalid ? (
          <span className="up">{t('form.amountInvalid')}</span>
        ) : (
          <>
            {echo && <span>= {fmtFull(parsed, lang)}</span>}
            {pct != null && Number.isFinite(pct) && (
              <span className={`${echo ? 'ml-2' : ''} ${pct > 0 ? 'up' : pct < 0 ? 'down' : ''}`}>
                {pct > 0 ? '+' : pct < 0 ? '−' : ''}
                {Math.abs(pct).toLocaleString('en-US', { maximumFractionDigits: Math.abs(pct) < 10 ? 1 : 0 })}%
              </span>
            )}
          </>
        )}
      </p>
    </div>
  );
});

export default AmountInput;
