'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent, type Ref } from 'react';
import { MapPin, Search } from 'lucide-react';
import { Input } from '@/components/ui/Field';
import { Spinner } from '@/components/ui/Spinner';
import { ApiClientError, geocodeApi } from '@/services/api';
import type { LatLng, PlaceSuggestion } from '@/services/types';
import { cn } from '@/lib/cn';

const MIN_QUERY = 3;
const DEBOUNCE_MS = 400;

type Status = 'idle' | 'loading' | 'done' | 'busy' | 'error';

/**
 * Address input that suggests matching places while typing (ARIA 1.2 combobox).
 * Typing only edits the text; choosing a suggestion calls `onSelect` with its
 * coordinates so the caller can drop the pin.
 */
export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  onBlur,
  near,
  label,
  placeholder,
  inputRef,
}: {
  value: string;
  onChange: (value: string) => void;
  onSelect: (place: PlaceSuggestion) => void;
  onBlur?: () => void;
  /** Bias results toward this point (e.g. the map area being used). */
  near?: LatLng | null;
  /** Accessible name. Set explicitly so the suggestion list (inside the Field's label) isn't read as part of it. */
  label: string;
  placeholder?: string;
  inputRef?: Ref<HTMLInputElement>;
}) {
  const listId = useId();
  // What the user typed — distinct from `value`, which also changes when a suggestion or map pin fills it in.
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceSuggestion[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const nearRef = useRef(near);
  useEffect(() => {
    nearRef.current = near;
  });

  useEffect(() => {
    const q = query.trim();
    if (q.length < MIN_QUERY) return; // onChange already reset the list
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setStatus('loading');
      try {
        const found = await geocodeApi.search(q, nearRef.current, ctrl.signal);
        setResults(found);
        setActive(-1);
        setStatus('done');
      } catch (err) {
        if (ctrl.signal.aborted) return;
        setStatus(err instanceof ApiClientError && err.code === 'GEOCODER_BUSY' ? 'busy' : 'error');
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query]);

  function choose(place: PlaceSuggestion) {
    onSelect(place);
    setQuery('');
    setResults([]);
    setStatus('idle');
    setOpen(false);
    setActive(-1);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    const count = results.length;
    if (e.key === 'ArrowDown' && count) {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % count);
    } else if (e.key === 'ArrowUp' && count) {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i <= 0 ? count - 1 : i - 1));
    } else if (e.key === 'Enter' && open && active >= 0 && results[active]) {
      e.preventDefault(); // pick the suggestion instead of submitting the form
      choose(results[active]);
    } else if (e.key === 'Escape' && open) {
      e.preventDefault();
      setOpen(false);
    }
  }

  const showList = open && query.trim().length >= MIN_QUERY && status !== 'idle';
  const optionId = (i: number) => `${listId}-opt-${i}`;

  return (
    <span className="relative block">
      <Input
        ref={inputRef}
        role="combobox"
        aria-label={label}
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={showList && active >= 0 ? optionId(active) : undefined}
        required
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        leading={<Search className="text-text-subtle" />}
        trailing={status === 'loading' ? <Spinner size="sm" className="text-text-subtle" /> : undefined}
        onChange={(e) => {
          onChange(e.target.value);
          setQuery(e.target.value);
          setOpen(true);
          if (e.target.value.trim().length < MIN_QUERY) {
            setResults([]);
            setStatus('idle');
          }
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          setOpen(false);
          onBlur?.();
        }}
        onKeyDown={onKeyDown}
      />
      <span
        id={listId}
        role="listbox"
        aria-label={`${label} suggestions`}
        hidden={!showList}
        // Keep focus in the input when clicking a suggestion (blur would close the list first).
        onMouseDown={(e) => e.preventDefault()}
        className="absolute inset-x-0 top-full z-(--z-popover) mt-1.5 block max-h-72 overflow-y-auto rounded-xl bg-surface p-1.5 shadow-(--elev-3) ring-1 ring-border"
      >
        {status === 'loading' && results.length === 0 && <ListNote>Searching…</ListNote>}
        {status === 'busy' && (
          <ListNote>Suggestions are paused for a minute (search service is busy). Keep typing later, or pin the spot on the map.</ListNote>
        )}
        {status === 'error' && <ListNote>Suggestions are unavailable — you can still pin the spot on the map.</ListNote>}
        {status === 'done' && results.length === 0 && <ListNote>No matching places. Try a landmark or area name.</ListNote>}
        {status === 'done' &&
          results.map((place, i) => (
            <span
              key={place.id}
              id={optionId(i)}
              role="option"
              aria-selected={i === active}
              onClick={() => choose(place)}
              onMouseEnter={() => setActive(i)}
              className={cn(
                'flex cursor-pointer items-start gap-2.5 rounded-lg px-2.5 py-2 text-left',
                i === active && 'bg-surface-muted',
              )}
            >
              <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-text-subtle" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-text">{place.name}</span>
                {place.detail && <span className="block truncate text-xs text-text-muted">{place.detail}</span>}
              </span>
            </span>
          ))}
      </span>
    </span>
  );
}

function ListNote({ children }: { children: string }) {
  return <span className="block px-2.5 py-2 text-sm text-text-muted">{children}</span>;
}
