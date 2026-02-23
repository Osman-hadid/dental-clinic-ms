'use client';

import { JSX } from 'react';
import { useTranslations } from 'next-intl';
import { Header } from '@/components/header';
import { EntityListClient as EntityList } from '@/components/shared/entity/entity-list';
import { TreatmentChartWorkspace } from '@/modules/dental-management/presentation/components/treatment-chart-workspace';
import { treatmentConfig } from '@/modules/dental-management/presentation/config/treatment-config';
import {
  useCreateTreatment,
  useDeleteTreatment,
  useTreatmentList,
  useUpdateTreatment,
} from '@/modules/dental-management/presentation/hooks';

// eslint-disable-next-line react/function-component-definition
export default function TreatmentsPage(): JSX.Element {
  const t = useTranslations('treatment');
  const tSidebar = useTranslations('sidebar.dentalManagement');
  return (
    <>
      <Header
        breadcrumbs={[
          { id: 'dentalManagement', label: tSidebar('title') },
          { id: 'treatments', isCurrent: true, label: t(treatmentConfig.title) },
        ]}
      />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 px-4 lg:px-6">
            <TreatmentChartWorkspace />
            <EntityList
              config={treatmentConfig}
              fetchHook={useTreatmentList}
              useCreate={useCreateTreatment}
              useUpdate={useUpdateTreatment}
              useDelete={useDeleteTreatment}
            />
          </div>
        </div>
      </div>
    </>
  );
}
