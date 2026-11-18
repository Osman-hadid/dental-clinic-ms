'use client';

import { JSX, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utilities';
import { getIntlLocale } from '@/modules/common/utils/locale';
import { ChevronLeft, ChevronRight, Clock3, Plus, Search, UserRound } from 'lucide-react';

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

type AppointmentRecord = {
  dentist?: Record<string, unknown>;
  dentistId: string;
  dentistName?: string;
  endTime?: string;
  id: number;
  notes?: string;
  patient?: Record<string, unknown>;
  patientId: string;
  patientName?: string;
  appointmentDate: string;
  startTime: string;
  status?: string;
  tag?: string;
};

type AppointmentsSchedulerProps = {
  appointments: AppointmentRecord[];
  canCreate?: boolean;
  dentistOptions?: SchedulerPartyOption[];
  isLoading?: boolean;
  isSubmittingCreate?: boolean;
  onCreateAppointment?: (
    payload: SchedulerCreatePayload
  ) => Promise<{ message?: string; success: boolean }>;
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
  const totalMinutes = 8 * 60 + index * 30;
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
});
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
    Number.isInteger(year) &&
    Number.isInteger(month) &&
    Number.isInteger(day) &&
    year > 1900 &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= 31
  ) {
    return new Date(year, month - 1, day);
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
};

const startOfDay = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const toDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const startOfMonth = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), 1);

const shiftMonths = (date: Date, delta: number): Date =>
  startOfMonth(new Date(date.getFullYear(), date.getMonth() + delta, 1));

const isSameMonth = (left: Date, right: Date): boolean =>
  left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth();

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
  return Number(match[1]) * 60 + Number(match[2]);
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

const formatClock = (time24h: string, locale: string): string => {
  const match = time24h.match(/^(\d{2}):(\d{2})$/);
  if (!match) return time24h || '--:--';
  const date = new Date();
  date.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return new Intl.DateTimeFormat(getIntlLocale(locale), {
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

const appointmentType = (appointment: AppointmentRecord): ReservationType => {
  const blob = `${asText(appointment.tag)} ${asText(appointment.notes)}`.toLowerCase();
  if (blob.includes('emerg') || blob.includes('urgent') || blob.includes('pain'))
    return 'emergency';
  if (blob.includes('treat') || blob.includes('implant') || blob.includes('surgery'))
    return 'treatment';
  if (blob.includes('consult') || blob.includes('check') || blob.includes('exam'))
    return 'consultation';
  return 'consultation';
};

const normalizeStatus = (status: string): string =>
  status.trim().toLowerCase().replace(/\s+/g, '_');

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

const typeMeta: Record<ReservationType, { labelKey: string; pillClass: string }> = {
  consultation: {
    labelKey: 'types.consultation',
    pillClass:
      'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-400/20 dark:bg-blue-500/12 dark:text-blue-100',
  },
  emergency: {
    labelKey: 'types.emergency',
    pillClass:
      'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-400/20 dark:bg-rose-500/12 dark:text-rose-100',
  },
  treatment: {
    labelKey: 'types.treatment',
    pillClass:
      'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/12 dark:text-emerald-100',
  },
};

const monthLabel = (date: Date, locale: string): string =>
  new Intl.DateTimeFormat(getIntlLocale(locale), { month: 'long', year: 'numeric' }).format(date);

export const AppointmentsScheduler = ({
  appointments,
  canCreate = false,
  dentistOptions = [],
  isLoading = false,
  isSubmittingCreate = false,
  onCreateAppointment,
  patientOptions = [],
}: AppointmentsSchedulerProps): JSX.Element => {
  const locale = useLocale();
  const t = useTranslations('appointment.scheduler');
  const intlLocale = getIntlLocale(locale);
  const calendarLocale =
    locale === 'dr' ? 'fa-AF-u-ca-gregory' : locale === 'ps' ? 'ps-AF-u-ca-gregory' : intlLocale;
  const firstWeekDay = locale === 'dr' || locale === 'ps' ? 6 : 0;
  const weekdayLabels = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) =>
        new Intl.DateTimeFormat(calendarLocale, { weekday: 'short' }).format(
          new Date(2024, 0, 7 + ((index + firstWeekDay) % 7))
        )
      ),
    [calendarLocale, firstWeekDay]
  );
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
    return appointments
      .reduce<SchedulerAppointment[]>((accumulator, appointment) => {
        const parsedDate = parseDateOnly(appointment.appointmentDate);
        if (!parsedDate) return accumulator;

        const startTime = normalizeTime(appointment.startTime);
        const endTime = normalizeTime(appointment.endTime);
        const patientName =
          asText(appointment.patientName) ||
          relationName(appointment.patient) ||
          t('patientNumber', { id: appointment.patientId });
        const dentistName =
          asText(appointment.dentistName) ||
          relationName(appointment.dentist) ||
          t('dentistNumber', { id: appointment.dentistId });

        accumulator.push({
          dateKey: toDateKey(parsedDate),
          dentistName,
          endTime,
          endTimeLabel: formatClock(endTime, locale),
          id: appointment.id,
          notes: asText(appointment.notes),
          patientName,
          rawDate: parsedDate,
          startTime,
          startTimeLabel: formatClock(startTime, locale),
          status: asText(appointment.status) || 'scheduled',
          tag: asText(appointment.tag) || t('newAppointment'),
          type: appointmentType(appointment),
        });

        return accumulator;
      }, [])
      .sort((left, right) => {
        const dateCompare = left.dateKey.localeCompare(right.dateKey);
        if (dateCompare !== 0) return dateCompare;
        return toMinutes(left.startTime) - toMinutes(right.startTime);
      });
  }, [appointments, locale, t]);

  const visibleDays = useMemo(() => getMonthDays(selectedMonth), [selectedMonth]);
  const leadingBlankDays = useMemo(
    () => ((visibleDays[0]?.getDay() ?? firstWeekDay) - firstWeekDay + 7) % 7,
    [firstWeekDay, visibleDays]
  );

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

      const blob =
        `${item.patientName} ${item.dentistName} ${item.tag} ${item.notes} ${item.status}`.toLowerCase();
      return blob.includes(normalizedSearch);
    });
  }, [searchTerm, selectedDayAppointments, selectedTime]);

  const selectedAppointment = useMemo(() => {
    if (filteredAppointments.length === 0) return null;
    return (
      filteredAppointments.find((item) => item.id === selectedAppointmentId) ??
      filteredAppointments[0]
    );
  }, [filteredAppointments, selectedAppointmentId]);

  const canSubmitQuickCreate =
    canCreate &&
    patientOptions.length > 0 &&
    dentistOptions.length > 0 &&
    typeof onCreateAppointment === 'function';

  const submitQuickCreate = async (): Promise<void> => {
    if (!canSubmitQuickCreate || !onCreateAppointment) return;

    if (
      !quickCreateData.patientId ||
      !quickCreateData.dentistId ||
      !quickCreateData.appointmentDate ||
      !quickCreateData.startTime ||
      !quickCreateData.endTime
    ) {
      setQuickCreateError(t('requiredFields'));
      return;
    }

    if (toMinutes(quickCreateData.endTime) <= toMinutes(quickCreateData.startTime)) {
      setQuickCreateError(t('invalidTime'));
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
          const nextEnd =
            toMinutes(current.endTime) > toMinutes(normalizedSlot)
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

  const selectDay = (day: Date): void => {
    const dateKey = toDateKey(day);
    setSelectedDayKey(dateKey);
    setSelectedTime('all');
    setTimePickTarget('start');
    setQuickCreateData((current) => ({ ...current, appointmentDate: dateKey }));
  };

  const changeMonth = (delta: number): void => {
    const nextMonth = shiftMonths(selectedMonth, delta);
    const fallbackDay = isSameMonth(today, nextMonth)
      ? today
      : (getMonthDays(nextMonth)[0] ?? nextMonth);
    setSelectedMonth(nextMonth);
    selectDay(fallbackDay);
  };

  const selectedDate = parseDateOnly(selectedDayKey) ?? today;
  const selectedDateLabel = new Intl.DateTimeFormat(calendarLocale, {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
  }).format(selectedDate);
  const quickCreateDateLabel = new Intl.DateTimeFormat(calendarLocale, {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
  }).format(parseDateOnly(quickCreateData.appointmentDate) ?? selectedDate);

  return (
    <Card className="overflow-hidden rounded-[1.75rem] border-border/70 bg-card p-0 shadow-[0_18px_50px_-36px_rgba(15,80,74,0.5)]">
      <CardContent className="overflow-hidden p-0">
        <div className="grid xl:grid-cols-[minmax(0,1.55fr)_minmax(19rem,0.85fr)]">
          <div className="min-w-0 space-y-5 p-4 md:p-6">
            <section className="relative overflow-hidden rounded-[1.5rem] bg-[linear-gradient(120deg,#075e59_0%,#078b86_58%,#31b6ad_100%)] p-5 text-white shadow-[0_18px_38px_-26px_rgba(7,139,134,0.85)] sm:p-6">
              <div className="pointer-events-none absolute -right-8 -top-14 size-48 rounded-full border-[28px] border-white/10" />
              <div className="relative flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/75">
                    {t('eyebrow')}
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
                    {t('planDay')}
                  </h2>
                  <p className="mt-1 text-sm text-white/80">{selectedDateLabel}</p>
                </div>
                <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-right backdrop-blur-sm">
                  <p className="text-xs text-white/70">{t('selectedDay')}</p>
                  <p className="mt-0.5 text-2xl font-semibold leading-none">
                    {selectedDayAppointments.length}
                  </p>
                  <p className="mt-1 text-[11px] text-white/70">
                    {t('appointmentCount', { count: selectedDayAppointments.length })}
                  </p>
                </div>
              </div>
            </section>

            <section className="min-w-0 rounded-[1.5rem] border border-border/65 bg-background/80 p-4 shadow-sm sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">{t('schedule')}</h3>
                  <p className="text-sm text-muted-foreground">{t('scheduleHint')}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {canCreate ? (
                    <Button
                      type="button"
                      className="h-9 rounded-xl px-4 shadow-sm"
                      onClick={() => {
                        setQuickAddOpen((open) => !open);
                      }}
                    >
                      <Plus className="me-1 size-4" />
                      {quickAddOpen ? t('closeForm') : t('newAppointment')}
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 rounded-xl px-3"
                    onClick={() => {
                      setSelectedMonth(startOfMonth(today));
                      selectDay(today);
                    }}
                  >
                    {t('today')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label={t('previousMonth')}
                    className="size-9 rounded-xl"
                    onClick={() => {
                      changeMonth(-1);
                    }}
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label={t('nextMonth')}
                    className="size-9 rounded-xl"
                    onClick={() => {
                      changeMonth(1);
                    }}
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>

              <p className="mt-4 text-sm font-semibold text-foreground">
                {monthLabel(selectedMonth, calendarLocale)}
              </p>

              <div className="mt-2 grid grid-cols-7 gap-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80 sm:gap-2 sm:text-[11px]">
                {weekdayLabels.map((label) => (
                  <div key={label} className="py-1">
                    {label}
                  </div>
                ))}
              </div>

              <div className="mt-1.5 grid grid-cols-7 gap-1.5 sm:gap-2">
                {Array.from({ length: leadingBlankDays }, (_, index) => (
                  <div key={`blank-${index}`} aria-hidden="true" />
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
                      aria-label={new Intl.DateTimeFormat(calendarLocale, {
                        dateStyle: 'full',
                      }).format(day)}
                      aria-pressed={isSelected}
                      onMouseEnter={() => {
                        setHoveredDayKey(key);
                      }}
                      onMouseLeave={() => {
                        setHoveredDayKey((current) => (current === key ? null : current));
                      }}
                      onClick={() => {
                        selectDay(day);
                      }}
                      className={cn(
                        'aspect-square min-h-0 rounded-xl border p-1 text-center transition-colors sm:rounded-2xl sm:p-2',
                        isSelected
                          ? 'border-primary bg-primary/10 text-primary shadow-sm ring-1 ring-primary/25'
                          : isOccupiedDay
                            ? 'border-border/70 bg-muted/30 text-foreground hover:border-primary/40 hover:bg-primary/5'
                            : isHovered
                              ? 'border-primary/40 bg-primary/5 text-foreground shadow-sm'
                              : 'border-border/60 bg-background text-foreground hover:border-primary/40 hover:bg-primary/5'
                      )}
                    >
                      <span className="flex h-full flex-col items-center justify-center gap-0.5">
                        <span
                          className={cn(
                            'text-xs font-semibold leading-4 sm:text-base sm:leading-6',
                            isToday && !isSelected && 'text-primary'
                          )}
                        >
                          {day.getDate()}
                        </span>
                        {dayCount > 0 ? (
                          <span
                            className={cn(
                              'min-w-4 rounded-full px-1 text-[9px] font-medium leading-3 sm:text-[10px] sm:leading-4',
                              isSelected
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-muted-foreground'
                            )}
                          >
                            {dayCount}
                          </span>
                        ) : (
                          <span className="h-1" />
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-foreground">{t('timeSlots')}</p>
                <p className="text-xs text-muted-foreground">{t('timeSlotHelp')}</p>
              </div>
              <div className="mt-2 flex max-w-full gap-2 overflow-x-auto pb-1">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTime('all');
                    setTimePickTarget('start');
                  }}
                  className={cn(
                    'shrink-0 rounded-full border px-3 py-1.5 text-sm transition-colors',
                    selectedTime === 'all'
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border/60 bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground'
                  )}
                >
                  {t('allTimes')}
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
                        'shrink-0 rounded-full border px-3 py-1.5 text-sm transition-colors',
                        isStart
                          ? 'border-primary bg-primary text-primary-foreground'
                          : isEnd
                            ? 'border-primary/35 bg-primary/10 text-primary'
                            : isOccupiedSlot
                              ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-200'
                              : isSelectedFilter
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-border/60 bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground'
                      )}
                    >
                      {slot}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {timePickTarget === 'start'
                  ? t('chooseStart')
                  : t('chooseEndAfter', { time: formatClock(quickCreateData.startTime, locale) })}
              </p>

              <Separator className="my-4" />

              {quickAddOpen ? (
                <div className="mt-3 rounded-2xl border border-primary/25 bg-primary/[0.035] p-4">
                  <div className="mb-3">
                    <p className="text-sm font-semibold text-foreground">{t('newAppointment')}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {quickCreateDateLabel} · {formatClock(quickCreateData.startTime, locale)} –{' '}
                      {formatClock(quickCreateData.endTime, locale)}
                    </p>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    <Select
                      value={quickCreateData.patientId}
                      onValueChange={(value) => {
                        setQuickCreateData((current) => ({ ...current, patientId: value }));
                      }}
                    >
                      <SelectTrigger
                        className={cn(
                          'w-full rounded-xl border-border/70 bg-background',
                          quickCreateData.patientId && 'border-primary/40'
                        )}
                      >
                        <SelectValue placeholder={t('selectPatient')} />
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
                          'w-full rounded-xl border-border/70 bg-background',
                          quickCreateData.dentistId && 'border-primary/40'
                        )}
                      >
                        <SelectValue placeholder={t('selectDentist')} />
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
                      <p className="text-xs font-medium text-muted-foreground">
                        {t('appointmentDate')}
                      </p>
                      <Input
                        type="date"
                        value={quickCreateData.appointmentDate}
                        onChange={(event) => {
                          const dateValue = event.target.value;
                          const parsedDate = parseDateOnly(dateValue);
                          if (parsedDate) {
                            setSelectedMonth(startOfMonth(parsedDate));
                            selectDay(parsedDate);
                          } else {
                            setQuickCreateData((current) => ({
                              ...current,
                              appointmentDate: dateValue,
                            }));
                          }
                        }}
                        className="h-10 rounded-xl border-border/70 bg-background"
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">{t('startTime')}</p>
                      <Input
                        type="time"
                        value={quickCreateData.startTime}
                        onChange={(event) => {
                          const startTime = normalizeTime(event.target.value) || event.target.value;
                          setSelectedTime('all');
                          setQuickCreateData((current) => ({
                            ...current,
                            endTime:
                              current.endTime && toMinutes(current.endTime) > toMinutes(startTime)
                                ? current.endTime
                                : addMinutes(startTime, 30),
                            startTime,
                          }));
                        }}
                        className="h-10 rounded-xl border-border/70 bg-background"
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">{t('endTime')}</p>
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
                        className="h-10 rounded-xl border-border/70 bg-background"
                      />
                    </div>

                    <Input
                      value={quickCreateData.notes}
                      onChange={(event) => {
                        setQuickCreateData((current) => ({
                          ...current,
                          notes: event.target.value,
                        }));
                      }}
                      placeholder={t('notesOptional')}
                      className="h-10 rounded-xl border-border/70 bg-background"
                    />
                  </div>

                  {quickCreateError ? (
                    <p className="mt-2 text-xs font-medium text-rose-700 dark:text-rose-200">
                      {quickCreateError}
                    </p>
                  ) : null}

                  <div className="mt-3 flex justify-end">
                    <Button
                      type="button"
                      disabled={isSubmittingCreate || !canSubmitQuickCreate}
                      className="rounded-xl shadow-sm disabled:cursor-not-allowed disabled:opacity-70"
                      onClick={() => {
                        void submitQuickCreate();
                      }}
                    >
                      <Plus className="mr-1 size-4" />
                      {isSubmittingCreate ? t('saving') : t('saveAppointment')}
                    </Button>
                  </div>
                </div>
              ) : null}

              <div className="mt-5">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchTerm}
                    onChange={(event) => {
                      setSearchTerm(event.target.value);
                    }}
                    placeholder={t('searchDay')}
                    className="h-10 rounded-xl border-border/60 bg-background pl-9"
                  />
                </div>
              </div>

              <div className="mb-2 mt-4 flex items-center justify-between gap-3">
                <h4 className="text-sm font-semibold text-foreground">{t('appointments')}</h4>
                <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                  {filteredAppointments.length}
                </span>
              </div>
              <div className="space-y-2">
                {isLoading ? (
                  <p className="rounded-xl border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
                    {t('loading')}
                  </p>
                ) : filteredAppointments.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
                    {t('noMatch')}
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
                          'w-full rounded-2xl border px-3 py-3 text-left transition-colors',
                          isActive
                            ? 'border-primary/45 bg-primary/[0.06] ring-1 ring-primary/15'
                            : 'border-border/60 bg-background hover:border-primary/35 hover:bg-primary/[0.025]'
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {item.patientName}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">{item.tag}</p>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn('capitalize', typeMeta[item.type].pillClass)}
                          >
                            {t(typeMeta[item.type].labelKey)}
                          </Badge>
                        </div>
                        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
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

          <aside className="min-w-0 border-t border-border/60 bg-muted/10 p-4 md:p-6 xl:border-s xl:border-t-0">
            <Card className="gap-4 rounded-[1.5rem] border-border/60 bg-card shadow-sm xl:sticky xl:top-24">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t('details')}</CardTitle>
                <CardDescription>
                  {selectedDateLabel} ·{' '}
                  {t('scheduledCount', { count: selectedDayAppointments.length })}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {selectedAppointment ? (
                  <div className="rounded-2xl border border-primary/20 bg-primary/[0.035] p-4">
                    <div className="mb-2 flex items-center gap-3">
                      <Avatar className="size-10">
                        <AvatarFallback className="bg-primary/10 font-semibold text-primary">
                          {selectedAppointment.patientName.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-foreground">
                          {selectedAppointment.patientName}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {selectedAppointment.tag}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        'mb-3 capitalize',
                        typeMeta[selectedAppointment.type].pillClass
                      )}
                    >
                      {t(typeMeta[selectedAppointment.type].labelKey)}
                    </Badge>
                    <div className="space-y-1 text-sm">
                      <p className="flex items-center justify-between gap-2">
                        <span className="text-muted-foreground">{t('dentist')}</span>
                        <span className="truncate font-medium text-foreground">
                          {selectedAppointment.dentistName}
                        </span>
                      </p>
                      <p className="flex items-center justify-between gap-2">
                        <span className="text-muted-foreground">{t('time')}</span>
                        <span className="font-medium text-foreground">
                          {selectedAppointment.startTimeLabel}
                          {selectedAppointment.endTimeLabel !== '--:--'
                            ? ` - ${selectedAppointment.endTimeLabel}`
                            : ''}
                        </span>
                      </p>
                      <p className="flex items-center justify-between gap-2">
                        <span className="text-muted-foreground">{t('status')}</span>
                        <Badge variant="outline" className="capitalize">
                          {t.has(`statuses.${normalizeStatus(selectedAppointment.status)}`)
                            ? t(`statuses.${normalizeStatus(selectedAppointment.status)}`)
                            : selectedAppointment.status}
                        </Badge>
                      </p>
                    </div>
                    <p className="mt-3 rounded-xl border border-border/60 bg-background/80 p-3 text-xs leading-relaxed text-muted-foreground">
                      {selectedAppointment.notes || t('noNotes')}
                    </p>
                  </div>
                ) : (
                  <p className="rounded-xl border border-dashed border-border/70 bg-background/60 p-5 text-sm text-muted-foreground">
                    {t('selectForDetails')}
                  </p>
                )}
              </CardContent>
            </Card>
          </aside>
        </div>
      </CardContent>
    </Card>
  );
};
