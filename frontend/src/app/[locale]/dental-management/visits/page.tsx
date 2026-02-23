'use client';

import { JSX } from 'react';
import { useTranslations } from 'next-intl';
import { Header } from '@/components/header';
import { EntityListClient as EntityList } from '@/components/shared/entity/entity-list';
import { visitConfig } from '@/modules/dental-management/presentation/config/visit-config';
import {
  useCreateVisit,
  useDeleteVisit,
  useUpdateVisit,
  useVisitList,
} from '@/modules/dental-management/presentation/hooks';

// eslint-disable-next-line react/function-component-definition
export default function VisitsPage(): JSX.Element {
  const t = useTranslations('visit');
  const tSidebar = useTranslations('sidebar.dentalManagement');
  return (
    <>
      <Header
        breadcrumbs={[
          { id: 'dentalManagement', label: tSidebar('title') },
          { id: 'visits', isCurrent: true, label: t(visitConfig.title) },
        ]}
      />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 px-4 lg:px-6">
            <div className="rounded-2xl border bg-gradient-to-r from-background to-muted/30 p-4">
              <h2 className="text-base font-semibold">Visit Recorder</h2>
              <p className="text-xs text-muted-foreground">
                Use the add button to open a quick, card-style form for creating patient visits.
              </p>
            </div>
            <EntityList
              config={visitConfig}
              fetchHook={useVisitList}
              useCreate={useCreateVisit}
              useUpdate={useUpdateVisit}
              useDelete={useDeleteVisit}
            />
          </div>
        </div>
      </div>
    </>
  );
}
