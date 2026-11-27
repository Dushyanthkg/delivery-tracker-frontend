import type { Metadata } from 'next';
import { RoleGuard } from '@/features/auth/RoleGuard';
import { CustomerHomeView } from '@/features/customer/CustomerHomeView';
import { ROLE_SETS } from '@/lib/routes';
import { PageTransition } from '@/components/ui/PageTransition';

export const metadata: Metadata = { title: 'My deliveries' };

export default function CustomerPage() {
  return (
    <PageTransition>
      <RoleGuard roles={ROLE_SETS.customer}>
        <CustomerHomeView />
      </RoleGuard>
    </PageTransition>
  );
}
