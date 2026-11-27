import type { Metadata } from 'next';
import { RoleGuard } from '@/features/auth/RoleGuard';
import { DispatchView } from '@/features/admin/DispatchView';
import { ROLE_SETS } from '@/lib/routes';
import { PageTransition } from '@/components/ui/PageTransition';

export const metadata: Metadata = { title: 'Dispatch' };

export default function AdminDispatchPage() {
  return (
    <PageTransition>
      <RoleGuard roles={ROLE_SETS.admin}>
        <DispatchView />
      </RoleGuard>
    </PageTransition>
  );
}
