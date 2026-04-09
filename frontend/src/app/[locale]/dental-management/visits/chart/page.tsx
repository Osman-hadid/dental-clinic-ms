'use client';

import { JSX } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Header } from '@/components/header';
import { Card, CardContent } from '@/components/ui/card';
import { TreatmentChartWorkspace } from '@/modules/dental-management/presentation/components/treatment-chart-workspace';
import { useGetVisit } from '@/modules/dental-management/presentation/hooks';
import { Calendar, Loader2, User, Stethoscope, AlertCircle } from 'lucide-react';

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
            <Card className="rounded-3xl border border-primary/10 bg-gradient-to-br from-primary/5 via-background to-muted/20 shadow-lg overflow-hidden">
              <div className="absolute right-0 top-0 h-48 w-48 translate-x-24 -translate-y-24 rounded-full bg-primary/10 blur-3xl" />
              <div className="absolute left-0 bottom-0 h-48 w-48 -translate-x-24 translate-y-24 rounded-full bg-emerald-500/10 blur-3xl" />
              
              <CardContent className="relative p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl border border-primary/20 bg-primary/10 p-3">
                      <Stethoscope className="size-6 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-foreground">Visit Chart Workspace</h2>
                      <p className="text-sm text-muted-foreground">Dental treatment charting interface</p>
                    </div>
                  </div>
                  {visit && (
                    <div className="rounded-xl border border-border/50 bg-background/80 px-4 py-2">
                      <span className="text-sm font-medium text-foreground">{visitLabel}</span>
                    </div>
                  )}
                </div>

                {visit && (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/60 p-3">
                      <div className="rounded-lg border border-emerald-200/50 bg-emerald-50/60 p-2">
                        <Calendar className="size-4 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Appointment</p>
                        <p className="text-sm font-semibold text-foreground">{visit.appointmentTag || 'Walk-in'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/60 p-3">
                      <div className="rounded-lg border border-blue-200/50 bg-blue-50/60 p-2">
                        <User className="size-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Patient</p>
                        <p className="text-sm font-semibold text-foreground">{visit.patientName || '-'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/60 p-3">
                      <div className="rounded-lg border border-violet-200/50 bg-violet-50/60 p-2">
                        <Stethoscope className="size-4 text-violet-600" />
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Dentist</p>
                        <p className="text-sm font-semibold text-foreground">{visit.dentistName || '-'}</p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {isFetching ? (
              <Card className="rounded-3xl border border-border/50 bg-gradient-to-br from-background to-muted/20 shadow-sm">
                <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                  <div className="rounded-2xl border border-primary/20 bg-primary/10 p-4 mb-4">
                    <Loader2 className="size-8 text-primary animate-spin" />
                  </div>
                  <p className="text-sm font-medium text-foreground">Loading visit chart...</p>
                  <p className="text-xs text-muted-foreground mt-1">Please wait while we fetch the treatment data</p>
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
              <Card className="rounded-3xl border border-rose-200/60 bg-gradient-to-br from-rose-50/80 via-background to-rose-100/40 shadow-sm">
                <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                  <div className="rounded-2xl border border-rose-200/50 bg-rose-100/60 p-4 mb-4">
                    <AlertCircle className="size-8 text-rose-600" />
                  </div>
                  <p className="text-sm font-semibold text-rose-900">Visit Not Found</p>
                  <p className="text-xs text-rose-700 mt-1">Open a valid visit from the Visits page to access the chart workspace</p>
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
