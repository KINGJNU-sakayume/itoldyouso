import { useState } from 'react';
import { X } from 'lucide-react';
import { useLang } from '../../lib/i18n';

interface Props {
  id?: string;
  tags: string[];
  onChange: (tags: string[]) => void;
  suggestions: string[];
}

export default function TagInput({ id, tags, onChange, suggestions }: Props) {
  const { t } = useLang();
  const [text, setText] = useState('');
  const has = (tag: string) => tags.some(x => x.toLowerCase() === tag.toLowerCase());

  const add = (raw: string) => {
    const next = raw
      .split(/[,#]/)
      .map(s => s.trim())
      .filter(s => s && !has(s));
    if (next.length) onChange([...tags, ...next]);
    setText('');
  };

  const rest = suggestions.filter(s => !has(s) && (!text || s.toLowerCase().includes(text.toLowerCase()))).slice(0, 14);

  return (
    <div>
      <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded border border-rule px-2 py-1.5 focus-within:border-ink">
        {tags.map(tag => (
          <span key={tag} className="inline-flex items-center gap-1 rounded-sm bg-sunk py-0.5 pl-2 pr-1 text-[13px]">
            {tag}
            <button
              type="button"
              onClick={() => onChange(tags.filter(x => x !== tag))}
              className="grid h-5 w-5 place-items-center text-ink-3 hover:text-ink"
              aria-label={t('form.removeTag', { tag })}
            >
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={text}
          onChange={e => (/[,#]$/.test(e.target.value) ? add(e.target.value) : setText(e.target.value))}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault();
              add(text);
            } else if (e.key === 'Backspace' && !text && tags.length) {
              onChange(tags.slice(0, -1));
            }
          }}
          onBlur={() => text.trim() && add(text)}
          placeholder={tags.length ? '' : t('form.tagsPlaceholder')}
          className="min-w-[8rem] flex-1 bg-transparent px-1 py-1 text-base placeholder:text-ink-3 focus:outline-none sm:text-[15px]"
        />
      </div>
      {rest.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          {rest.map(s => (
            <button key={s} type="button" onClick={() => add(s)} className="text-[13px] text-ink-3 hover:text-ink">
              +{s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
