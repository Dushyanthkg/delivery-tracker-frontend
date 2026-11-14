import type { Metadata } from 'next';
import { RoleGuard } from '@/features/auth/RoleGuard';
import { DispatchView } from '@/features/admin/DispatchView';
import { ROLE_SETS } from '@/lib/routes';

export const metadata: Metadata = { title: 'Dispatch' };

export default function AdminDispatchPage() {
  return (
    <RoleGuard roles={ROLE_SETS.admin}>
      <DispatchView />
    </RoleGuard>
  );
}
