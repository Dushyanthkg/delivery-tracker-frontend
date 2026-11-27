'use client';

import { Bike, Radio, ShieldCheck } from 'lucide-react';
import { LogoMark } from '@/components/ui/Logo';
import { useMediaQuery } from '@/hooks/useMediaQuery';

const ROUTE = 'M70 520 C 150 470, 120 380, 210 350 S 330 330, 340 250 S 420 140, 500 110';
const STREETS = [
  'M0 140 H600',
  'M0 300 H600',
  'M0 460 H600',
  'M120 0 V640',
  'M290 0 V640',
  'M450 0 V640',
  'M0 600 L600 40',
];

const FEATURES = [
  { icon: Radio, text: 'Live rider positions, smooth to the second' },
  { icon: Bike, text: 'Auto-dispatch to the nearest available rider' },
  { icon: ShieldCheck, text: 'Background GPS in the Android rider app' },
];

/** Left half of the sign-in screen (lg+): brand, a rider gliding along a stylised route, and the pitch. */
export function AuthBrandPanel() {
  // SMIL animations ignore CSS media queries, so gate them here (static until hydrated).
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)', true);
  return (
    <aside className="relative hidden overflow-hidden bg-[oklch(0.3_0.12_277)] text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
      <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(120%_80%_at_80%_0%,oklch(0.5_0.2_277/.7),transparent_60%),radial-gradient(90%_70%_at_0%_100%,oklch(0.45_0.18_300/.55),transparent_60%)]" />
      <svg aria-hidden="true" viewBox="0 0 600 640" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full">
        <g stroke="white" strokeOpacity=".07" strokeWidth="14" fill="none" strokeLinecap="round">
          {STREETS.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
        <path d={ROUTE} fill="none" stroke="white" strokeOpacity=".18" strokeWidth="10" strokeLinecap="round" />
        <path
          d={ROUTE}
          fill="none"
          stroke="white"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray="2 10"
          style={reduced ? undefined : { animation: 'route-dash 1.2s linear infinite' }}
        />
        <circle cx="70" cy="520" r="11" fill="oklch(0.3 0.12 277)" stroke="white" strokeWidth="5" />
        <path d="M500 74a20 20 0 0 1 20 20c0 15-20 34-20 34s-20-19-20-34a20 20 0 0 1 20-20Z" fill="white" />
        <circle cx="500" cy="94" r="7" fill="oklch(0.3 0.12 277)" />
        <g>
          <circle r="22" fill="white" fillOpacity=".18" />
          <circle r="11" fill="white" />
          {reduced ? (
            <animateMotion dur="1s" fill="freeze" keyPoints="0.55;0.55" keyTimes="0;1" calcMode="linear" path={ROUTE} />
          ) : (
            <animateMotion dur="9s" repeatCount="indefinite" rotate="auto" path={ROUTE} keyPoints="0;1" keyTimes="0;1" calcMode="spline" keySplines="0.45 0 0.55 1" />
          )}
        </g>
      </svg>

      {/* Keeps the headline readable where the route passes behind it */}
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-3/5 bg-linear-to-t from-[oklch(0.24_0.1_277)] via-[oklch(0.24_0.1_277/.85)] to-transparent" />

      <div className="relative">
        {/* Always on the dark brand panel, so the wordmark is white in both themes. */}
        <span className="inline-flex items-center gap-3">
          <LogoMark className="size-10 rounded-[11px] ring-1 ring-white/25" />
          <span className="text-lg font-semibold tracking-tight">DeliveryTrack</span>
        </span>
      </div>

      <div className="relative max-w-md">
        <h2 className="text-4xl font-semibold leading-tight tracking-tight">Every delivery, live on the map.</h2>
        <ul className="mt-8 space-y-3">
          {FEATURES.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3 text-white/85">
              <span className="grid size-9 place-items-center rounded-xl bg-white/12 ring-1 ring-white/15 backdrop-blur">
                <Icon aria-hidden="true" className="size-[18px]" />
              </span>
              {text}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
