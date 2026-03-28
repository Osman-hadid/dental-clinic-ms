'use client';

import { type JSX, useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Header } from '@/components/header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCan } from '@/hooks/useCan';
import { cn } from '@/lib/utilities';
import { type Appointment } from '@/modules/dental-management/domain/entities/Appointment';
import { type Visit } from '@/modules/dental-management/domain/entities/Visit';
import { appointmentConfig } from '@/modules/dental-management/presentation/config/appointment-config';
import { visitConfig } from '@/modules/dental-management/presentation/config/visit-config';
import {
  useAppointmentList,
  useCreateVisit,
  useUpdateAppointment,
  useVisitList,
} from '@/modules/dental-management/presentation/hooks';
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Loader2,
  Stethoscope,
  UserRound,
} from 'lucide-react';
import { toast } from 'sonner';

type QueueColumn = {
  description: string;
  id: 'arrivals' | 'ready' | 'chair' | 'closed';
  title: string;
  statuses: string[];
};

const QUEUE_COLUMNS: QueueColumn[] = [
  {
    description: 'Patients due soon or newly checked in.',
    id: 'arrivals',
    statuses: ['scheduled', 'checked_in'],
    title: 'Arrivals',
  },
  {
    description: 'Patients ready and waiting for a chair.',
    id: 'ready',
    statuses: ['waiting'],
    title: 'Waiting',
  },
  {
    description: 'Patients currently seated with the dentist.',
    id: 'chair',
    statuses: ['in_chair'],
    title: 'In Chair',
  },
  {
    description: 'Finished or cancelled appointments.',
    id: 'closed',
    statuses: ['completed', 'cancelled'],
    title: 'Closed',
  },
];

const STATUS_META: Record<string, { badgeClass: string; label: string; panelClass: string }> = {
  cancelled: {
    badgeClass: 'border-rose-300 bg-rose-100 text-rose-800',
    label: 'Cancelled',
    panelClass: 'border-rose-200/80 bg-rose-50/80',
  },
  checked_in: {
    badgeClass: 'border-sky-300 bg-sky-100 text-sky-800',
    label: 'Checked In',
    panelClass: 'border-sky-200/80 bg-sky-50/80',
  },
  completed: {
    badgeClass: 'border-emerald-300 bg-emerald-100 text-emerald-800',
    label: 'Completed',
    panelClass: 'border-emerald-200/80 bg-emerald-50/80',
  },
  in_chair: {
    badgeClass: 'border-violet-300 bg-violet-100 text-violet-800',
    label: 'In Chair',
    panelClass: 'border-violet-200/80 bg-violet-50/80',
  },
  scheduled: {
    badgeClass: 'border-amber-300 bg-amber-100 text-amber-800',
    label: 'Scheduled',
    panelClass: 'border-amber-200/80 bg-amber-50/80',
  },
  waiting: {
    badgeClass: 'border-blue-300 bg-blue-100 text-blue-800',
    label: 'Waiting',
    panelClass: 'border-blue-200/80 bg-blue-50/80',
  },
};

const asText = (value: unknown): string => {
  if (typeof value === 'number') return String(value).trim();
  if (typeof value !== 'string') return '';
  return value.trim();
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

const toDateInputValue = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const toDateLabel = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value || '-';

  return new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
};

const resolveStatusMeta = (status: string) => STATUS_META[normalizeStatus(status)] ?? STATUS_META.scheduled;

const isLateAppointment = (appointment: Appointment, now: Date): boolean => {
  const status = normalizeStatus(asText(appointment.status) || 'scheduled');
  if (!['scheduled', 'checked_in', 'waiting'].includes(status)) {
    return false;
  }

  const appointmentDate = asText(appointment.appointmentDate);
  const startTime = asText(appointment.startTime);
  if (!appointmentDate || !startTime) {
    return false;
  }

  const scheduledAt = new Date(`${appointmentDate}T${startTime}:00`);
  if (Number.isNaN(scheduledAt.getTime())) {
    return false;
  }

  return scheduledAt.getTime() < now.getTime();
};

const buildAppointmentUpdatePayload = (appointment: Appointment, status: string): Partial<Omit<Appointment, 'id' | 'createdAt' | 'updatedAt'>> => ({
  appointmentDate: appointment.appointmentDate,
  dentistId: appointment.dentistId,
  endTime: appointment.endTime || appointment.startTime,
  notes: appointment.notes,
  patientId: appointment.patientId,
  startTime: appointment.startTime,
  status,
});

const getQueueActions = (appointment: Appointment): Array<{ label: string; status: string; variant: 'default' | 'outline' | 'secondary' }> => {
  const status = normalizeStatus(asText(appointment.status) || 'scheduled');

  switch (status) {
    case 'scheduled':
      return [
        { label: 'Check In', status: 'checked_in', variant: 'default' },
        { label: 'Cancel', status: 'cancelled', variant: 'outline' },
      ];
    case 'checked_in':
      return [
        { label: 'Move to Waiting', status: 'waiting', variant: 'default' },
        { label: 'Seat Patient', status: 'in_chair', variant: 'secondary' },
        { label: 'Cancel', status: 'cancelled', variant: 'outline' },
      ];
    case 'waiting':
      return [
        { label: 'Seat Patient', status: 'in_chair', variant: 'default' },
        { label: 'Back to Check In', status: 'checked_in', variant: 'outline' },
      ];
    case 'in_chair':
      return [
        { label: 'Complete', status: 'completed', variant: 'default' },
        { label: 'Return to Waiting', status: 'waiting', variant: 'outline' },
      ];
    default:
      return [];
  }
};

// eslint-disable-next-line react/function-component-definition
export default function QueuePage(): JSX.Element {
  const router = useRouter();
  const locale = useLocale();
  const tSidebar = useTranslations('sidebar.dentalManagement');
  const { can } = useCan();
  const canUpdateAppointments = can(appointmentConfig.permissions.update);
  const canCreateVisits = can(visitConfig.permissions.create);

  const now = new Date();
  const today = toDateInputValue(now);
  const [pendingStatusKey, setPendingStatusKey] = useState<string | null>(null);
  const [pendingVisitAppointmentId, setPendingVisitAppointmentId] = useState<string | null>(null);

  const {
    entities: appointments,
    isFetching: isLoadingAppointments,
    refetch: refetchAppointments,
  } = useAppointmentList(
    1,
    100,
    '',
    ['tag', 'notes'],
    ['patient', 'dentist'],
    { dateFrom: [today], dateTo: [today] }
  );

  const {
    entities: visits,
    isFetching: isLoadingVisits,
    refetch: refetchVisits,
  } = useVisitList(
    1,
    100,
    '',
    ['tag'],
    ['appointment', 'patient', 'dentist'],
    { dateFrom: [today], dateTo: [today] }
  );

  const updateAppointment = useUpdateAppointment();
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
      const leftLate = isLateAppointment(left, now) ? 0 : 1;
      const rightLate = isLateAppointment(right, now) ? 0 : 1;
      if (leftLate !== rightLate) {
        return leftLate - rightLate;
      }

      const leftTime = `${asText(left.appointmentDate)}T${asText(left.startTime) || '00:00'}:00`;
      const rightTime = `${asText(right.appointmentDate)}T${asText(right.startTime) || '00:00'}:00`;
      const leftTimestamp = new Date(leftTime).getTime();
      const rightTimestamp = new Date(rightTime).getTime();

      return leftTimestamp - rightTimestamp;
    });

    return next;
  }, [appointments, now]);

  const groupedAppointments = useMemo(() => {
    const groups = new Map<string, Appointment[]>();
    QUEUE_COLUMNS.forEach((column) => {
      groups.set(column.id, []);
    });

    sortedAppointments.forEach((appointment) => {
      const status = normalizeStatus(asText(appointment.status) || 'scheduled');
      const targetColumn = QUEUE_COLUMNS.find((column) => column.statuses.includes(status)) ?? QUEUE_COLUMNS[0];
      groups.get(targetColumn.id)?.push(appointment);
    });

    return groups;
  }, [sortedAppointments]);

  const summary = useMemo(() => {
    const dentistMap = new Map<string, { active: number; dentist: string; total: number }>();
    let late = 0;
    let waiting = 0;
    let inChair = 0;

    sortedAppointments.forEach((appointment) => {
      const status = normalizeStatus(asText(appointment.status) || 'scheduled');
      const dentist = asText(appointment.dentistName)
        || buildPersonName(appointment.dentist)
        || (asText(appointment.dentistId) ? `Dentist #${appointment.dentistId}` : 'Unassigned dentist');

      const row = dentistMap.get(dentist) ?? { active: 0, dentist, total: 0 };
      row.total += 1;
      if (['scheduled', 'checked_in', 'waiting', 'in_chair'].includes(status)) {
        row.active += 1;
      }
      dentistMap.set(dentist, row);

      if (isLateAppointment(appointment, now)) late += 1;
      if (['checked_in', 'waiting'].includes(status)) waiting += 1;
      if (status === 'in_chair') inChair += 1;
    });

    return {
      active: sortedAppointments.filter((appointment) => !['completed', 'cancelled'].includes(normalizeStatus(asText(appointment.status) || 'scheduled'))).length,
      byDentist: Array.from(dentistMap.values()).sort((left, right) => right.active - left.active || right.total - left.total),
      late,
      total: sortedAppointments.length,
      waiting,
      inChair,
    };
  }, [sortedAppointments, now]);

  const handleStatusChange = useCallback(async (appointment: Appointment, nextStatus: string): Promise<void> => {
    if (!canUpdateAppointments) {
      toast.error('You do not have permission to update appointments.');
      return;
    }

    const pendingKey = `${appointment.id}:${nextStatus}`;
    setPendingStatusKey(pendingKey);

    try {
      const response = await updateAppointment.mutateAsync({
        data: buildAppointmentUpdatePayload(appointment, nextStatus),
        id: appointment.id,
      });

      if (!response.success) {
        toast.error(response.error?.message || 'Failed to update queue status.');
        return;
      }

      toast.success(`Appointment moved to ${resolveStatusMeta(nextStatus).label}.`);
      await Promise.all([refetchAppointments(), refetchVisits()]);
    } catch {
      toast.error('Failed to update queue status.');
    } finally {
      setPendingStatusKey(null);
    }
  }, [canUpdateAppointments, refetchAppointments, refetchVisits, updateAppointment]);

  const openOrCreateVisit = useCallback(async (appointment: Appointment): Promise<void> => {
    const appointmentId = String(appointment.id);
    const existingVisit = visitsByAppointmentId.get(appointmentId);

    if (existingVisit) {
      const encodedVisitId = encodeURIComponent(String(existingVisit.id));
      router.push(`/${locale}/dental-management/visits/chart?visitId=${encodedVisitId}`);
      return;
    }

    if (!canCreateVisits) {
      toast.error('You do not have permission to create visits.');
      return;
    }

    const currentStatus = normalizeStatus(asText(appointment.status) || 'scheduled');
    if (currentStatus === 'cancelled' || currentStatus === 'completed') {
      toast.error('Closed appointments cannot start a visit.');
      return;
    }

    const patientId = asText(appointment.patientId);
    const dentistId = asText(appointment.dentistId);
    if (!patientId || !dentistId) {
      toast.error('Appointment is missing patient or dentist data.');
      return;
    }

    const rawTag = asText(appointment.tag) || `APT-${appointment.id}`;
    const normalizedTag = rawTag.replace(/[^a-z0-9-_]+/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    const visitTag = `${normalizedTag || `APT-${appointment.id}`}-VIS-${today.replace(/-/g, '')}`.slice(0, 100);

    setPendingVisitAppointmentId(appointmentId);
    try {
      const response = await createVisit.mutateAsync({
        appointmentId,
        dentistId,
        diagnosisNotes: '',
        patientId,
        tag: visitTag,
        visitDate: today,
      });

      if (!response.success || !response.data) {
        toast.error(response.error?.message || 'Failed to start visit.');
        return;
      }

      if (currentStatus !== 'in_chair' && currentStatus !== 'completed') {
        await updateAppointment.mutateAsync({
          data: buildAppointmentUpdatePayload(appointment, 'in_chair'),
          id: appointment.id,
        });
      }

      await Promise.all([refetchAppointments(), refetchVisits()]);
      const encodedVisitId = encodeURIComponent(String(response.data.id));
      router.push(`/${locale}/dental-management/visits/chart?visitId=${encodedVisitId}`);
    } catch {
      toast.error('Failed to start visit.');
    } finally {
      setPendingVisitAppointmentId(null);
    }
  }, [canCreateVisits, createVisit, locale, refetchAppointments, refetchVisits, router, today, updateAppointment, visitsByAppointmentId]);

  return (
    <>
      <Header
        breadcrumbs={[
          { id: 'dentalManagement', label: tSidebar('title') },
          { id: 'queue', isCurrent: true, label: 'Waiting Room' },
        ]}
      />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:px-6 md:py-6">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(18rem,0.9fr)]">
              <Card className="rounded-3xl border">
                <CardHeader className="gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <CardTitle>Today&apos;s waiting room</CardTitle>
                      <CardDescription>
                        Check patients in, move them into waiting or chair status, and open their visit chart from one place.
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="rounded-full border-dashed px-3 py-1 text-xs uppercase tracking-[0.22em]">
                      {toDateLabel(today)}
                    </Badge>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl border bg-muted/20 p-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Today total</p>
                      <p className="mt-2 text-2xl font-semibold">{summary.total}</p>
                    </div>
                    <div className="rounded-2xl border bg-muted/20 p-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Active queue</p>
                      <p className="mt-2 text-2xl font-semibold">{summary.active}</p>
                    </div>
                    <div className="rounded-2xl border bg-muted/20 p-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Waiting now</p>
                      <p className="mt-2 text-2xl font-semibold">{summary.waiting}</p>
                    </div>
                    <div className="rounded-2xl border bg-muted/20 p-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">In chair</p>
                      <p className="mt-2 text-2xl font-semibold">{summary.inChair}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 xl:grid-cols-4">
                    {QUEUE_COLUMNS.map((column) => {
                      const columnAppointments = groupedAppointments.get(column.id) ?? [];

                      return (
                        <div key={column.id} className="min-w-0 rounded-2xl border bg-muted/10 p-3">
                          <div className="mb-3">
                            <div className="flex items-center justify-between gap-2">
                              <h2 className="text-sm font-semibold">{column.title}</h2>
                              <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px]">
                                {columnAppointments.length}
                              </Badge>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">{column.description}</p>
                          </div>

                          <div className="space-y-3">
                            {isLoadingAppointments || isLoadingVisits ? (
                              <div className="rounded-2xl border border-dashed bg-background/70 px-4 py-5 text-sm text-muted-foreground">
                                <Loader2 className="mr-2 inline size-4 animate-spin" />
                                Loading queue...
                              </div>
                            ) : columnAppointments.length === 0 ? (
                              <div className="rounded-2xl border border-dashed bg-background/70 px-4 py-5 text-sm text-muted-foreground">
                                No patients in this stage.
                              </div>
                            ) : (
                              columnAppointments.map((appointment) => {
                                const status = normalizeStatus(asText(appointment.status) || 'scheduled');
                                const statusMeta = resolveStatusMeta(status);
                                const patientName = asText(appointment.patientName)
                                  || buildPersonName(appointment.patient)
                                  || (asText(appointment.patientId) ? `Patient #${appointment.patientId}` : '-');
                                const dentistName = asText(appointment.dentistName)
                                  || buildPersonName(appointment.dentist)
                                  || (asText(appointment.dentistId) ? `Dentist #${appointment.dentistId}` : '-');
                                const existingVisit = visitsByAppointmentId.get(String(appointment.id));
                                const isLate = isLateAppointment(appointment, now);
                                const actionButtons = getQueueActions(appointment);

                                return (
                                  <div
                                    key={`queue-appointment-${appointment.id}`}
                                    className={cn('rounded-2xl border p-4 shadow-sm transition-colors', statusMeta.panelClass)}
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold text-foreground">
                                          {asText(appointment.tag) || `Appointment #${appointment.id}`}
                                        </p>
                                        <p className="mt-1 truncate text-xs text-muted-foreground">
                                          {toDateLabel(asText(appointment.appointmentDate))} at {asText(appointment.startTime) || '-'}
                                        </p>
                                      </div>
                                      <div className="flex flex-col items-end gap-1">
                                        <Badge variant="outline" className={cn('rounded-full border px-2.5 py-0.5 text-[11px]', statusMeta.badgeClass)}>
                                          {statusMeta.label}
                                        </Badge>
                                        {isLate ? (
                                          <Badge variant="outline" className="rounded-full border-amber-300 bg-amber-100 px-2.5 py-0.5 text-[11px] text-amber-900">
                                            Late
                                          </Badge>
                                        ) : null}
                                      </div>
                                    </div>

                                    <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                                      <p className="flex items-center gap-2">
                                        <UserRound className="size-3.5" />
                                        <span className="min-w-0 truncate font-medium text-foreground">{patientName}</span>
                                      </p>
                                      <p className="flex items-center gap-2">
                                        <Stethoscope className="size-3.5" />
                                        <span className="min-w-0 truncate">{dentistName}</span>
                                      </p>
                                      <p className="flex items-center gap-2">
                                        <Clock3 className="size-3.5" />
                                        <span>
                                          {asText(appointment.startTime) || '-'}
                                          {asText(appointment.endTime) ? ` - ${asText(appointment.endTime)}` : ''}
                                        </span>
                                      </p>
                                      {asText(appointment.notes) ? (
                                        <p className="rounded-xl border bg-background/80 px-3 py-2 text-[11px] leading-5 text-foreground/80">
                                          {asText(appointment.notes)}
                                        </p>
                                      ) : null}
                                    </div>

                                    <div className="mt-4 flex flex-wrap gap-2">
                                      {actionButtons.map((action) => {
                                        const key = `${appointment.id}:${action.status}`;
                                        const isPending = pendingStatusKey === key;

                                        return (
                                          <Button
                                            key={action.status}
                                            type="button"
                                            size="sm"
                                            variant={action.variant}
                                            disabled={!canUpdateAppointments || isPending || pendingVisitAppointmentId === String(appointment.id)}
                                            onClick={() => {
                                              void handleStatusChange(appointment, action.status);
                                            }}
                                          >
                                            {isPending ? <Loader2 className="size-3.5 animate-spin" /> : null}
                                            {action.label}
                                          </Button>
                                        );
                                      })}
                                    </div>

                                    <div className="mt-4 rounded-2xl border bg-background/80 p-3">
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="min-w-0">
                                          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Visit chart</p>
                                          <p className="mt-1 truncate text-sm font-medium text-foreground">
                                            {existingVisit ? (existingVisit.tag || `Visit #${existingVisit.id}`) : 'Not started'}
                                          </p>
                                        </div>
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant={existingVisit ? 'outline' : 'default'}
                                          disabled={pendingVisitAppointmentId === String(appointment.id)}
                                          onClick={() => {
                                            void openOrCreateVisit(appointment);
                                          }}
                                        >
                                          {pendingVisitAppointmentId === String(appointment.id) ? (
                                            <Loader2 className="size-3.5 animate-spin" />
                                          ) : (
                                            <ArrowRight className="size-3.5" />
                                          )}
                                          {existingVisit ? 'Open' : 'Start'}
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-4">
                <Card className="rounded-3xl border">
                  <CardHeader>
                    <CardTitle>Queue pressure</CardTitle>
                    <CardDescription>
                      Keep an eye on active patients, delays, and how many chairs are already occupied.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="mt-0.5 size-4 text-amber-700" />
                        <div>
                          <p className="text-sm font-semibold text-amber-900">{summary.late} late arrivals</p>
                          <p className="mt-1 text-xs text-amber-800">
                            Patients whose appointment time has already passed and still need to be moved forward.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="mt-0.5 size-4 text-violet-700" />
                        <div>
                          <p className="text-sm font-semibold text-violet-900">{summary.inChair} patient(s) in chair</p>
                          <p className="mt-1 text-xs text-violet-800">
                            Chair occupancy updates automatically when a visit is started from this board.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
                      <div className="flex items-start gap-3">
                        <CalendarDays className="mt-0.5 size-4 text-sky-700" />
                        <div>
                          <p className="text-sm font-semibold text-sky-900">{summary.waiting} patient(s) ready</p>
                          <p className="mt-1 text-xs text-sky-800">
                            Includes both checked-in and waiting patients who are still in the active queue.
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-3xl border">
                  <CardHeader>
                    <CardTitle>Dentist load</CardTitle>
                    <CardDescription>
                      Doctor assignment is shown here so the front desk can balance the live queue quickly.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {summary.byDentist.length > 0 ? summary.byDentist.map((row) => (
                      <div key={row.dentist} className="rounded-2xl border bg-muted/20 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{row.dentist}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {row.total} appointment(s) today
                            </p>
                          </div>
                          <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px]">
                            {row.active} active
                          </Badge>
                        </div>
                      </div>
                    )) : (
                      <div className="rounded-2xl border border-dashed px-4 py-5 text-sm text-muted-foreground">
                        No dentist assignments were found for today&apos;s queue.
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
