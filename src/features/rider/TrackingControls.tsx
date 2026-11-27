'use client';

import { Lock, Play, Radio, Settings, Square, SunMedium, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardTitle } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Field';
import { LiveDot } from '@/components/ui/Badge';
import type { GeoStatus } from '@/hooks/useGeolocation';
import type { ReactNode } from 'react';

/** Real-GPS sharing for the active delivery (device location, or the native background service). */
export function TrackingControls({
  mode,
  gpsStatus,
  gpsError,
  nativeApp,
  wakeLockActive,
  onStart,
  onStop,
  onOpenSettings,
}: {
  mode: 'off' | 'gps' | 'sim';
  gpsStatus: GeoStatus;
  gpsError: string | null;
  nativeApp: boolean;
  wakeLockActive: boolean;
  onStart: () => void;
  onStop: () => void;
  onOpenSettings: () => void;
}) {
  const gps = mode === 'gps';
  return (
    <Card>
      <CardTitle icon={<Radio />} action={gps && <LiveDot pulse className="bg-success" />}>
        Live location
      </CardTitle>
      {gps ? (
        <Button className="w-full" size="lg" variant="danger" onClick={onStop} leftIcon={<Square aria-hidden="true" />}>
          Stop delivery tracking
        </Button>
      ) : (
        <Button className="w-full" size="lg" onClick={onStart} disabled={mode === 'sim'} leftIcon={<Play aria-hidden="true" />}>
          Start Delivery (device GPS)
        </Button>
      )}

      {gps && (
        <ul className="mt-3 space-y-2 text-sm text-text-muted">
          <Hint icon={<Radio />}>{gpsStatus === 'watching' ? 'Streaming GPS every 3–5 s (or after 10 m of movement)' : 'Waiting for GPS fix…'}</Hint>
          {wakeLockActive && <Hint icon={<SunMedium />}>Screen kept on</Hint>}
          {nativeApp && gpsStatus === 'watching' && (
            <Hint icon={<Lock />}>Keeps tracking with the screen locked — stop it here when the delivery is done.</Hint>
          )}
          {!nativeApp && !wakeLockActive && (
            <Hint icon={<TriangleAlert />} warn>
              Keep this page open with the screen on — tracking pauses if the phone locks or you switch apps.
            </Hint>
          )}
        </ul>
      )}

      {gpsError && gps && (
        <div className="mt-3 space-y-2">
          <Alert>{gpsError}</Alert>
          {nativeApp && gpsStatus === 'denied' && (
            <Button className="w-full" variant="secondary" onClick={onOpenSettings} leftIcon={<Settings aria-hidden="true" />}>
              Open app settings
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

export function Hint({ icon, children, warn }: { icon: ReactNode; children: ReactNode; warn?: boolean }) {
  return (
    <li className={warn ? 'flex gap-2 text-warning-text' : 'flex gap-2'}>
      <span aria-hidden="true" className="mt-0.5 shrink-0 [&_svg]:size-4">
        {icon}
      </span>
      <span>{children}</span>
    </li>
  );
}
