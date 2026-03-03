'use client';

import { JSX, useEffect } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../application/stores/auth-store';

export const AuthRedirect = (): JSX.Element | null => {
  const { isSessionChecked, user } = useAuthStore();
  const router = useRouter();
  const locale = useLocale();

  useEffect(() => {
    if (!isSessionChecked) return;
    if (user) {
      router.replace(`/${locale}/dashboard`);
    }
  }, [user, isSessionChecked, router, locale]);

  return null;
};
