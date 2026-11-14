import type { UserRole } from '@/services/types';

export function homeFor(role: UserRole): string {
  switch (role) {
    case 'admin':
      return '/admin/dispatch';
    case 'rider':
      return '/rider/dashboard';
    default:
      return '/customer';
  }
}

/** Stable role arrays for RoleGuard (avoid re-creating per render). */
export const ROLE_SETS = {
  customer: ['customer'],
  customerOrAdmin: ['customer', 'admin'],
  rider: ['rider'],
  admin: ['admin'],
} as const satisfies Record<string, readonly UserRole[]>;
