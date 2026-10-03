'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { bangladeshDistricts, findBangladeshDistrict } from '@/lib/bangladesh-locations';

export default function SearchableDistrictSelect({
  value,
  onChange,
  required = false,
  disabled = false,
  className = '',
  placeholder = 'জেলা খুঁজুন...',
}: {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const selected = findBangladeshDistrict(value);
  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    if (!term) return bangladeshDistricts;
    return bangladeshDistricts.filter((district) =>
      `${district.bangla} ${district.english}`.toLocaleLowerCase().includes(term)
    );
  }, [query]);

  useEffect(() => {
    const closeWhenOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('pointerdown', closeWhenOutside);
    return () => document.removeEventListener('pointerdown', closeWhenOutside);
  }, []);

  const openOptions = () => {
    if (disabled) return;
    setQuery('');
    setActiveIndex(0);
    setOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const choose = (district: (typeof bangladeshDistricts)[number]) => {
    onChange(district.english);
    setQuery('');
    setOpen(false);
    inputRef.current?.setCustomValidity('');
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setOpen(false);
      setQuery('');
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, filtered.length - 1));
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    }
    if (event.key === 'Enter' && open && filtered[activeIndex]) {
      event.preventDefault();
      choose(filtered[activeIndex]);
    }
  };

  return <div ref={rootRef} className="relative min-w-0">
    <div className="relative">
      <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
      <input
        ref={inputRef}
        id={`${id}-district`}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={`${id}-options`}
        aria-activedescendant={open && filtered[activeIndex] ? `${id}-option-${filtered[activeIndex].id}` : undefined}
        autoComplete="off"
        required={required}
        disabled={disabled}
        value={open ? query : selected?.bangla || ''}
        placeholder={placeholder}
        className={`h-11 w-full min-w-0 border border-stone-300 bg-white py-2 pl-9 pr-10 text-sm font-normal text-stone-900 outline-none transition focus:border-[#1b3b2b] focus:ring-2 focus:ring-[#1b3b2b]/10 disabled:cursor-not-allowed disabled:bg-stone-50 disabled:opacity-60 ${className}`}
        onFocus={(event) => {
          if (!disabled) {
            setQuery(selected?.bangla || '');
            setOpen(true);
            event.currentTarget.select();
          }
        }}
        onBlur={() => window.setTimeout(() => {
          if (!rootRef.current?.contains(document.activeElement)) {
            setOpen(false);
            setQuery('');
          }
        }, 0)}
        onChange={(event) => {
          const nextQuery = event.target.value;
          setQuery(nextQuery);
          setActiveIndex(0);
          setOpen(true);
          onChange('');
          event.currentTarget.setCustomValidity(nextQuery ? 'তালিকা থেকে একটি জেলা নির্বাচন করুন।' : '');
        }}
        onKeyDown={onKeyDown}
      />
      <button type="button" disabled={disabled} onClick={openOptions} aria-label="জেলার তালিকা খুলুন" tabIndex={-1} className="absolute inset-y-0 right-0 grid w-10 place-items-center text-stone-400 transition hover:text-stone-700 disabled:cursor-not-allowed"><ChevronDown className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`} /></button>
    </div>
    {open && !disabled && <div id={`${id}-options`} role="listbox" aria-label="বাংলাদেশের জেলা" className="absolute left-0 right-0 z-[80] mt-1 max-h-64 overflow-y-auto rounded-lg border border-stone-200 bg-white p-1 shadow-xl">
      {filtered.length ? filtered.map((district, index) => <button
        id={`${id}-option-${district.id}`}
        key={district.id}
        type="button"
        role="option"
        aria-selected={selected?.id === district.id}
        onMouseEnter={() => setActiveIndex(index)}
        onClick={() => choose(district)}
        className={`flex min-h-10 w-full items-center justify-between gap-3 rounded-md px-3 text-left text-sm transition ${index === activeIndex ? 'bg-[#edf5f0] text-[#15583f]' : 'text-stone-700 hover:bg-[#f5f8f6]'}`}
      ><span className="min-w-0 truncate"><strong className="font-semibold">{district.bangla}</strong><span className="ml-2 text-xs text-stone-500">{district.english}</span></span>{selected?.id === district.id && <Check className="size-4 shrink-0 text-[#17825c]" />}</button>) : <p className="px-3 py-4 text-center text-xs text-stone-500">কোনো জেলা পাওয়া যায়নি</p>}
    </div>}
  </div>;
}