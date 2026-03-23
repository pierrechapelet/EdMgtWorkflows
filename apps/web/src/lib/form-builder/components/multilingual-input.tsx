'use client';

import { useState } from 'react';
import type { MultilingualString } from '../types';

interface MultilingualInputProps {
  label: string;
  value: MultilingualString;
  onChange: (value: MultilingualString) => void;
  multiline?: boolean;
  required?: boolean;
}

const LOCALES = [
  { code: 'en' as const, label: 'EN', dir: 'ltr' as const },
  { code: 'ar' as const, label: 'AR', dir: 'rtl' as const },
  { code: 'fr' as const, label: 'FR', dir: 'ltr' as const },
  { code: 'es' as const, label: 'ES', dir: 'ltr' as const },
];

export function MultilingualInput({
  label,
  value,
  onChange,
  multiline = false,
  required = false,
}: MultilingualInputProps) {
  const [activeLocale, setActiveLocale] = useState<'en' | 'ar' | 'fr' | 'es'>('en');

  const current = LOCALES.find((l) => l.code === activeLocale)!;

  function handleChange(text: string) {
    onChange({ ...value, [activeLocale]: text });
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-muted-foreground">
          {label}
          {required && <span className="text-destructive ms-1">*</span>}
        </label>
        <div className="flex gap-0.5">
          {LOCALES.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => setActiveLocale(l.code)}
              className={`rounded px-1.5 py-0.5 text-xs font-medium transition-colors ${
                activeLocale === l.code
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>
      {multiline ? (
        <textarea
          dir={current.dir}
          value={value[activeLocale] ?? ''}
          onChange={(e) => handleChange(e.target.value)}
          rows={2}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
        />
      ) : (
        <input
          type="text"
          dir={current.dir}
          value={value[activeLocale] ?? ''}
          onChange={(e) => handleChange(e.target.value)}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      )}
    </div>
  );
}
