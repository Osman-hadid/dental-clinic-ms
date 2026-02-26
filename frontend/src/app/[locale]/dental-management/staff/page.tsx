'use client';

import { JSX } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Header } from '@/components/header';
import { Button } from '@/components/ui/button';
import { EntityListClient as EntityList } from '@/components/shared/entity/entity-list';
import { staffConfig } from '@/modules/dental-management/presentation/config/staff-config';
import {
  useCreateStaff,
  useDeleteStaff,
  useStaffList,
  useUpdateStaff,
} from '@/modules/dental-management/presentation/hooks';

// eslint-disable-next-line react/function-component-definition
export default function StaffPage(): JSX.Element {
  const locale = useLocale();
  const t = useTranslations('staff');
  const tSidebar = useTranslations('sidebar.dentalManagement');
  return (
    <>
      <Header
        breadcrumbs={[
          { id: 'dentalManagement', label: tSidebar('title') },
          { id: 'staff', isCurrent: true, label: t(staffConfig.title) },
        ]}
      />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 px-4 lg:px-6">
            <div className="flex justify-end">
              <Button asChild variant="outline" size="sm">
                <Link href={`/${locale}/dental-management/staff-profiles`}>
                  {tSidebar('staffProfiles')}
                </Link>
              </Button>
            </div>
            <EntityList
              config={staffConfig}
              fetchHook={useStaffList}
              useCreate={useCreateStaff}
              useUpdate={useUpdateStaff}
              useDelete={useDeleteStaff}
            />
          </div>
        </div>
      </div>
    </>
  );
}
