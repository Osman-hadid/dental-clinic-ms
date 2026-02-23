'use client';

import { JSX } from 'react';
import { useTranslations } from 'next-intl';
import { Header } from '@/components/header';
import { DentalChartDashboard } from '@/components/shared/dental/dental-chart-dashboard';

// eslint-disable-next-line react/function-component-definition
export default function Page(): JSX.Element {
  const t = useTranslations('global');
  return (
    <>
      <Header
        breadcrumbs={[
          { href: '#', id: 'dashboard', label: t('dashboard') },
          { id: 'data', isCurrent: true, label: t('data') },
        ]}
      />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:px-6 md:py-6">
            <DentalChartDashboard />
          </div>
        </div>
      </div>
    </>
  );
}
