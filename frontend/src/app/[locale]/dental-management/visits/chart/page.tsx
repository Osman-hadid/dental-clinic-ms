'use client';

import { JSX } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Header } from '@/components/header';
import { Card, CardContent } from '@/components/ui/card';
import { TreatmentChartWorkspace } from '@/modules/dental-management/presentation/components/treatment-chart-workspace';
import { useGetVisit } from '@/modules/dental-management/presentation/hooks';
import { Loader2 } from 'lucide-react';

const VisitChartPage = (): JSX.Element => {
  const searchParams = useSearchParams();
  const visitId = searchParams.get('visitId')?.trim() ?? '';
  const tSidebar = useTranslations('sidebar.dentalManagement');

  const { data, isFetching } = useGetVisit(visitId, { enabled: !!visitId });
  const visit = data?.data;
  const visitLabel = visit?.tag || (visit?.id ? `Visit #${visit.id}` : (visitId ? `Visit #${visitId}` : 'Visit Chart'));

  return (
    <>
      <Header
        breadcrumbs={[
          { id: 'dentalManagement', label: tSidebar('title') },
          { id: 'visits', label: 'Visits' },
          { id: 'visitChart', isCurrent: true, label: visitLabel },
        ]}
      />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 px-4 lg:px-6">
            <div className="rounded-2xl border bg-gradient-to-r from-background to-muted/30 p-4">
              <h2 className="text-base font-semibold">Visit Chart Workspace</h2>
              <p className="text-xs text-muted-foreground">
                Appointment: {visit?.appointmentTag || 'Walk-in'} | Patient: {visit?.patientName || '-'} | Dentist: {visit?.dentistName || '-'}
              </p>
            </div>

            {isFetching ? (
              <Card className="rounded-2xl border">
                <CardContent className="p-6 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 inline size-4 animate-spin" />
                  Loading visit chart...
                </CardContent>
              </Card>
            ) : visit ? (
              <TreatmentChartWorkspace
                hidePatientVisitSelectors
                initialPatientId={visit.patientId}
                initialVisitId={visit.id}
                lockPatientSelection
                lockVisitSelection
              />
            ) : (
              <Card className="rounded-2xl border border-destructive/30">
                <CardContent className="p-6 text-sm text-destructive">
                  Visit not found. Open a valid visit from the Visits page.
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default VisitChartPage;
