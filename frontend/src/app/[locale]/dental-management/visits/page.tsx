'use client';

import { JSX, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Header } from '@/components/header';
import { EntityListClient as EntityList } from '@/components/shared/entity/entity-list';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utilities';
import { type Appointment } from '@/modules/dental-management/domain/entities/Appointment';
import { type Visit } from '@/modules/dental-management/domain/entities/Visit';
import { visitConfig } from '@/modules/dental-management/presentation/config/visit-config';
import {
  useAppointmentList,
  useCreateVisit,
  useDeleteVisit,
  useUpdateVisit,
  useVisitList,
} from '@/modules/dental-management/presentation/hooks';
import { CalendarDays, Clock3, Loader2, Search, Stethoscope, UserRound } from 'lucide-react';
import { toast } from 'sonner';

const asText = (value: unknown): string => {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  return String(value).trim();
};

const buildPersonName = (value: unknown): string => {
  if (!value || typeof value !== 'object') return '';
  const relation = value as Record<string, unknown>;

  const firstName = asText(relation.firstName) || asText(relation.first_name);
  const lastName = asText(relation.lastName) || asText(relation.last_name);
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
  if (fullName) return fullName;

  return asText(relation.fullName) || asText(relation.full_name) || asText(relation.name);
};

const normalizeStatus = (value: string): string => value.trim().toLowerCase().replace(/\s+/g, '_');

const statusTheme = (status: string): string => {
  const normalized = normalizeStatus(status);

  if (normalized === 'completed') return 'border-emerald-300 bg-emerald-100 text-emerald-800';
  if (normalized === 'cancelled' || normalized === 'canceled') return 'border-rose-300 bg-rose-100 text-rose-800';
  return 'border-blue-300 bg-blue-100 text-blue-800';
};

const statusPriority = (status: string): number => {
  const normalized = normalizeStatus(status);
  if (normalized === 'scheduled') return 0;
  if (normalized === 'completed') return 1;
  if (normalized === 'cancelled' || normalized === 'canceled') return 2;
  return 3;
};

const toDateLabel = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || '-';
  return new Intl.DateTimeFormat('en-US', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
};

const toDateInputValue = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// eslint-disable-next-line react/function-component-definition
export default function VisitsPage(): JSX.Element {
  const router = useRouter();
  const params = useParams<{ locale?: string | string[] }>();
  const localeParam = params?.locale;
  const locale = Array.isArray(localeParam) ? localeParam[0] : (localeParam ?? 'en');
  const t = useTranslations('visit');
  const tSidebar = useTranslations('sidebar.dentalManagement');
  const [searchTerm, setSearchTerm] = useState('');
  const [pendingAppointmentId, setPendingAppointmentId] = useState<string | null>(null);

  const {
    entities: appointments,
    isFetching: isLoadingAppointments,
  } = useAppointmentList(1, 100, '', [], ['patient', 'dentist']);
  const {
    entities: visits,
    isFetching: isLoadingVisits,
  } = useVisitList(1, 100, '', [], ['appointment', 'patient', 'dentist']);
  const createVisit = useCreateVisit();

  const visitsByAppointmentId = useMemo(() => {
    const map = new Map<string, Visit>();
    visits.forEach((visit) => {
      const appointmentId = asText(visit.appointmentId);
      if (!appointmentId) return;

      const previous = map.get(appointmentId);
      if (!previous) {
        map.set(appointmentId, visit);
        return;
      }

      const previousTime = new Date(previous.visitDate || '').getTime();
      const currentTime = new Date(visit.visitDate || '').getTime();
      if (Number.isNaN(previousTime) || currentTime >= previousTime) {
        map.set(appointmentId, visit);
      }
    });
    return map;
  }, [visits]);

  const sortedAppointments = useMemo(() => {
    const next = [...appointments];
    next.sort((left, right) => {
      const statusSort = statusPriority(asText(left.status)) - statusPriority(asText(right.status));
      if (statusSort !== 0) return statusSort;

      const leftDate = new Date(asText(left.appointmentDate)).getTime();
      const rightDate = new Date(asText(right.appointmentDate)).getTime();
      return leftDate - rightDate;
    });
    return next;
  }, [appointments]);

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const filteredAppointments = useMemo(() => {
    if (!normalizedSearch) return sortedAppointments;

    return sortedAppointments.filter((appointment) => {
      const patientName = asText(appointment.patientName) || buildPersonName(appointment.patient);
      const dentistName = asText(appointment.dentistName) || buildPersonName(appointment.dentist);
      const haystack = [
        asText(appointment.tag),
        patientName,
        dentistName,
        asText(appointment.appointmentDate),
        asText(appointment.startTime),
        asText(appointment.status),
      ].join(' ').toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [normalizedSearch, sortedAppointments]);

  const resolvePatientName = (appointment: Appointment): string => {
    return asText(appointment.patientName)
      || buildPersonName(appointment.patient)
      || (asText(appointment.patientId) ? `Patient #${appointment.patientId}` : '-');
  };

  const resolveDentistName = (appointment: Appointment): string => {
    return asText(appointment.dentistName)
      || buildPersonName(appointment.dentist)
      || (asText(appointment.dentistId) ? `Dentist #${appointment.dentistId}` : '-');
  };

  const openVisitChart = async (appointment: Appointment): Promise<void> => {
    const appointmentId = String(appointment.id);
    const existingVisit = visitsByAppointmentId.get(appointmentId);
    if (existingVisit) {
      const encodedVisitId = encodeURIComponent(String(existingVisit.id));
      router.push(`/${locale}/dental-management/visits/chart?visitId=${encodedVisitId}`);
      return;
    }

    const appointmentStatus = normalizeStatus(asText(appointment.status));
    if (appointmentStatus === 'cancelled' || appointmentStatus === 'canceled') {
      toast.error('Cancelled appointments cannot start a visit.');
      return;
    }

    const patientId = asText(appointment.patientId);
    const dentistId = asText(appointment.dentistId);
    if (!patientId || !dentistId) {
      toast.error('Appointment is missing patient or dentist data.');
      return;
    }

    const now = new Date();
    const visitDate = toDateInputValue(now);
    const rawTag = asText(appointment.tag) || `APT-${appointment.id}`;
    const normalizedTag = rawTag.replace(/[^a-z0-9-_]+/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    const visitTag = `${normalizedTag || `APT-${appointment.id}`}-VIS-${visitDate.replace(/-/g, '')}`.slice(0, 100);

    setPendingAppointmentId(appointmentId);
    try {
      const response = await createVisit.mutateAsync({
        appointmentId,
        dentistId,
        diagnosisNotes: '',
        patientId,
        tag: visitTag,
        visitDate,
      });

      if (!response.success || !response.data) {
        const errorText = typeof response.error?.details === 'string'
          ? response.error.details
          : response.error?.message || 'Failed to start visit.';
        toast.error(errorText);
        return;
      }

      const encodedVisitId = encodeURIComponent(String(response.data.id));
      router.push(`/${locale}/dental-management/visits/chart?visitId=${encodedVisitId}`);
    } finally {
      setPendingAppointmentId(null);
    }
  };

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
              <h2 className="text-base font-semibold">Start Visits From Appointments</h2>
              <p className="text-xs text-muted-foreground">
                Open an existing visit chart or start a new visit directly from an appointment card.
              </p>
            </div>

            <Card className="rounded-2xl border">
              <CardContent className="space-y-4 p-4">
                <div className="relative w-full max-w-md">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchTerm}
                    onChange={(event) => {
                      setSearchTerm(event.target.value);
                    }}
                    placeholder="Search by tag, patient, dentist, date"
                    className="pl-9"
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {isLoadingAppointments || isLoadingVisits ? (
                    <div className="col-span-full rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                      <Loader2 className="mr-2 inline size-4 animate-spin" />
                      Loading appointments...
                    </div>
                  ) : filteredAppointments.length === 0 ? (
                    <div className="col-span-full rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                      No appointments match the current search.
                    </div>
                  ) : (
                    filteredAppointments.map((appointment) => {
                      const appointmentId = String(appointment.id);
                      const appointmentStatus = asText(appointment.status) || 'scheduled';
                      const existingVisit = visitsByAppointmentId.get(appointmentId);
                      const isCancelled = ['cancelled', 'canceled'].includes(normalizeStatus(appointmentStatus));
                      const isPending = pendingAppointmentId === appointmentId;

                      return (
                        <div key={`appointment-card-${appointment.id}`} className="rounded-xl border bg-background p-4">
                          <div className="mb-2 flex items-start justify-between gap-2">
                            <p className="text-sm font-semibold">
                              {asText(appointment.tag) || `Appointment #${appointment.id}`}
                            </p>
                            <span className={cn('rounded-md border px-2 py-0.5 text-[10px] font-semibold capitalize', statusTheme(appointmentStatus))}>
                              {appointmentStatus}
                            </span>
                          </div>

                          <div className="space-y-1.5 text-xs text-muted-foreground">
                            <p className="flex items-center gap-2">
                              <UserRound className="size-3.5" />
                              <span className="font-medium text-foreground">{resolvePatientName(appointment)}</span>
                            </p>
                            <p className="flex items-center gap-2">
                              <Stethoscope className="size-3.5" />
                              <span>{resolveDentistName(appointment)}</span>
                            </p>
                            <p className="flex items-center gap-2">
                              <CalendarDays className="size-3.5" />
                              <span>{toDateLabel(asText(appointment.appointmentDate))}</span>
                            </p>
                            <p className="flex items-center gap-2">
                              <Clock3 className="size-3.5" />
                              <span>
                                {asText(appointment.startTime) || '-'}
                                {asText(appointment.endTime) ? ` - ${asText(appointment.endTime)}` : ''}
                              </span>
                            </p>
                            <p>
                              Visit: <span className="font-medium text-foreground">
                                {existingVisit
                                  ? (existingVisit.tag || `Visit #${existingVisit.id}`)
                                  : 'Not started'}
                              </span>
                            </p>
                          </div>

                          <Button
                            type="button"
                            className="mt-4 w-full"
                            variant={existingVisit ? 'outline' : 'default'}
                            disabled={isCancelled || isPending}
                            onClick={() => {
                              void openVisitChart(appointment);
                            }}
                          >
                            {isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                            {existingVisit ? 'Open Visit Chart' : 'Start Visit Chart'}
                          </Button>
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="rounded-2xl border bg-gradient-to-r from-background to-muted/30 p-4">
              <h2 className="text-base font-semibold">Visit Records</h2>
              <p className="text-xs text-muted-foreground">
                For walk-in visits, use Add and leave Appointment empty.
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
