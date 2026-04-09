'use client';

import { type JSX, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  Users,
  Timer,
  Armchair,
  DoorOpen,
  XCircle,
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

  const nowRef = useRef(new Date());
  const today = toDateInputValue(nowRef.current);
  const [pendingStatusKey, setPendingStatusKey] = useState<string | null>(null);
  const [pendingVisitAppointmentId, setPendingVisitAppointmentId] = useState<string | null>(null);

  // Update now timestamp every 30 seconds to prevent unnecessary re-renders
  useEffect(() => {
    const interval = setInterval(() => {
      nowRef.current = new Date();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

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
      const leftLate = isLateAppointment(left, nowRef.current) ? 0 : 1;
      const rightLate = isLateAppointment(right, nowRef.current) ? 0 : 1;
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
  }, [appointments]);

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
      if (isLateAppointment(appointment, nowRef.current)) {
        late += 1;
      }
      if (['checked_in', 'waiting'].includes(status)) {
        waiting += 1;
      }
      if (status === 'in_chair') {
        inChair += 1;
      }

      const dentistName = asText(appointment.dentistName) || buildPersonName(appointment.dentist);
      const current = dentistMap.get(dentistName) ?? { active: 0, dentist: dentistName || '-', total: 0 };
      const nextStatus = normalizeStatus(asText(appointment.status) || 'scheduled');
      const nextActive = nextStatus !== 'closed' && nextStatus !== 'cancelled' ? current.active + 1 : current.active;
      dentistMap.set(dentistName, { ...current, total: current.total + 1, active: nextActive });
    });

    const byDentist = Array.from(dentistMap.values()).sort((a, b) => b.total - a.total);

    return {
      active: sortedAppointments.filter((appointment) => {
        const status = normalizeStatus(asText(appointment.status) || 'scheduled');
        return status !== 'closed' && status !== 'cancelled';
      }).length,
      byDentist,
      inChair,
      late,
      total: sortedAppointments.length,
      waiting,
    };
  }, [sortedAppointments]);

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
      <div className="flex flex-1 flex-col px-4 pb-6 lg:px-6 overflow-x-hidden">
        <div className="rounded-3xl border border-primary/10 bg-gradient-to-br from-primary/5 via-background to-muted/20 p-6 text-foreground shadow-lg overflow-hidden relative">
          <div className="absolute right-0 top-0 h-48 w-48 translate-x-24 -translate-y-24 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute left-0 bottom-0 h-48 w-48 -translate-x-24 translate-y-24 rounded-full bg-emerald-500/10 blur-3xl" />
          
          <div className="relative mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-xl border border-blue-200/50 bg-blue-100/60 p-2.5">
                  <Users className="size-5 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-2xl font-semibold text-foreground">Waiting Room</h1>
                  <p className="text-sm text-muted-foreground">Manage patient flow and queue status</p>
                </div>
              </div>
              <Badge variant="outline" className="rounded-full border-dashed px-4 py-1.5 text-xs uppercase tracking-[0.22em] bg-white/80">
                {toDateLabel(today)}
              </Badge>
            </div>
          </div>

          <div className="relative grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
            <div className="rounded-2xl border border-border/50 bg-gradient-to-br from-white/80 to-muted/50 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className="rounded-lg border border-violet-200/50 bg-violet-100/60 p-1.5">
                  <Users className="size-4 text-violet-600" />
                </div>
                <p className="text-xs font-medium text-muted-foreground">Today Total</p>
              </div>
              <p className="text-2xl font-bold text-foreground">{summary.total}</p>
            </div>

            <div className="rounded-2xl border border-border/50 bg-gradient-to-br from-white/80 to-muted/50 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className="rounded-lg border border-emerald-200/50 bg-emerald-100/60 p-1.5">
                  <Timer className="size-4 text-emerald-600" />
                </div>
                <p className="text-xs font-medium text-muted-foreground">Active Queue</p>
              </div>
              <p className="text-2xl font-bold text-foreground">{summary.active}</p>
            </div>

            <div className="rounded-2xl border border-border/50 bg-gradient-to-br from-white/80 to-muted/50 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className="rounded-lg border border-amber-200/50 bg-amber-100/60 p-1.5">
                  <Clock3 className="size-4 text-amber-600" />
                </div>
                <p className="text-xs font-medium text-muted-foreground">Waiting Now</p>
              </div>
              <p className="text-2xl font-bold text-foreground">{summary.waiting}</p>
            </div>

            <div className="rounded-2xl border border-border/50 bg-gradient-to-br from-white/80 to-muted/50 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className="rounded-lg border border-blue-200/50 bg-blue-100/60 p-1.5">
                  <Armchair className="size-4 text-blue-600" />
                </div>
                <p className="text-xs font-medium text-muted-foreground">In Chair</p>
              </div>
              <p className="text-2xl font-bold text-foreground">{summary.inChair}</p>
            </div>
          </div>

          <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(18rem,0.9fr)]">
            <div className="space-y-4">
              <div className="grid gap-4 xl:grid-cols-4">
                {QUEUE_COLUMNS.map((column) => {
                  const columnAppointments = groupedAppointments.get(column.id) ?? [];
                  const columnIcons = {
                    arrivals: DoorOpen,
                    ready: Clock3,
                    chair: Armchair,
                    closed: XCircle,
                  };
                  const columnColors = {
                    arrivals: 'border-blue-200/50 bg-blue-100/60 text-blue-600',
                    ready: 'border-amber-200/50 bg-amber-100/60 text-amber-600',
                    chair: 'border-violet-200/50 bg-violet-100/60 text-violet-600',
                    closed: 'border-slate-200/50 bg-slate-100/60 text-slate-600',
                  };
                  const ColumnIcon = columnIcons[column.id];

                  return (
                    <div key={column.id} className="min-w-0 rounded-2xl border border-border/50 bg-gradient-to-br from-white/80 to-muted/50 p-4 shadow-sm">
                      <div className="mb-4">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <div className={`rounded-lg border p-1.5 ${columnColors[column.id]}`}>
                              <ColumnIcon className="size-4" />
                            </div>
                            <h2 className="text-sm font-semibold text-foreground">{column.title}</h2>
                          </div>
                          <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px] bg-background/80">
                            {columnAppointments.length}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{column.description}</p>
                      </div>

                      <div className="space-y-3">
                        {isLoadingAppointments || isLoadingVisits ? (
                          <div className="rounded-xl border border-dashed border-border/50 bg-background/70 px-4 py-5 text-sm text-muted-foreground">
                            <Loader2 className="mr-2 inline size-4 animate-spin" />
                            Loading queue...
                          </div>
                        ) : columnAppointments.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-border/50 bg-background/70 px-4 py-5 text-sm text-muted-foreground">
                            No patients
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
                            const isLate = isLateAppointment(appointment, nowRef.current);
                            const actionButtons = getQueueActions(appointment);

                            return (
                              <div
                                key={`queue-appointment-${appointment.id}`}
                                className={cn('rounded-xl border p-3 shadow-sm transition-colors', statusMeta.panelClass)}
                              >
                                <div className="flex items-start justify-between gap-2 mb-3">
                                  <div className="min-w-0">
                                    <p className="truncate text-xs font-semibold text-foreground">
                                      {asText(appointment.tag) || `APT-${appointment.id}`}
                                    </p>
                                    <p className="truncate text-[11px] text-muted-foreground">
                                      {asText(appointment.startTime) || '-'}
                                    </p>
                                  </div>
                                  <div className="flex flex-col items-end gap-1">
                                    <Badge variant="outline" className={cn('rounded-full border px-2 py-0.5 text-[10px]', statusMeta.badgeClass)}>
                                      {statusMeta.label}
                                    </Badge>
                                    {isLate ? (
                                      <Badge variant="outline" className="rounded-full border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] text-amber-900">
                                        Late
                                      </Badge>
                                    ) : null}
                                  </div>
                                </div>

                                <div className="space-y-1.5 text-[11px] text-muted-foreground mb-3">
                                  <p className="flex items-center gap-1.5">
                                    <UserRound className="size-3" />
                                    <span className="min-w-0 truncate font-medium text-foreground">{patientName}</span>
                                  </p>
                                  <p className="flex items-center gap-1.5">
                                    <Stethoscope className="size-3" />
                                    <span className="min-w-0 truncate">{dentistName}</span>
                                  </p>
                                </div>

                                <div className="flex flex-wrap gap-1.5 mb-3">
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
                                        className="h-7 text-[11px] px-2"
                                        onClick={() => {
                                          void handleStatusChange(appointment, action.status);
                                        }}
                                      >
                                        {isPending ? <Loader2 className="size-3 animate-spin" /> : null}
                                        {action.label}
                                      </Button>
                                    );
                                  })}
                                </div>

                                <div className="rounded-lg border border-border/30 bg-background/80 p-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="min-w-0">
                                      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Visit</p>
                                      <p className="truncate text-[11px] font-medium text-foreground">
                                        {existingVisit ? (existingVisit.tag || `Visit #${existingVisit.id}`) : 'Not started'}
                                      </p>
                                    </div>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant={existingVisit ? 'outline' : 'default'}
                                      disabled={pendingVisitAppointmentId === String(appointment.id)}
                                      className="h-7 w-7 p-0"
                                      onClick={() => {
                                        void openOrCreateVisit(appointment);
                                      }}
                                    >
                                      {pendingVisitAppointmentId === String(appointment.id) ? (
                                        <Loader2 className="size-3 animate-spin" />
                                      ) : (
                                        <ArrowRight className="size-3" />
                                      )}
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
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-border/50 bg-gradient-to-br from-white/80 to-muted/50 p-4 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="rounded-lg border border-amber-200/50 bg-amber-100/60 p-2">
                    <AlertTriangle className="size-4 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Queue Pressure</h3>
                    <p className="text-xs text-muted-foreground">Monitor delays and chair occupancy</p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="rounded-xl border border-amber-200/60 bg-amber-50/80 p-3">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="size-4 text-amber-700" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-amber-900">{summary.late} late arrivals</p>
                        <p className="text-[11px] text-amber-800">
                          Patients past appointment time
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-violet-200/60 bg-violet-50/80 p-3">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="size-4 text-violet-700" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-violet-900">{summary.inChair} in chair</p>
                        <p className="text-[11px] text-violet-800">
                          Currently seated with dentist
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-sky-200/60 bg-sky-50/80 p-3">
                    <div className="flex items-center gap-3">
                      <CalendarDays className="size-4 text-sky-700" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-sky-900">{summary.waiting} ready</p>
                        <p className="text-[11px] text-sky-800">
                          Checked-in and waiting
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-border/50 bg-gradient-to-br from-white/80 to-muted/50 p-4 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="rounded-lg border border-emerald-200/50 bg-emerald-100/60 p-2">
                    <Stethoscope className="size-4 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Dentist Load</h3>
                    <p className="text-xs text-muted-foreground">Balance the live queue</p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  {summary.byDentist.length > 0 ? summary.byDentist.map((row) => (
                    <div key={row.dentist} className="rounded-xl border border-border/40 bg-background/60 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-foreground">{row.dentist}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {row.total} total / {row.active} active
                          </p>
                        </div>
                        <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[10px] bg-background/80">
                          {row.active}
                        </Badge>
                      </div>
                    </div>
                  )) : (
                    <div className="rounded-xl border border-dashed border-border/50 px-4 py-4 text-[11px] text-muted-foreground">
                      No dentist assignments found
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
