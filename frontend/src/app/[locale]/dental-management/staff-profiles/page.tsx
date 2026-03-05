'use client';

import { JSX, useEffect } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';

// eslint-disable-next-line react/function-component-definition
export default function StaffProfilesRedirectPage(): JSX.Element | null {
  const locale = useLocale();
  const router = useRouter();

  useEffect(() => {
    router.replace(`/${locale}/dental-management/staff`);
  }, [locale, router]);

  return null;
}
