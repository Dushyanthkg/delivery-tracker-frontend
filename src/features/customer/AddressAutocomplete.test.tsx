// @vitest-environment jsdom
import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LatLng, PlaceSuggestion } from '@/services/types';

const search = vi.fn<(q: string, near?: LatLng | null, signal?: AbortSignal) => Promise<PlaceSuggestion[]>>();
class ApiClientError extends Error {
  constructor(message: string, public code: string) {
    super(message);
  }
}
vi.mock('@/services/api', () => ({
  ApiClientError,
  geocodeApi: { search: (q: string, near?: LatLng | null, signal?: AbortSignal) => search(q, near, signal) },
}));

const { AddressAutocomplete } = await import('./AddressAutocomplete');

const PLACES: PlaceSuggestion[] = [
  { id: 'N1', name: 'MG Road Metro', detail: 'Ashokanagar, Bengaluru', address: 'MG Road Metro, Ashokanagar, Bengaluru', lat: 12.97, lng: 77.61 },
  { id: 'N2', name: 'MG Road Boulevard', detail: 'Bengaluru', address: 'MG Road Boulevard, Bengaluru', lat: 12.975, lng: 77.607 },
];
const NEAR = { lat: 12.9716, lng: 77.5946 };

function Harness({ onSelect }: { onSelect: (p: PlaceSuggestion) => void }) {
  const [value, setValue] = useState('');
  return (
    <AddressAutocomplete
      label="Pickup address"
      value={value}
      near={NEAR}
      onChange={setValue}
      onSelect={(p) => {
        setValue(p.address);
        onSelect(p);
      }}
    />
  );
}

const input = () => screen.getByRole('combobox', { name: 'Pickup address' }) as HTMLInputElement;
async function type(text: string) {
  fireEvent.focus(input());
  fireEvent.change(input(), { target: { value: text } });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(450);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  search.mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('AddressAutocomplete', () => {
  it('waits for 3 characters, debounces, and biases toward the given point', async () => {
    search.mockResolvedValue(PLACES);
    render(<Harness onSelect={vi.fn()} />);

    await type('mg');
    expect(search).not.toHaveBeenCalled();

    fireEvent.change(input(), { target: { value: 'mg ' } });
    fireEvent.change(input(), { target: { value: 'mg r' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(450);
    });
    expect(search).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledWith('mg r', NEAR, expect.any(AbortSignal));
    expect(screen.getAllByRole('option')).toHaveLength(2);
    expect(input().getAttribute('aria-expanded')).toBe('true');
  });

  it('fills the address and reports coordinates when a suggestion is clicked', async () => {
    search.mockResolvedValue(PLACES);
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);

    await type('mg road');
    fireEvent.click(screen.getByRole('option', { name: /MG Road Boulevard/ }));

    expect(onSelect).toHaveBeenCalledWith(PLACES[1]);
    expect(input().value).toBe('MG Road Boulevard, Bengaluru');
    expect(input().getAttribute('aria-expanded')).toBe('false');
  });

  it('supports arrow keys + Enter without submitting the form', async () => {
    search.mockResolvedValue(PLACES);
    const onSelect = vi.fn();
    const onSubmit = vi.fn((e: { preventDefault: () => void }) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Harness onSelect={onSelect} />
      </form>,
    );

    await type('mg road');
    fireEvent.keyDown(input(), { key: 'ArrowDown' });
    fireEvent.keyDown(input(), { key: 'ArrowDown' });
    expect(input().getAttribute('aria-activedescendant')).toBe(screen.getAllByRole('option')[1]!.id);
    fireEvent.keyDown(input(), { key: 'Enter' });

    expect(onSelect).toHaveBeenCalledWith(PLACES[1]);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('explains when nothing matches or the service is down', async () => {
    search.mockResolvedValueOnce([]);
    render(<Harness onSelect={vi.fn()} />);
    await type('zzzz');
    expect(screen.getByText(/No matching places/)).toBeTruthy();

    search.mockRejectedValueOnce(new Error('502'));
    await type('zzzzz');
    expect(screen.getByText(/Suggestions are unavailable/)).toBeTruthy();

    search.mockRejectedValueOnce(new ApiClientError('paused', 'GEOCODER_BUSY'));
    await type('zzzzzz');
    expect(screen.getByText(/Suggestions are paused/)).toBeTruthy();
  });

  it('closes on Escape', async () => {
    search.mockResolvedValue(PLACES);
    render(<Harness onSelect={vi.fn()} />);
    await type('mg road');
    fireEvent.keyDown(input(), { key: 'Escape' });
    expect(input().getAttribute('aria-expanded')).toBe('false');
  });
});
