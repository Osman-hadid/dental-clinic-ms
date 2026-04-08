'use client';

import { JSX, useEffect, useMemo, useState } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utilities';
import { type Appointment } from '@/modules/dental-management/domain/entities/Appointment';
import {
  ChevronLeft,
  ChevronRight,
  Clock3,
  Plus,
  Search,
  UserRound,
} from 'lucide-react';

type ReservationType = 'consultation' | 'emergency' | 'treatment';

type SchedulerAppointment = {
  dateKey: string;
  dentistName: string;
  endTime: string;
  endTimeLabel: string;
  id: number;
  notes: string;
  patientName: string;
  rawDate: Date;
  startTime: string;
  startTimeLabel: string;
  status: string;
  tag: string;
  type: ReservationType;
};

type AppointmentsSchedulerProps = {
  appointments: Appointment[];
  canCreate?: boolean;
  dentistOptions?: SchedulerPartyOption[];
  isLoading?: boolean;
  isSubmittingCreate?: boolean;
  onCreateAppointment?: (payload: SchedulerCreatePayload) => Promise<{ message?: string; success: boolean }>;
  patientOptions?: SchedulerPartyOption[];
};

export type SchedulerPartyOption = {
  id: string;
  label: string;
};

export type SchedulerCreatePayload = {
  appointmentDate: string;
  dentistId: string;
  endTime: string;
  notes: string;
  patientId: string;
  startTime: string;
  status: 'scheduled';
};

const DEFAULT_TIME_SLOTS = Array.from({ length: 21 }, (_, index) => {
  const totalMinutes = (8 * 60) + (index * 30);
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
});
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

const asText = (value: unknown): string => {
  if (typeof value === 'number') return String(value).trim();
  if (typeof value !== 'string') return '';
  return value.trim();
};

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
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
};

const startOfDay = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const toDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const shiftDays = (date: Date, delta: number): Date => {
  const next = new Date(date);
  next.setDate(next.getDate() + delta);
  return startOfDay(next);
};

const startOfMonth = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), 1);

const shiftMonths = (date: Date, delta: number): Date => startOfMonth(new Date(date.getFullYear(), date.getMonth() + delta, 1));

const isSameMonth = (left: Date, right: Date): boolean => (
  left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth()
);

const getMonthDays = (month: Date): Date[] => {
  const start = startOfMonth(month);
  const year = start.getFullYear();
  const monthIndex = start.getMonth();
  const totalDays = new Date(year, monthIndex + 1, 0).getDate();

  return Array.from({ length: totalDays }, (_, index) => new Date(year, monthIndex, index + 1));
};

const normalizeTime = (value: unknown): string => {
  const raw = asText(value);
  const match = raw.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return '';
  return `${match[1].padStart(2, '0')}:${match[2]}`;
};

const toMinutes = (value: string): number => {
  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) return Number.MAX_SAFE_INTEGER;
  return (Number(match[1]) * 60) + Number(match[2]);
};

const fromMinutes = (minutes: number): string => {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

const addMinutes = (value: string, step: number): string => {
  const total = toMinutes(value);
  if (!Number.isFinite(total) || total === Number.MAX_SAFE_INTEGER) return value;
  return fromMinutes(Math.max(0, total + step));
};

const formatClock = (time24h: string): string => {
  const match = time24h.match(/^(\d{2}):(\d{2})$/);
  if (!match) return time24h || '--:--';
  const date = new Date();
  date.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
};

const relationName = (value: unknown): string => {
  if (!value || typeof value !== 'object') return '';
  const relation = value as Record<string, unknown>;
  const firstName = asText(relation.firstName) || asText(relation.first_name);
  const lastName = asText(relation.lastName) || asText(relation.last_name);
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
  if (fullName) return fullName;
  return asText(relation.fullName) || asText(relation.full_name) || asText(relation.name);
};

const appointmentType = (appointment: Appointment): ReservationType => {
  const blob = `${asText(appointment.tag)} ${asText(appointment.notes)}`.toLowerCase();
  if (blob.includes('emerg') || blob.includes('urgent') || blob.includes('pain')) return 'emergency';
  if (blob.includes('treat') || blob.includes('implant') || blob.includes('surgery')) return 'treatment';
  if (blob.includes('consult') || blob.includes('check') || blob.includes('exam')) return 'consultation';
  return 'consultation';
};

const normalizeStatus = (status: string): string => status.trim().toLowerCase().replace(/\s+/g, '_');

const isOccupiedStatus = (status: string): boolean => {
  const normalized = normalizeStatus(status);
  return [
    'scheduled',
    'confirmed',
    'checked_in',
    'waiting',
    'in_chair',
    'in_progress',
    'ongoing',
  ].includes(normalized);
};

const typeMeta: Record<
ReservationType,
{ label: string; pillClass: string }
> = {
  consultation: {
    label: 'Consultation',
    pillClass: 'border-blue-300 bg-blue-50 text-blue-700',
  },
  emergency: {
    label: 'Emergency care',
    pillClass: 'border-rose-300 bg-rose-50 text-rose-700',
  },
  treatment: {
    label: 'Treatment',
    pillClass: 'border-emerald-300 bg-emerald-50 text-emerald-700',
  },
};

const weekdayLabel = (date: Date): string => new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date);
const monthLabel = (date: Date): string => new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date);

export const AppointmentsScheduler = ({
  appointments,
  canCreate = false,
  dentistOptions = [],
  isLoading = false,
  isSubmittingCreate = false,
  onCreateAppointment,
  patientOptions = [],
}: AppointmentsSchedulerProps): JSX.Element => {
  const today = useMemo(() => startOfDay(new Date()), []);
  const [selectedMonth, setSelectedMonth] = useState<Date>(startOfMonth(today));
  const [selectedDayKey, setSelectedDayKey] = useState<string>(toDateKey(today));
  const [hoveredDayKey, setHoveredDayKey] = useState<string | null>(null);
  const [quickAddOpen, setQuickAddOpen] = useState<boolean>(false);
  const [selectedTime, setSelectedTime] = useState<string>('all');
  const [timePickTarget, setTimePickTarget] = useState<'end' | 'start'>('start');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<number | null>(null);
  const [quickCreateError, setQuickCreateError] = useState<string>('');
  const [quickCreateData, setQuickCreateData] = useState<{
    appointmentDate: string;
    dentistId: string;
    endTime: string;
    notes: string;
    patientId: string;
    startTime: string;
  }>({
    appointmentDate: selectedDayKey,
    dentistId: '',
    endTime: '08:30',
    notes: '',
    patientId: '',
    startTime: '08:00',
  });

  const normalizedAppointments = useMemo<SchedulerAppointment[]>(() => {
    return appointments.reduce<SchedulerAppointment[]>((accumulator, appointment) => {
        const parsedDate = parseDateOnly(appointment.appointmentDate);
        if (!parsedDate) return accumulator;

        const startTime = normalizeTime(appointment.startTime);
        const endTime = normalizeTime(appointment.endTime);
        const patientName = asText(appointment.patientName)
          || relationName(appointment.patient)
          || `Patient #${appointment.patientId}`;
        const dentistName = asText(appointment.dentistName)
          || relationName(appointment.dentist)
          || `Dentist #${appointment.dentistId}`;

        accumulator.push({
          dateKey: toDateKey(parsedDate),
          dentistName,
          endTime,
          endTimeLabel: formatClock(endTime),
          id: appointment.id,
          notes: asText(appointment.notes),
          patientName,
          rawDate: parsedDate,
          startTime,
          startTimeLabel: formatClock(startTime),
          status: asText(appointment.status) || 'scheduled',
          tag: asText(appointment.tag) || 'Appointment',
          type: appointmentType(appointment),
        });

        return accumulator;
      }, [])
      .sort((left, right) => {
        const dateCompare = left.dateKey.localeCompare(right.dateKey);
        if (dateCompare !== 0) return dateCompare;
        return toMinutes(left.startTime) - toMinutes(right.startTime);
      });
  }, [appointments]);

  const visibleDays = useMemo(() => getMonthDays(selectedMonth), [selectedMonth]);
  const leadingBlankDays = useMemo(() => visibleDays[0]?.getDay() ?? 0, [visibleDays]);

  useEffect(() => {
    const selectedDate = parseDateOnly(selectedDayKey);
    if (selectedDate && isSameMonth(selectedDate, selectedMonth)) {
      return;
    }

    const fallbackDay = isSameMonth(today, selectedMonth)
      ? today
      : (visibleDays[0] ?? selectedMonth);

    setSelectedDayKey(toDateKey(fallbackDay));
    setSelectedTime('all');
  }, [selectedDayKey, selectedMonth, today, visibleDays]);

  useEffect(() => {
    setQuickCreateData((current) => ({
      ...current,
      appointmentDate: selectedDayKey,
    }));
    setTimePickTarget('start');
  }, [selectedDayKey]);

  const selectedDayAppointments = useMemo(
    () => normalizedAppointments.filter((item) => item.dateKey === selectedDayKey),
    [normalizedAppointments, selectedDayKey]
  );

  const occupiedAppointmentsByDay = useMemo(() => {
    const map = new Map<string, number>();
    normalizedAppointments.forEach((item) => {
      if (!isOccupiedStatus(item.status)) return;
      map.set(item.dateKey, (map.get(item.dateKey) ?? 0) + 1);
    });
    return map;
  }, [normalizedAppointments]);

  const occupiedSlotsByDay = useMemo(() => {
    const map = new Map<string, Set<string>>();
    normalizedAppointments.forEach((item) => {
      if (!isOccupiedStatus(item.status)) return;

      const startMinutes = toMinutes(item.startTime);
      const parsedEndMinutes = toMinutes(item.endTime);
      const endMinutes = parsedEndMinutes > startMinutes ? parsedEndMinutes : startMinutes + 30;
      if (startMinutes === Number.MAX_SAFE_INTEGER) return;

      const slots = map.get(item.dateKey) ?? new Set<string>();
      for (let minute = startMinutes; minute < endMinutes; minute += 30) {
        slots.add(fromMinutes(minute));
      }
      map.set(item.dateKey, slots);
    });
    return map;
  }, [normalizedAppointments]);

  const occupiedSlotsForSelectedDay = useMemo(
    () => occupiedSlotsByDay.get(selectedDayKey) ?? new Set<string>(),
    [occupiedSlotsByDay, selectedDayKey]
  );

  const availableTimes = useMemo(() => {
    const source = [
      ...DEFAULT_TIME_SLOTS,
      ...selectedDayAppointments.map((item) => item.startTime).filter(Boolean),
    ];
    return [...new Set(source)].sort((left, right) => toMinutes(left) - toMinutes(right));
  }, [selectedDayAppointments]);

  const filteredAppointments = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return selectedDayAppointments.filter((item) => {
      if (selectedTime !== 'all' && item.startTime !== selectedTime) return false;
      if (!normalizedSearch) return true;

      const blob = `${item.patientName} ${item.dentistName} ${item.tag} ${item.notes} ${item.status}`.toLowerCase();
      return blob.includes(normalizedSearch);
    });
  }, [searchTerm, selectedDayAppointments, selectedTime]);

  useEffect(() => {
    if (filteredAppointments.length === 0) {
      setSelectedAppointmentId(null);
      return;
    }

    const stillVisible = filteredAppointments.some((item) => item.id === selectedAppointmentId);
    if (!stillVisible) {
      setSelectedAppointmentId(filteredAppointments[0].id);
    }
  }, [filteredAppointments, selectedAppointmentId]);

  const selectedAppointment = useMemo(() => {
    if (filteredAppointments.length === 0) return null;
    return filteredAppointments.find((item) => item.id === selectedAppointmentId) ?? filteredAppointments[0];
  }, [filteredAppointments, selectedAppointmentId]);

  const canSubmitQuickCreate = canCreate
    && patientOptions.length > 0
    && dentistOptions.length > 0
    && typeof onCreateAppointment === 'function';

  const submitQuickCreate = async (): Promise<void> => {
    if (!canSubmitQuickCreate || !onCreateAppointment) return;

    if (
      !quickCreateData.patientId
      || !quickCreateData.dentistId
      || !quickCreateData.appointmentDate
      || !quickCreateData.startTime
      || !quickCreateData.endTime
    ) {
      setQuickCreateError('Patient, dentist, date, start time, and end time are required.');
      return;
    }

    if (toMinutes(quickCreateData.endTime) <= toMinutes(quickCreateData.startTime)) {
      setQuickCreateError('End time must be later than start time.');
      return;
    }

    setQuickCreateError('');

    const createPayload: SchedulerCreatePayload = {
      appointmentDate: quickCreateData.appointmentDate,
      dentistId: quickCreateData.dentistId,
      endTime: quickCreateData.endTime,
      notes: quickCreateData.notes.trim(),
      patientId: quickCreateData.patientId,
      startTime: quickCreateData.startTime,
      status: 'scheduled',
    };

    const result = await onCreateAppointment(createPayload);
    if (!result.success) {
      setQuickCreateError(result.message || 'Could not create appointment.');
      return;
    }

    setQuickAddOpen(false);
    setQuickCreateData((current) => ({
      ...current,
      endTime: addMinutes(current.startTime || '08:00', 30),
      notes: '',
      startTime: current.startTime || '08:00',
    }));
    setTimePickTarget('start');
  };

  const handleTimeSlotClick = (slot: string): void => {
    setSelectedTime(slot);
    setQuickCreateError('');

    setTimePickTarget((currentTarget) => {
      setQuickCreateData((current) => {
        if (currentTarget === 'start') {
          const normalizedSlot = normalizeTime(slot) || slot;
          const nextEnd = toMinutes(current.endTime) > toMinutes(normalizedSlot)
            ? current.endTime
            : addMinutes(normalizedSlot, 30);
          return {
            ...current,
            endTime: nextEnd,
            startTime: normalizedSlot,
          };
        }

        const normalizedSlot = normalizeTime(slot) || slot;
        const normalizedStart = normalizeTime(current.startTime) || normalizedSlot;
        const slotMinutes = toMinutes(normalizedSlot);
        const startMinutes = toMinutes(normalizedStart);

        if (slotMinutes === Number.MAX_SAFE_INTEGER || startMinutes === Number.MAX_SAFE_INTEGER) {
          return {
            ...current,
            endTime: normalizedSlot,
            startTime: normalizedStart,
          };
        }

        if (slotMinutes === startMinutes) {
          return {
            ...current,
            endTime: addMinutes(normalizedStart, 30),
            startTime: normalizedStart,
          };
        }

        if (slotMinutes < startMinutes) {
          return {
            ...current,
            endTime: normalizedStart,
            startTime: normalizedSlot,
          };
        }

        return {
          ...current,
          endTime: normalizedSlot,
          startTime: normalizedStart,
        };
      });

      return currentTarget === 'start' ? 'end' : 'start';
    });
  };

  return (
    <Card className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-[#f8fafc] pt-0 shadow-sm">
      <CardContent className="overflow-hidden p-4 md:p-5">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
          <div className="min-w-0 space-y-4">
            <section className="relative overflow-hidden rounded-3xl border border-blue-200 bg-gradient-to-r from-[#0f7ae5] via-[#1579d9] to-[#1f8ee8] p-5 text-white">
              <div className="pointer-events-none absolute -right-16 -top-16 size-36 rounded-full bg-white/15 blur-3xl" />
              <p className="text-xs uppercase tracking-[0.22em] text-blue-100">Appointment center</p>
              <h2 className="mt-1 text-3xl font-semibold leading-tight">Interactive Scheduler</h2>
              <p className="mt-1 max-w-xl text-sm text-blue-100/95">
                Filter by day and time to manage bookings faster.
              </p>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-slate-900">Schedule</h3>
                  <p className="text-sm text-slate-500">Book and manage dental appointments with ease.</p>
                </div>
                <div className="flex items-center gap-2">
                  {canCreate ? (
                    <Button
                      type="button"
                      className="h-8 rounded-xl bg-blue-600 px-3 text-white hover:bg-blue-700"
                      onClick={() => {
                        setQuickAddOpen((open) => !open);
                      }}
                    >
                      <Plus className="mr-1 size-4" />
                      {quickAddOpen ? 'Close add' : 'Add appointment'}
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-8 rounded-xl"
                    onClick={() => {
                      setSelectedMonth((current) => shiftMonths(current, -1));
                    }}
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-8 rounded-xl"
                    onClick={() => {
                      setSelectedMonth((current) => shiftMonths(current, 1));
                    }}
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>

              <p className="mt-4 text-sm font-medium text-slate-600">{monthLabel(selectedMonth)}</p>

              <div className="mt-3 grid grid-cols-7 gap-2 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                {WEEKDAY_LABELS.map((label) => (
                  <div key={label} className="py-1">
                    {label}
                  </div>
                ))}
              </div>

              <div className="mt-2 grid grid-cols-7 gap-2">
                {Array.from({ length: leadingBlankDays }, (_, index) => (
                  <div key={`blank-${index}`} aria-hidden="true" className="min-h-20 rounded-2xl border border-dashed border-transparent" />
                ))}
                {visibleDays.map((day) => {
                  const key = toDateKey(day);
                  const isSelected = key === selectedDayKey;
                  const isHovered = key === hoveredDayKey;
                  const isToday = key === toDateKey(today);
                  const dayCount = occupiedAppointmentsByDay.get(key) ?? 0;
                  const isOccupiedDay = dayCount > 0;
                  return (
                    <button
                      key={key}
                      type="button"
                      onMouseEnter={() => {
                        setHoveredDayKey(key);
                      }}
                      onMouseLeave={() => {
                        setHoveredDayKey((current) => (current === key ? null : current));
                      }}
                      onClick={() => {
                        setSelectedDayKey(key);
                        setSelectedTime('all');
                      }}
                      className={cn(
                        'min-h-20 rounded-2xl border px-2 py-2 text-center transition-all duration-200',
                        isSelected
                          ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-md ring-2 ring-blue-200/60'
                          : isOccupiedDay
                            ? 'border-rose-300 bg-rose-50 text-rose-700 hover:border-rose-400 hover:bg-rose-100/70'
                          : isHovered
                            ? 'border-blue-300 bg-blue-50/80 text-blue-700 -translate-y-0.5 shadow-sm'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50/40 hover:-translate-y-0.5'
                      )}
                    >
                      <p className="text-[11px] leading-tight">{weekdayLabel(day)}</p>
                      <p className="text-lg font-semibold leading-tight">{day.getDate()}</p>
                      <p className="text-[11px] font-medium text-slate-500">{isToday ? 'Today' : monthLabel(day).split(' ')[0]}</p>
                      <p className="text-[11px] text-slate-500">{dayCount}</p>
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 flex max-w-full gap-2 overflow-x-auto pb-1">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTime('all');
                    setTimePickTarget('start');
                  }}
                  className={cn(
                    'rounded-full border px-4 py-1.5 text-sm transition',
                    selectedTime === 'all'
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300'
                  )}
                >
                  All times
                </button>
                {availableTimes.map((slot) => {
                  const isSelectedFilter = selectedTime === slot;
                  const isStart = quickCreateData.startTime === slot;
                  const isEnd = quickCreateData.endTime === slot;
                  const isOccupiedSlot = occupiedSlotsForSelectedDay.has(slot);
                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => {
                        handleTimeSlotClick(slot);
                      }}
                      className={cn(
                        'rounded-full border px-4 py-1.5 text-sm transition',
                        isStart
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : isEnd
                            ? 'border-blue-300 bg-blue-100 text-blue-800'
                            : isOccupiedSlot
                              ? 'border-rose-300 bg-rose-100 text-rose-800'
                            : isSelectedFilter
                              ? 'border-blue-500 bg-blue-500 text-white'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300'
                      )}
                    >
                      {slot}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs font-medium text-blue-700">
                Time picker: next click sets {timePickTarget === 'start' ? 'Start time' : 'End time'}
              </p>

              <Separator className="my-4" />

              {quickAddOpen ? (
                <div className="mt-3 rounded-2xl border border-blue-200 bg-blue-50/40 p-3">
                  <p className="mb-2 text-sm font-semibold text-blue-900">Quick Add Appointment</p>
                  <div className="grid gap-2 md:grid-cols-2">
                    <Select
                      value={quickCreateData.patientId}
                      onValueChange={(value) => {
                        setQuickCreateData((current) => ({ ...current, patientId: value }));
                      }}
                    >
                      <SelectTrigger
                        className={cn(
                          'w-full rounded-xl bg-white',
                          quickCreateData.patientId
                            ? 'border-blue-400 bg-blue-50 text-blue-900'
                            : 'border-slate-200'
                        )}
                      >
                        <SelectValue placeholder="Select patient" />
                      </SelectTrigger>
                      <SelectContent className="max-h-72 rounded-xl">
                        {patientOptions.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={quickCreateData.dentistId}
                      onValueChange={(value) => {
                        setQuickCreateData((current) => ({ ...current, dentistId: value }));
                      }}
                    >
                      <SelectTrigger
                        className={cn(
                          'w-full rounded-xl bg-white',
                          quickCreateData.dentistId
                            ? 'border-blue-400 bg-blue-50 text-blue-900'
                            : 'border-slate-200'
                        )}
                      >
                        <SelectValue placeholder="Select dentist" />
                      </SelectTrigger>
                      <SelectContent className="max-h-72 rounded-xl">
                        {dentistOptions.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <div className="space-y-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">Appointment Date</p>
                      <Input
                        type="date"
                        value={quickCreateData.appointmentDate}
                        onChange={(event) => {
                          setQuickCreateData((current) => ({
                            ...current,
                            appointmentDate: event.target.value,
                          }));
                        }}
                        className="h-10 rounded-xl border-amber-300 bg-amber-50 text-amber-900"
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-cyan-700">Start Time</p>
                      <Input
                        type="time"
                        value={quickCreateData.startTime}
                        onChange={(event) => {
                          const startTime = normalizeTime(event.target.value) || event.target.value;
                          setQuickCreateData((current) => ({
                            ...current,
                            endTime:
                              current.endTime && toMinutes(current.endTime) > toMinutes(startTime)
                                ? current.endTime
                                : addMinutes(startTime, 30),
                            startTime,
                          }));
                        }}
                        className="h-10 rounded-xl border-cyan-300 bg-cyan-50 text-cyan-900"
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-700">End Time</p>
                      <Input
                        type="time"
                        value={quickCreateData.endTime}
                        onChange={(event) => {
                          const endTime = normalizeTime(event.target.value) || event.target.value;
                          setQuickCreateData((current) => ({
                            ...current,
                            endTime,
                          }));
                          setTimePickTarget('start');
                        }}
                        className="h-10 rounded-xl border-indigo-300 bg-indigo-50 text-indigo-900"
                      />
                    </div>

                    <Input
                      value={quickCreateData.notes}
                      onChange={(event) => {
                        setQuickCreateData((current) => ({ ...current, notes: event.target.value }));
                      }}
                      placeholder="Notes (optional)"
                      className="h-10 rounded-xl border-slate-200 bg-white"
                    />
                  </div>

                  {quickCreateError ? (
                    <p className="mt-2 text-xs font-medium text-rose-700">{quickCreateError}</p>
                  ) : null}

                  <div className="mt-3 flex justify-end">
                    <Button
                      type="button"
                      disabled={isSubmittingCreate || !canSubmitQuickCreate}
                      className="rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                      onClick={() => {
                        void submitQuickCreate();
                      }}
                    >
                      <Plus className="mr-1 size-4" />
                      {isSubmittingCreate ? 'Saving...' : 'Save Appointment'}
                    </Button>
                  </div>
                </div>
              ) : null}

              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={searchTerm}
                    onChange={(event) => {
                      setSearchTerm(event.target.value);
                    }}
                    placeholder="Search patient, dentist, tag, notes..."
                    className="h-10 rounded-xl border-slate-200 pl-9"
                  />
                </div>
                <Button
                  type="button"
                  className="h-10 rounded-xl bg-blue-600 px-5 text-white hover:bg-blue-700"
                  onClick={() => {
                    setSearchTerm((value) => value.trim());
                  }}
                >
                  <Search className="mr-2 size-4" />
                  Search
                </Button>
              </div>

              <div className="mt-4 space-y-2">
                {isLoading ? (
                  <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                    Loading scheduler...
                  </p>
                ) : filteredAppointments.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                    No appointments match the selected filters.
                  </p>
                ) : (
                  filteredAppointments.map((item) => {
                    const isActive = item.id === selectedAppointment?.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setSelectedAppointmentId(item.id);
                        }}
                        className={cn(
                          'w-full rounded-2xl border px-3 py-2 text-left transition',
                          isActive
                            ? 'border-blue-400 bg-blue-50'
                            : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/30'
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">{item.patientName}</p>
                            <p className="truncate text-xs text-slate-500">{item.tag}</p>
                          </div>
                          <Badge variant="outline" className={cn('capitalize', typeMeta[item.type].pillClass)}>
                            {item.type}
                          </Badge>
                        </div>
                        <div className="mt-2 flex items-center gap-3 text-xs text-slate-600">
                          <span className="inline-flex items-center gap-1">
                            <Clock3 className="size-3.5" />
                            {item.startTimeLabel}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <UserRound className="size-3.5" />
                            {item.dentistName}
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </section>
          </div>

          <aside className="min-w-0 space-y-4">
            <Card className="rounded-3xl border-slate-200 bg-white shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Scheduler Insights</CardTitle>
                <CardDescription>Selected day and reservation details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                    <p className="text-xs text-blue-700">Selected Day</p>
                    <p className="text-xl font-semibold text-blue-900">{selectedDayAppointments.length}</p>
                  </div>
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                    <p className="text-xs text-emerald-700">After Filters</p>
                    <p className="text-xl font-semibold text-emerald-900">{filteredAppointments.length}</p>
                  </div>
                </div>

                {selectedAppointment ? (
                  <div className="rounded-2xl border border-slate-200 p-3">
                    <div className="mb-2 flex items-center gap-3">
                      <Avatar className="size-10">
                        <AvatarFallback className="bg-blue-100 text-blue-700">
                          {selectedAppointment.patientName.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900">{selectedAppointment.patientName}</p>
                        <p className="truncate text-xs text-slate-500">{selectedAppointment.tag}</p>
                      </div>
                    </div>
                    <div className="space-y-1 text-sm">
                      <p className="flex items-center justify-between gap-2">
                        <span className="text-slate-500">Dentist</span>
                        <span className="truncate font-medium text-slate-800">{selectedAppointment.dentistName}</span>
                      </p>
                      <p className="flex items-center justify-between gap-2">
                        <span className="text-slate-500">Time</span>
                        <span className="font-medium text-slate-800">
                          {selectedAppointment.startTimeLabel}
                          {selectedAppointment.endTimeLabel !== '--:--' ? ` - ${selectedAppointment.endTimeLabel}` : ''}
                        </span>
                      </p>
                      <p className="flex items-center justify-between gap-2">
                        <span className="text-slate-500">Status</span>
                        <Badge variant="outline" className="capitalize">{selectedAppointment.status}</Badge>
                      </p>
                    </div>
                    <p className="mt-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">
                      {selectedAppointment.notes || 'No notes provided for this appointment.'}
                    </p>
                  </div>
                ) : (
                  <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                    Pick an appointment to view details.
                  </p>
                )}

                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                  <p className="mb-2 text-sm font-semibold text-slate-800">Quick Snapshot</p>
                  <div className="space-y-1 text-xs text-slate-600">
                    <p className="flex items-center justify-between">
                      <span>Current Month</span>
                      <span className="font-medium text-slate-800">{monthLabel(selectedMonth)}</span>
                    </p>
                    <p className="flex items-center justify-between">
                      <span>Selected Time</span>
                      <span className="font-medium text-slate-800">{selectedTime === 'all' ? 'All times' : selectedTime}</span>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      </CardContent>
    </Card>
  );
};
