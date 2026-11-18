'use client';

import { JSX } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Header } from '@/components/header';
import { Button } from '@/components/ui/button';
import { TreatmentChartWorkspace } from '@/modules/dental-management/presentation/components/treatment-chart-workspace';
import { useGetVisit } from '@/modules/dental-management/presentation/hooks';
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  ClipboardList,
  Loader2,
  Stethoscope,
} from 'lucide-react';

const VisitChartPage = (): JSX.Element => {
  const searchParams = useSearchParams();
  const locale = useLocale();
  const visitId = searchParams.get('visitId')?.trim() ?? '';
  const tSidebar = useTranslations('sidebar.dentalManagement');
  const { data, isError, isLoading, refetch } = useGetVisit(visitId, { enabled: !!visitId });
  const visit = data?.data;
  const hasError = isError || data?.success === false;
  const visitLabel = visit?.tag || (visitId ? `Visit #${visitId}` : 'Visit chart');
  const patientName = visit?.patientName || (visit ? `Patient #${visit.patientId}` : 'Visit chart');
  const initials = patientName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('');

  return (
    <>
      <Header
        breadcrumbs={[
          { id: 'dentalManagement', label: tSidebar('title') },
          { id: 'visits', label: 'Visits' },
          { id: 'visitChart', isCurrent: true, label: visitLabel },
        ]}
      />
      <main className="flex min-w-0 flex-1 flex-col gap-5 p-4 lg:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button asChild variant="outline" size="icon" className="rounded-xl">
              <Link href={`/${locale}/dental-management/visits`} aria-label="Back to visits">
                <ArrowLeft className="size-4 rtl:rotate-180" />
              </Link>
            </Button>
            <div>
              <p className="text-xs font-medium tracking-widest text-primary">CLINICAL WORKSPACE</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">Visit chart</h1>
            </div>
          </div>
          <span className="rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground">
            {visitLabel}
          </span>
        </div>

        {visit ? (
          <section
            aria-label="Visit and patient details"
            className="overflow-hidden rounded-2xl border bg-card shadow-sm"
          >
            <div className="flex flex-col gap-5 border-s-4 border-s-primary p-5 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                <div
                  className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-lg font-semibold text-primary"
                  aria-hidden="true"
                >
                  {initials}
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Patient #{visit.patientId}</p>
                  <h2 className="mt-1 break-words text-xl font-semibold">{patientName}</h2>
                </div>
              </div>
              <dl className="grid gap-4 text-sm sm:grid-cols-3 xl:gap-8">
                {[
                  {
                    icon: CalendarDays,
                    label: 'Visit date',
                    value: visit.visitDate || 'Not recorded',
                  },
                  {
                    icon: Stethoscope,
                    label: 'Treating dentist',
                    value: visit.dentistName || 'Not assigned',
                  },
                  {
                    icon: ClipboardList,
                    label: 'Appointment',
                    value:
                      visit.appointmentTag ||
                      (visit.appointmentId ? `#${visit.appointmentId}` : 'Walk-in'),
                  },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-center gap-3">
                    <Icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
                    <div>
                      <dt className="text-xs text-muted-foreground">{label}</dt>
                      <dd className="mt-1 font-medium">{value}</dd>
                    </div>
                  </div>
                ))}
              </dl>
            </div>
            {visit.diagnosisNotes ? (
              <p className="border-t bg-muted/30 px-5 py-3 text-sm">
                <span className="font-semibold">Visit notes: </span>
                {visit.diagnosisNotes}
              </p>
            ) : null}
          </section>
        ) : null}

        {visit ? (
          <TreatmentChartWorkspace
            key={visit.id}
            hidePatientVisitSelectors
            initialPatientId={visit.patientId}
            initialVisitId={visit.id}
            lockPatientSelection
            lockVisitSelection
          />
        ) : isLoading ? (
          <div
            role="status"
            className="flex min-h-96 flex-col items-center justify-center gap-4 rounded-2xl border bg-card"
          >
            <Loader2 className="size-7 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading visit chart...</p>
          </div>
        ) : (
          <div
            role={hasError ? 'alert' : 'status'}
            className="flex min-h-80 flex-col items-center justify-center gap-3 rounded-2xl border bg-card p-8 text-center"
          >
            <AlertCircle className="size-8 text-muted-foreground" />
            <h2 className="text-lg font-semibold">
              {hasError ? 'Unable to load this visit' : 'Choose a visit to start charting'}
            </h2>
            <p className="max-w-md text-sm text-muted-foreground">
              {hasError
                ? 'The visit could not be retrieved. Try again or return to the visits list.'
                : 'Open a patient visit from the visits list to view their chart and record treatment.'}
            </p>
            <div className="mt-2 flex gap-2">
              {hasError ? (
                <Button
                  onClick={() => {
                    void refetch();
                  }}
                >
                  Try again
                </Button>
              ) : null}
              <Button asChild variant="outline">
                <Link href={`/${locale}/dental-management/visits`}>Back to visits</Link>
              </Button>
            </div>
          </div>
        )}
      </main>
    </>
  );
};

export default VisitChartPage;
