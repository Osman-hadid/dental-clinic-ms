'use client';

import { JSX } from 'react';
import { useTranslations } from 'next-intl';
import { Header } from '@/components/header';
import { EntityListClient as EntityList } from '@/components/shared/entity/entity-list';
import { visitTreatmentConfig } from '@/modules/dental-management/presentation/config/visit-treatment-config';
import {
  useCreateVisitTreatment,
  useDeleteVisitTreatment,
  useUpdateVisitTreatment,
  useVisitTreatmentList,
} from '@/modules/dental-management/presentation/hooks';

// eslint-disable-next-line react/function-component-definition
export default function VisitTreatmentsPage(): JSX.Element {
  const t = useTranslations('visitTreatment');
  const tSidebar = useTranslations('sidebar.dentalManagement');
  return (
    <>
      <Header
        breadcrumbs={[
          { id: 'dentalManagement', label: tSidebar('title') },
          { id: 'visitTreatments', isCurrent: true, label: t(visitTreatmentConfig.title) },
        ]}
      />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 px-4 lg:px-6">
            <EntityList
              config={visitTreatmentConfig}
              fetchHook={useVisitTreatmentList}
              useCreate={useCreateVisitTreatment}
              useUpdate={useUpdateVisitTreatment}
              useDelete={useDeleteVisitTreatment}
            />
          </div>
        </div>
      </div>
    </>
  );
}
