import type { Metadata } from 'next';
import { RoleGuard } from '@/features/auth/RoleGuard';
import { RiderDashboardView } from '@/features/rider/RiderDashboardView';
import { ROLE_SETS } from '@/lib/routes';

export const metadata: Metadata = { title: 'Rider dashboard' };

export default function RiderDashboardPage() {
  return (
    <RoleGuard roles={ROLE_SETS.rider}>
      <RiderDashboardView />
    </RoleGuard>
  );
}
