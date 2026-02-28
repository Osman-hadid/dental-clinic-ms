'use client';

import { useEffect, useRef } from 'react';
import { useLocale } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { ProtectedRoute } from '@/modules/auth/presentation/components/protected-route';

type ClientLayoutWrapperProps = {
  children: React.ReactNode;
};

export const ClientLayoutWrapper = ({ children }: ClientLayoutWrapperProps): React.ReactNode => {
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale();
  const hasInitialized = useRef(false);

  const isAuthPage = pathname.startsWith(`/${locale}/auth`);

  useEffect(() => {
    if (isAuthPage) return;
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      return;
    }
    router.refresh();
  }, [isAuthPage, pathname, router]);

  return isAuthPage ? (
    children
  ) : (
    <ProtectedRoute>
      <AppShell>{children}</AppShell>
    </ProtectedRoute>
  );
};
