'use client';

import { useAuthStore } from '@/modules/auth/application/stores/auth-store';

export const useCan = (): { can: (permission: string) => boolean } => {
  const { user } = useAuthStore();

  const can = (permission: string): boolean => {
    const roleNames = Array.isArray(user?.roles)
      ? user.roles.map((role) => (typeof role === 'string' ? role : '')).filter(Boolean)
      : [];

    if (roleNames.includes('super-admin')) {
      return true;
    }

    if (!user?.permissions?.length) return false;

    return user.permissions.some((p: any) => {
      if (typeof p === 'string') return p === permission;
      if (p && typeof p === 'object' && 'name' in p) return p.name === permission;
      return false;
    });
  };

  return { can };
};
