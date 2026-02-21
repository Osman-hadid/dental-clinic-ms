'use client';

import { JSX } from 'react';
import { useTranslations } from 'next-intl';
import { Header } from '@/components/header';
import { EntityListClient as EntityList } from '@/components/shared/entity/entity-list';
import { patientConfig } from '@/modules/dental-management/presentation/config/patient-config';
import {
  useCreatePatient,
  useDeletePatient,
  usePatientList,
  useUpdatePatient,
} from '@/modules/dental-management/presentation/hooks';

// eslint-disable-next-line react/function-component-definition
export default function PatientsPage(): JSX.Element {
  const t = useTranslations('patient');
  const tSidebar = useTranslations('sidebar.dentalManagement');
  return (
    <>
      <Header
        breadcrumbs={[
          { id: 'dentalManagement', label: tSidebar('title') },
          { id: 'patients', isCurrent: true, label: t(patientConfig.title) },
        ]}
      />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 px-4 lg:px-6">
            <EntityList
              config={patientConfig}
              fetchHook={usePatientList}
              useCreate={useCreatePatient}
              useUpdate={useUpdatePatient}
              useDelete={useDeletePatient}
            />
          </div>
        </div>
      </div>
    </>
  );
}
