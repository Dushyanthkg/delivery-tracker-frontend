import type { Metadata } from 'next';
import { Suspense } from 'react';
import { RoleGuard } from '@/features/auth/RoleGuard';
import { TrackOrderView } from '@/features/customer/TrackOrderView';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { ROLE_SETS } from '@/lib/routes';
import { PageTransition } from '@/components/ui/PageTransition';

export const metadata: Metadata = { title: 'Live tracking' };

/**
 * `params` is only known at request time, so (with cacheComponents) it is
 * read inside a Suspense boundary; the static shell renders the spinner.
 */
export default function TrackOrderPage({ params }: PageProps<'/customer/track/[orderId]'>) {
  return (
    <PageTransition>
      <Suspense fallback={<FullPageSpinner />}>
        <TrackOrderRoute params={params} />
      </Suspense>
    </PageTransition>
  );
}

async function TrackOrderRoute({ params }: { params: PageProps<'/customer/track/[orderId]'>['params'] }) {
  const { orderId } = await params;
  return (
    <RoleGuard roles={ROLE_SETS.customerOrAdmin}>
      <TrackOrderView orderId={orderId} />
    </RoleGuard>
  );
}
