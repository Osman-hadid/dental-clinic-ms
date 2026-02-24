'use client';

import { JSX } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Header } from '@/components/header';
import { DentalChartDashboard } from '@/components/shared/dental/dental-chart-dashboard';
import { useAppointmentList, usePatientList, useVisitList } from '@/modules/dental-management/presentation/hooks';

const APPOINTMENT_RELATIONS = ['patient', 'dentist'];
const APPOINTMENT_SEARCH_FIELDS = ['tag', 'notes'];
const PATIENT_SEARCH_FIELDS = ['patientCode', 'firstName', 'lastName'];
const TABLE_PER_PAGE = 100;
const VISIT_RELATIONS = ['appointment', 'patient', 'dentist'];
const VISIT_SEARCH_FIELDS = ['tag', 'diagnosisNotes'];

// eslint-disable-next-line react/function-component-definition
export default function Page(): JSX.Element {
  const locale = useLocale();
  const t = useTranslations('global');

  const { entities: appointments, isFetching: isLoadingAppointments } = useAppointmentList(
    1,
    TABLE_PER_PAGE,
    '',
    APPOINTMENT_SEARCH_FIELDS,
    APPOINTMENT_RELATIONS,
    {}
  );

  const { entities: visits, isFetching: isLoadingVisits } = useVisitList(
    1,
    TABLE_PER_PAGE,
    '',
    VISIT_SEARCH_FIELDS,
    VISIT_RELATIONS,
    {}
  );

  const { entities: patients, isFetching: isLoadingPatients } = usePatientList(
    1,
    TABLE_PER_PAGE,
    '',
    PATIENT_SEARCH_FIELDS,
    [],
    {}
  );

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
            <DentalChartDashboard
              appointments={appointments}
              locale={locale}
              visits={visits}
              patients={patients}
              isLoading={isLoadingAppointments || isLoadingVisits || isLoadingPatients}
            />
          </div>
        </div>
      </div>
    </>
  );
}

