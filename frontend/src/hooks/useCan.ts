'use client';

import { useAuthStore } from '@/modules/auth/application/stores/auth-store';

export const useCan = (): { can: (permission: string) => boolean } => {
  const { user } = useAuthStore();

  const rightLevel = (() => {
    const value = typeof user?.rights === 'string' ? user.rights.trim().toLowerCase() : '';
    if (value === 'review' || value === 'approval') return value;
    return 'create';
  })();

  const hasAtLeast = (required: 'approval' | 'review'): boolean => {
    const order = { approval: 3, create: 1, review: 2 } as const;
    return order[rightLevel] >= order[required];
  };

  const can = (permission: string): boolean => {
    const roleNames = Array.isArray(user?.roles)
      ? user.roles.map((role) => (typeof role === 'string' ? role : '')).filter(Boolean)
      : [];

    if (roleNames.includes('super-admin')) {
      return true;
    }

    if (!user?.permissions?.length) return false;

    const approvalOnlyPermissions = new Set([
      'dental-management.backups.bulk-delete',
      'dental-management.backups.delete',
      'dental-management.backups.force-delete',
      'dental-management.backups.restore',
      'dental-management.backups.update',
      'dental-management.invoices.bulk-delete',
      'dental-management.invoices.delete',
      'dental-management.invoices.force-delete',
      'dental-management.payments.bulk-delete',
      'dental-management.payments.delete',
      'dental-management.payments.force-delete',
      'page.reports.audit',
    ]);
    const reviewOnlyPermissions = new Set([
      'page.dental-management.backups',
      'page.reports.debts',
      'page.reports.financial-control',
      'page.reports.safe',
      'page.reports.salaries',
      'page.reports.shareholders',
    ]);

    if (approvalOnlyPermissions.has(permission) && !hasAtLeast('approval')) return false;
    if (reviewOnlyPermissions.has(permission) && !hasAtLeast('review')) return false;

    return user.permissions.some((p: any) => {
      if (typeof p === 'string') return p === permission;
      if (p && typeof p === 'object' && 'name' in p) return p.name === permission;
      return false;
    });
  };

  return { can };
};
