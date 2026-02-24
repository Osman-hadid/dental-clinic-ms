'use client';

import { type CSSProperties, JSX, useMemo, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utilities';
import {
  Activity,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  Search,
  Stethoscope,
  UsersRound,
} from 'lucide-react';

type EventType = 'appointment' | 'visit';

type ScheduleEvent = {
  date: Date;
  dateKey: string;
  dentistName: string;
  key: string;
  linkedVisitId?: number | string | null;
  note: string;
  patientId?: number | string;
  patientName: string;
  status: string;
  tag: string;
  timeLabel: string;
  title: string;
  type: EventType;
};

type StatusMeta = {
  badge: string;
  chip: string;
  row: string;
};

type CalendarStatusBucket = 'cancelled' | 'completed' | 'in_progress' | 'other' | 'scheduled';

type CalendarStatusTheme = {
  badge: string;
  cell: string;
};

type CalendarCellTheme = {
  badgeClass: string;
  badgeStyle?: CSSProperties;
  cellClass: string;
  cellStyle?: CSSProperties;
};

export type DashboardPatient = {
  createdAt?: string;
  firstName?: string;
  id: number | string;
  lastName?: string;
  patientCode?: string;
};

export type DashboardAppointment = {
  appointmentDate?: string;
  dentist?: unknown;
  dentistId?: string | number;
  dentistName?: string;
  id: number | string;
  notes?: string;
  patient?: unknown;
  patientId?: string | number;
  patientName?: string;
  startTime?: string;
  status?: string;
  tag?: string;
  visits?: unknown;
};

export type DashboardVisit = {
  appointmentId?: string | number;
  appointment?: unknown;
  dentist?: unknown;
  dentistId?: string | number;
  dentistName?: string;
  diagnosisNotes?: string;
  id: number | string;
  patient?: unknown;
  patientId?: string | number;
  patientName?: string;
  tag?: string;
  visitDate?: string;
};

type DentalChartDashboardProps = {
  appointments: DashboardAppointment[];
  isLoading?: boolean;
  locale: string;
  patients: DashboardPatient[];
  visits: DashboardVisit[];
};

const CALENDAR_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MS_IN_DAY = 24 * 60 * 60 * 1000;

const asText = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  return value.trim();
};

const toDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const startOfDay = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const startOfMonth = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), 1);

const parseDateOnly = (value: unknown): Date | null => {
  const raw = asText(value);
  if (!raw) return null;

  const datePart = raw.includes('T') ? raw.split('T')[0] : raw;
  const [yearPart, monthPart, dayPart] = datePart.split('-');
  const year = Number(yearPart);
  const month = Number(monthPart);
  const day = Number(dayPart);

  if (
    Number.isInteger(year)
    && Number.isInteger(month)
    && Number.isInteger(day)
    && year > 1900
    && month >= 1
    && month <= 12
    && day >= 1
    && day <= 31
  ) {
    return new Date(year, month - 1, day);
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return startOfDay(parsed);
};

const parseTimeParts = (value: unknown): { hour: number; minute: number } | null => {
  const raw = asText(value);
  if (!raw) return null;

  const match = raw.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

  return { hour, minute };
};

const parseDateTime = (dateValue: unknown, timeValue: unknown): Date | null => {
  const date = parseDateOnly(dateValue);
  if (!date) return null;

  const time = parseTimeParts(timeValue);
  if (!time) return date;

  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), time.hour, time.minute, 0, 0);
};

const formatMonth = (date: Date): string => new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
}).format(date);

const formatDayHeading = (date: Date): string => new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'short',
  weekday: 'long',
}).format(date);

const formatClock = (date: Date): string => new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
}).format(date);

const buildNameFromRelation = (value: unknown): string => {
  if (!value || typeof value !== 'object') return '';
  const relation = value as Record<string, unknown>;

  const firstName = asText(relation.firstName) || asText(relation.first_name);
  const lastName = asText(relation.lastName) || asText(relation.last_name);
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
  if (fullName) return fullName;

  return asText(relation.fullName)
    || asText(relation.full_name)
    || asText(relation.name)
    || '';
};

const extractFirstVisitId = (value: unknown): string | number | null => {
  if (Array.isArray(value)) {
    for (const item of value) {
      if (item && typeof item === 'object' && 'id' in item) {
        const idValue = (item as Record<string, unknown>).id;
        if (typeof idValue === 'string' || typeof idValue === 'number') {
          return idValue;
        }
      }
    }
    return null;
  }

  if (value && typeof value === 'object' && 'data' in value) {
    const dataValue = (value as Record<string, unknown>).data;
    return extractFirstVisitId(dataValue);
  }

  if (value && typeof value === 'object' && 'id' in value) {
    const idValue = (value as Record<string, unknown>).id;
    if (typeof idValue === 'string' || typeof idValue === 'number') {
      return idValue;
    }
  }

  return null;
};

const normalizeStatus = (status: string): string => status.trim().toLowerCase().replace(/\s+/g, '_');
const isCompletedStatus = (status: string): boolean => {
  const normalized = normalizeStatus(status);
  return normalized === 'completed' || normalized === 'done';
};

const CALENDAR_STATUS_THEME: Record<CalendarStatusBucket, CalendarStatusTheme> = {
  cancelled: { badge: '#e11d48', cell: '#fecdd3' },
  completed: { badge: '#16a34a', cell: '#bbf7d0' },
  in_progress: { badge: '#7c3aed', cell: '#ddd6fe' },
  other: { badge: '#d97706', cell: '#fde68a' },
  scheduled: { badge: '#2563eb', cell: '#bfdbfe' },
};

const CALENDAR_BUCKET_ORDER: CalendarStatusBucket[] = ['cancelled', 'in_progress', 'scheduled', 'completed', 'other'];

const toCalendarStatusBucket = (status: string): CalendarStatusBucket => {
  const normalized = normalizeStatus(status);

  if (normalized === 'cancelled' || normalized === 'canceled' || normalized === 'rejected') return 'cancelled';
  if (normalized === 'in_progress' || normalized === 'ongoing') return 'in_progress';
  if (normalized === 'scheduled' || normalized === 'confirmed') return 'scheduled';
  if (normalized === 'completed' || normalized === 'done') return 'completed';
  return 'other';
};

const statusTheme = (status: string): StatusMeta => {
  const normalized = normalizeStatus(status);

  if (normalized === 'completed' || normalized === 'done') {
    return {
      badge: 'border-emerald-300 bg-emerald-100 text-emerald-800',
      chip: 'border-emerald-300 bg-emerald-50 text-emerald-700',
      row: 'border-emerald-200/70 bg-emerald-50/60',
    };
  }

  if (normalized === 'cancelled' || normalized === 'canceled' || normalized === 'rejected') {
    return {
      badge: 'border-rose-300 bg-rose-100 text-rose-800',
      chip: 'border-rose-300 bg-rose-50 text-rose-700',
      row: 'border-rose-200/70 bg-rose-50/60',
    };
  }

  if (normalized === 'scheduled' || normalized === 'confirmed') {
    return {
      badge: 'border-blue-300 bg-blue-100 text-blue-800',
      chip: 'border-blue-300 bg-blue-50 text-blue-700',
      row: 'border-blue-200/70 bg-blue-50/60',
    };
  }

  if (normalized === 'in_progress' || normalized === 'ongoing') {
    return {
      badge: 'border-violet-300 bg-violet-100 text-violet-800',
      chip: 'border-violet-300 bg-violet-50 text-violet-700',
      row: 'border-violet-200/70 bg-violet-50/60',
    };
  }

  return {
    badge: 'border-amber-300 bg-amber-100 text-amber-800',
    chip: 'border-amber-300 bg-amber-50 text-amber-700',
    row: 'border-amber-200/70 bg-amber-50/60',
  };
};

const calendarCellTheme = (events: ScheduleEvent[]): CalendarCellTheme => {
  if (events.length === 0) {
    return {
      badgeClass: 'bg-primary/15 text-primary',
      cellClass: 'border-transparent bg-transparent',
    };
  }

  const uniqueBuckets = CALENDAR_BUCKET_ORDER.filter((bucket, index, array) => {
    if (!events.some((event) => toCalendarStatusBucket(event.status) === bucket)) return false;
    return array.indexOf(bucket) === index;
  });

  if (uniqueBuckets.length === 1) {
    const bucket = uniqueBuckets[0];
    const palette = CALENDAR_STATUS_THEME[bucket];
    return {
      badgeClass: 'text-white',
      badgeStyle: { backgroundColor: palette.badge },
      cellClass: 'text-foreground',
      cellStyle: { backgroundColor: palette.cell, borderColor: `${palette.badge}66` },
    };
  }

  const step = 100 / uniqueBuckets.length;
  const gradientStops = uniqueBuckets.map((bucket, index) => {
    const start = (index * step).toFixed(2);
    const end = ((index + 1) * step).toFixed(2);
    return `${CALENDAR_STATUS_THEME[bucket].cell} ${start}% ${end}%`;
  }).join(', ');
  const badgeStops = uniqueBuckets.map((bucket, index) => {
    const start = (index * step).toFixed(2);
    const end = ((index + 1) * step).toFixed(2);
    return `${CALENDAR_STATUS_THEME[bucket].badge} ${start}% ${end}%`;
  }).join(', ');

  return {
    badgeClass: 'text-white',
    badgeStyle: { backgroundImage: `linear-gradient(135deg, ${badgeStops})` },
    cellClass: 'text-foreground border-primary/40',
    cellStyle: { backgroundImage: `linear-gradient(135deg, ${gradientStops})` },
  };
};

const toSearchBlob = (event: ScheduleEvent): string => {
  return `${event.patientName} ${event.dentistName} ${event.tag} ${event.status} ${event.note} ${event.title}`.toLowerCase();
};

const ToothIllustration = (): JSX.Element => {
  return (
    <div className="relative isolate overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/15 via-background to-primary/5 p-4">
      <div className="pointer-events-none absolute -right-8 -top-10 size-32 rounded-full bg-primary/20 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-8 -left-8 size-24 rounded-full bg-accent/40 blur-2xl" />
      <p className="text-left text-lg font-semibold text-primary">Daily Overview</p>
      <div className="relative z-10 mx-auto h-44 w-full max-w-[260px]">
        <Image
          src="/tooth.png"
          alt="Tooth illustration"
          fill
          sizes="260px"
          className="object-contain"
          priority
        />
      </div>
    </div>
  );
};

export const DentalChartDashboard = ({
  appointments,
  isLoading = false,
  locale,
  patients,
  visits,
}: DentalChartDashboardProps): JSX.Element => {
  const router = useRouter();
  const now = new Date();
  const today = startOfDay(now);

  const [currentMonth, setCurrentMonth] = useState<Date>(startOfMonth(today));
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [manualSelectedEventKey, setManualSelectedEventKey] = useState<string | null>(null);

  const patientNameById = useMemo(() => {
    const map = new Map<string, string>();
    patients.forEach((patient) => {
      const fullName = [asText(patient.firstName), asText(patient.lastName)].filter(Boolean).join(' ').trim();
      const fallback = fullName || asText(patient.patientCode) || `Patient #${patient.id}`;
      map.set(String(patient.id), fallback);
    });
    return map;
  }, [patients]);

  const visitIdByAppointmentId = useMemo(() => {
    const map = new Map<string, string | number>();
    visits.forEach((visit) => {
      const appointmentId = visit.appointmentId;
      if (appointmentId !== undefined && appointmentId !== null && !map.has(String(appointmentId))) {
        map.set(String(appointmentId), visit.id);
      }
    });
    return map;
  }, [visits]);

  const appointmentEvents = useMemo<ScheduleEvent[]>(() => {
    const events: ScheduleEvent[] = [];

    appointments.forEach((appointment, index) => {
      const dateTime = parseDateTime(appointment.appointmentDate, appointment.startTime);
      if (!dateTime) return;

      const patientName = asText(appointment.patientName)
        || buildNameFromRelation(appointment.patient)
        || patientNameById.get(String(appointment.patientId ?? ''))
        || `Patient #${appointment.patientId ?? appointment.id}`;

      const dentistName = asText(appointment.dentistName)
        || buildNameFromRelation(appointment.dentist)
        || `Dentist #${appointment.dentistId ?? '-'}`;

      events.push({
        date: dateTime,
        dateKey: toDateKey(dateTime),
        dentistName,
        key: `appointment-${appointment.id}-${index}`,
        linkedVisitId:
          extractFirstVisitId(appointment.visits)
          ?? visitIdByAppointmentId.get(String(appointment.id))
          ?? null,
        note: asText(appointment.notes),
        patientId: appointment.patientId,
        patientName,
        status: asText(appointment.status) || 'scheduled',
        tag: asText(appointment.tag) || `Appointment #${appointment.id}`,
        timeLabel: formatClock(dateTime),
        title: 'Appointment',
        type: 'appointment',
      });
    });

    return events.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [appointments, patientNameById, visitIdByAppointmentId]);

  const visitEvents = useMemo<ScheduleEvent[]>(() => {
    const events: ScheduleEvent[] = [];

    visits.forEach((visit, index) => {
      const fallbackTime = visit.appointment
        && typeof visit.appointment === 'object'
        ? (visit.appointment as Record<string, unknown>).startTime
        : '';

      const dateTime = parseDateTime(visit.visitDate, fallbackTime);
      if (!dateTime) return;

      const patientName = asText(visit.patientName)
        || buildNameFromRelation(visit.patient)
        || patientNameById.get(String(visit.patientId ?? ''))
        || `Patient #${visit.patientId ?? visit.id}`;

      const dentistName = asText(visit.dentistName)
        || buildNameFromRelation(visit.dentist)
        || `Dentist #${visit.dentistId ?? '-'}`;

      events.push({
        date: dateTime,
        dateKey: toDateKey(dateTime),
        dentistName,
        key: `visit-${visit.id}-${index}`,
        linkedVisitId: visit.id,
        note: asText(visit.diagnosisNotes),
        patientId: visit.patientId,
        patientName,
        status: 'completed',
        tag: asText(visit.tag) || `Visit #${visit.id}`,
        timeLabel: formatClock(dateTime),
        title: 'Visit',
        type: 'visit',
      });
    });

    return events.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [patientNameById, visits]);

  const calendarEvents = useMemo(
    () => appointmentEvents.slice().sort((a, b) => a.date.getTime() - b.date.getTime()),
    [appointmentEvents]
  );

  const eventsByDate = useMemo(() => {
    const map = new Map<string, ScheduleEvent[]>();
    calendarEvents.forEach((event) => {
      const existing = map.get(event.dateKey) ?? [];
      existing.push(event);
      map.set(event.dateKey, existing);
    });
    return map;
  }, [calendarEvents]);

  const eventCountByDate = useMemo(() => {
    const map = new Map<string, number>();
    calendarEvents.forEach((event) => {
      map.set(event.dateKey, (map.get(event.dateKey) ?? 0) + 1);
    });
    return map;
  }, [calendarEvents]);

  const selectedDateKey = useMemo(() => toDateKey(selectedDate), [selectedDate]);

  const selectedDateEvents = useMemo(() => {
    return (eventsByDate.get(selectedDateKey) ?? []).slice().sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [eventsByDate, selectedDateKey]);

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const filteredSelectedDateEvents = useMemo(() => {
    if (!normalizedSearch) return selectedDateEvents;
    return selectedDateEvents.filter((event) => toSearchBlob(event).includes(normalizedSearch));
  }, [normalizedSearch, selectedDateEvents]);

  const selectedEvent = useMemo(() => {
    if (manualSelectedEventKey) {
      const matched = filteredSelectedDateEvents.find((event) => event.key === manualSelectedEventKey);
      if (matched) return matched;
    }
    return filteredSelectedDateEvents[0] ?? null;
  }, [filteredSelectedDateEvents, manualSelectedEventKey]);

  const todayKey = useMemo(() => toDateKey(today), [today]);
  const todayEvents = useMemo(() => eventsByDate.get(todayKey) ?? [], [eventsByDate, todayKey]);
  const todayVisits = useMemo(
    () => visitEvents.filter((event) => event.dateKey === todayKey).length,
    [visitEvents, todayKey]
  );
  const todayAppointments = useMemo(() => {
    return todayEvents.length;
  }, [todayEvents]);

  const appointmentCount = appointmentEvents.length;
  const completedAppointmentCount = appointmentEvents.filter((event) => event.status.toLowerCase() === 'completed').length;
  const cancelledAppointmentCount = appointmentEvents.filter((event) => event.status.toLowerCase() === 'cancelled').length;
  const scheduledAppointmentCount = Math.max(
    appointmentCount - completedAppointmentCount - cancelledAppointmentCount,
    0
  );
  const completionRate = appointmentCount > 0
    ? Math.round((completedAppointmentCount / appointmentCount) * 100)
    : 0;

  const newPatients = useMemo(() => {
    return patients.filter((patient) => {
      const createdAt = parseDateOnly(patient.createdAt);
      if (!createdAt) return false;
      return (today.getTime() - createdAt.getTime()) <= (30 * MS_IN_DAY);
    }).length;
  }, [patients, today]);

  const returningPatients = Math.max(patients.length - newPatients, 0);

  const upcomingEvents = useMemo(() => {
    const startTime = today.getTime();
    const events = appointmentEvents.filter((event) => {
      if (event.date.getTime() < startTime) return false;
      if (isCompletedStatus(event.status)) return false;
      return true;
    });
    if (!normalizedSearch) return events.slice(0, 5);
    return events.filter((event) => toSearchBlob(event).includes(normalizedSearch)).slice(0, 5);
  }, [appointmentEvents, normalizedSearch, today]);

  const monthGrid = useMemo(() => {
    const year = currentMonth.getFullYear();
    const monthIndex = currentMonth.getMonth();
    const firstWeekday = new Date(year, monthIndex, 1).getDay();
    const totalDays = new Date(year, monthIndex + 1, 0).getDate();

    const cells: Array<{ date: Date | null; key: string }> = [];
    for (let offset = 0; offset < firstWeekday; offset += 1) {
      cells.push({ date: null, key: `empty-start-${offset}` });
    }

    for (let day = 1; day <= totalDays; day += 1) {
      const date = new Date(year, monthIndex, day);
      cells.push({ date, key: toDateKey(date) });
    }

    while (cells.length % 7 !== 0) {
      cells.push({ date: null, key: `empty-end-${cells.length}` });
    }

    return cells;
  }, [currentMonth]);

  const goToPreviousMonth = (): void => {
    setCurrentMonth((previous) => new Date(previous.getFullYear(), previous.getMonth() - 1, 1));
  };

  const goToNextMonth = (): void => {
    setCurrentMonth((previous) => new Date(previous.getFullYear(), previous.getMonth() + 1, 1));
  };

  const selectedEventStatus = statusTheme(selectedEvent?.status ?? 'scheduled');
  const openTreatmentChartFromSelection = (): void => {
    if (!selectedEvent) return;

    if (isCompletedStatus(selectedEvent.status)) {
      if (selectedEvent.patientId !== null && selectedEvent.patientId !== undefined) {
        router.push(`/${locale}/dental-management/patients/${selectedEvent.patientId}`);
        return;
      }

      router.push(`/${locale}/dental-management/patients`);
      return;
    }

    if (selectedEvent.linkedVisitId !== null && selectedEvent.linkedVisitId !== undefined) {
      router.push(`/${locale}/dental-management/visits/${selectedEvent.linkedVisitId}`);
      return;
    }

    router.push(`/${locale}/dental-management/visits`);
  };

  return (
    <div>
      <Card className="overflow-hidden rounded-3xl border border-border/80 bg-card pt-0 shadow-sm">
        <CardContent>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:max-w-xl">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                }}
                placeholder="Find patients or appointments"
                className="h-11 rounded-xl border-input bg-background pl-10"
              />
            </div>
            <div>
              <div className="flex items-center justify-center">
                <Image
                  src="/logo2.png"
                  alt="Clinic logo"
                  width={160}
                  height={160}
                  sizes="160px"
                  quality={100}
                  className="h-40 w-40 object-contain"
                />
              </div>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.8fr_1fr]">
            <div className="space-y-4">
              <section className="grid gap-4 rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/20 via-background to-background p-5 lg:grid-cols-[1.25fr_0.95fr]">
                <div>
                  <p className="text-sm text-muted-foreground">Good morning, Doctor</p>
                  <h3 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">Today&apos;s Patient Visits</h3>
                  <div className="mt-3 flex flex-wrap items-end gap-2">
                    <span className="text-5xl font-bold leading-none">{todayVisits}</span>
                    <span className="pb-1 text-sm text-muted-foreground">patients</span>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-blue-300 bg-blue-50/80 p-3">
                      <p className="text-xs text-blue-700">New Patients (30d)</p>
                      <p className="mt-1 text-2xl font-semibold text-blue-900">{newPatients}</p>
                    </div>
                    <div className="rounded-xl border border-violet-300 bg-violet-50/80 p-3">
                      <p className="text-xs text-violet-700">Returning Patients</p>
                      <p className="mt-1 text-2xl font-semibold text-violet-900">{returningPatients}</p>
                    </div>
                    <div className="rounded-xl border border-emerald-300 bg-emerald-50/80 p-3">
                      <p className="text-xs text-emerald-700">Appointments Today</p>
                      <p className="mt-1 text-2xl font-semibold text-emerald-900">{todayAppointments}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        router.push(`/${locale}/dental-management/appointments`);
                      }}
                      className="bg-primary text-primary-foreground hover:bg-accent hover:text-accent-foreground"
                    >
                      New Appointment
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        router.push(`/${locale}/dental-management/visits`);
                      }}
                    >
                      Register Visit
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        router.push(`/${locale}/dental-management/patients`);
                      }}
                    >
                      Open Patients
                    </Button>
                  </div>
                </div>

                <ToothIllustration />
              </section>

              <section className="grid gap-3 lg:grid-cols-[1fr_1fr]">
                <div className="rounded-2xl border bg-background p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h4 className="font-semibold">Patient List</h4>
                    <span className="text-xs text-muted-foreground">{formatDayHeading(selectedDate)}</span>
                  </div>
                  <div className="space-y-2">
                    {isLoading ? (
                      <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Loading schedule...</p>
                    ) : filteredSelectedDateEvents.length === 0 ? (
                      <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                        No visits or appointments for this date.
                      </p>
                    ) : (
                      filteredSelectedDateEvents.map((event) => {
                        const isActive = selectedEvent?.key === event.key;
                        const theme = statusTheme(event.status);
                        return (
                          <button
                            key={event.key}
                            type="button"
                            onClick={() => {
                              setManualSelectedEventKey(event.key);
                            }}
                            className={cn(
                              'flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left transition',
                              theme.row,
                              isActive
                                ? 'ring-2 ring-primary/40'
                                : 'hover:border-primary/40 hover:bg-accent/20'
                            )}
                          >
                            <div>
                              <p className="text-sm font-semibold">{event.patientName}</p>
                              <p className="text-xs text-muted-foreground">{event.title} - {event.tag}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={cn('rounded-md border px-2 py-0.5 text-[10px] font-semibold capitalize', theme.chip)}>
                                {event.status}
                              </span>
                              <span className="rounded-lg border bg-background px-2 py-1 text-[11px] font-medium text-foreground">
                                {event.timeLabel}
                              </span>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border bg-background p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Stethoscope className="size-4 text-primary" />
                    <h4 className="font-semibold">Consultation</h4>
                  </div>

                  {!selectedEvent ? (
                    <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                      Select an appointment to see details.
                    </p>
                  ) : (
                    <div className="space-y-3 text-sm">
                      <button
                        type="button"
                        onClick={openTreatmentChartFromSelection}
                        className={cn(
                          'w-full rounded-xl border p-3 text-left transition hover:border-primary/45 hover:bg-accent/15',
                          selectedEventStatus.row
                        )}
                      >
                        <p className="text-base font-semibold">{selectedEvent.patientName}</p>
                        <p className="text-xs text-muted-foreground">{selectedEvent.title} - {selectedEvent.tag}</p>
                      </button>
                      <div className="grid gap-2">
                        <button
                          type="button"
                          onClick={openTreatmentChartFromSelection}
                          className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition hover:border-primary/45 hover:bg-accent/15"
                        >
                          <span className="text-muted-foreground">Dentist</span>
                          <span className="font-medium">{selectedEvent.dentistName}</span>
                        </button>
                        <button
                          type="button"
                          onClick={openTreatmentChartFromSelection}
                          className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition hover:border-primary/45 hover:bg-accent/15"
                        >
                          <span className="text-muted-foreground">Time</span>
                          <span className="font-medium">{selectedEvent.timeLabel}</span>
                        </button>
                        <button
                          type="button"
                          onClick={openTreatmentChartFromSelection}
                          className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition hover:border-primary/45 hover:bg-accent/15"
                        >
                          <span className="text-muted-foreground">Status</span>
                          <span
                            className={cn(
                              'rounded-md border px-2 py-0.5 text-xs font-medium capitalize',
                              selectedEventStatus.badge
                            )}
                          >
                            {selectedEvent.status}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={openTreatmentChartFromSelection}
                          className="w-full rounded-lg border px-3 py-2 text-left transition hover:border-primary/45 hover:bg-accent/15"
                        >
                          <p className="mb-1 text-muted-foreground">Notes</p>
                          <p className="text-foreground">
                            {selectedEvent.note || 'No notes available for this record.'}
                          </p>
                        </button>
                        <Button
                          type="button"
                          onClick={openTreatmentChartFromSelection}
                          className="mt-1 bg-primary text-primary-foreground hover:bg-accent hover:text-accent-foreground"
                        >
                          {isCompletedStatus(selectedEvent.status) ? 'Open Patient Profile' : 'Open Treatment Chart'}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            </div>

            <aside className="space-y-4">
              <section className="rounded-2xl border bg-background p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">Your Schedule</p>
                    <p className="text-xs text-muted-foreground">{formatMonth(currentMonth)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button type="button" variant="ghost" size="icon" className="size-8" onClick={goToPreviousMonth}>
                      <ChevronLeft className="size-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="size-8" onClick={goToNextMonth}>
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                </div>

                <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted-foreground">
                  {CALENDAR_WEEKDAYS.map((weekday) => (
                    <div key={weekday}>{weekday}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {monthGrid.map((cell) => {
                    if (!cell.date) {
                      return <div key={cell.key} className="h-9 rounded-md bg-transparent" />;
                    }

                    const cellKey = toDateKey(cell.date);
                    const dateEvents = eventsByDate.get(cellKey) ?? [];
                    const eventCount = dateEvents.length;
                    const cellTheme = calendarCellTheme(dateEvents);
                    const isToday = cellKey === todayKey;
                    const isSelected = cellKey === selectedDateKey;

                    return (
                      <button
                        key={cell.key}
                        type="button"
                        onClick={() => {
                          setSelectedDate(cell.date as Date);
                        }}
                        className={cn(
                          'relative h-9 rounded-md border text-sm transition',
                          isSelected
                            ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                            : eventCount > 0
                              ? `${cellTheme.cellClass} hover:brightness-95`
                              : 'border-transparent hover:border-primary/40 hover:bg-accent/25',
                          isToday && !isSelected ? 'ring-1 ring-primary/45' : ''
                        )}
                        style={!isSelected && eventCount > 0 ? cellTheme.cellStyle : undefined}
                      >
                        {cell.date.getDate()}
                        {eventCount > 0 ? (
                          <span
                            className={cn(
                              'absolute right-1 top-1 inline-flex min-w-4 justify-center rounded-full px-1 text-[10px] leading-4',
                              isSelected ? 'bg-primary-foreground/90 text-primary' : cellTheme.badgeClass
                            )}
                            style={!isSelected ? cellTheme.badgeStyle : undefined}
                          >
                            {eventCount}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="rounded-2xl border bg-background p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="font-semibold">Upcoming</p>
                  <span className="text-xs text-muted-foreground">{upcomingEvents.length} records</span>
                </div>

                <div className="space-y-2">
                  {upcomingEvents.length === 0 ? (
                    <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                      No upcoming visits or appointments.
                    </p>
                  ) : (
                    upcomingEvents.map((event) => {
                      const theme = statusTheme(event.status);

                      return (
                        <div key={event.key} className={cn('rounded-xl border p-3', theme.row)}>
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold">{event.patientName}</p>
                            <span className={cn('rounded-md border px-2 py-0.5 text-[10px] font-semibold capitalize', theme.chip)}>
                              {event.status}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {event.title} - {event.tag}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatDayHeading(event.date)} - {event.timeLabel}
                          </p>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>
            </aside>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="rounded-2xl border">
          <CardContent className="p-4">
            <div className="mb-2 flex items-center gap-2">
              <Activity className="size-4 text-primary" />
              <p className="text-sm font-semibold">Visit Performance</p>
            </div>
            <p className="text-3xl font-semibold">{completionRate}%</p>
            <p className="text-xs text-muted-foreground">Completed appointments ratio</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border">
          <CardContent className="p-4">
            <div className="mb-2 flex items-center gap-2">
              <CalendarDays className="size-4 text-primary" />
              <p className="text-sm font-semibold">Calendar Coverage</p>
            </div>
            <p className="text-3xl font-semibold">{eventCountByDate.size}</p>
            <p className="text-xs text-muted-foreground">Days with any scheduled record</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border">
          <CardContent className="p-4">
            <div className="mb-2 flex items-center gap-2">
              <UsersRound className="size-4 text-primary" />
              <p className="text-sm font-semibold">Patient Pool</p>
            </div>
            <p className="text-3xl font-semibold">{patients.length}</p>
            <p className="text-xs text-muted-foreground">Registered patients in current feed</p>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border">
        <CardContent className="grid gap-3 p-4 md:grid-cols-4">
          <div className="rounded-xl border bg-background p-3">
            <div className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
              <ClipboardList className="size-3.5" />
              Appointments
            </div>
            <p className="text-xl font-semibold">{appointmentCount}</p>
          </div>
          <div className="rounded-xl border bg-background p-3">
            <div className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
              <Clock3 className="size-3.5" />
              Scheduled
            </div>
            <p className="text-xl font-semibold">{scheduledAppointmentCount}</p>
          </div>
          <div className="rounded-xl border bg-background p-3">
            <div className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
              <Activity className="size-3.5" />
              Completed
            </div>
            <p className="text-xl font-semibold">{completedAppointmentCount}</p>
          </div>
          <div className="rounded-xl border bg-background p-3">
            <div className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
              <CalendarDays className="size-3.5" />
              Cancelled
            </div>
            <p className="text-xl font-semibold">{cancelledAppointmentCount}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
