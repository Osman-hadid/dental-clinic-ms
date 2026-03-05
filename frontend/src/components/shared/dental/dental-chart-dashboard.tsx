'use client';

import { JSX, useMemo, useState, type CSSProperties } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DEFAULT_AFN_PER_USD,
  formatDualFromUsd,
  formatCurrency as formatMoneyByCurrency,
} from '@/lib/currency-utils';
import { cn } from '@/lib/utilities';
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Search,
  Stethoscope,
  TrendingUp,
  UsersRound,
  Vault,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  PolarGrid,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type EventType = 'appointment' | 'visit';
type ImplantAvailabilityStatus = 'not_available' | 'in_purchase' | 'available' | 'done';

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

export type DashboardInvoice = {
  id: number | string;
  invoiceDate?: string;
  netAmount?: string | number;
  status?: string;
};

export type DashboardPayment = {
  amount?: string | number;
  id: number | string;
  invoiceId?: string | number;
  paymentDate?: string;
};

export type DashboardSafeTransaction = {
  amount: number;
  direction: string;
  entryType: string;
  id: string;
  notes: string;
  pickedByStaffId: string;
  pickedByStaffName: string;
  transactionDate: string;
};

export type DashboardSafeSummary = {
  afnPerUsd?: number;
  balance: number;
  totalIn: number;
  totalOut: number;
  transactions: DashboardSafeTransaction[];
};

export type DashboardImplantSupplierAvailability = {
  count: number;
  paid: number;
  status: ImplantAvailabilityStatus;
  total: number;
  unpaid: number;
};

export type DashboardImplantSupplierSummary = {
  implantCount: number;
  paidRatio: number;
  totalPaid: number;
  totalSupplierCost: number;
  totalUnpaid: number;
  unpaidCount: number;
  byAvailability: DashboardImplantSupplierAvailability[];
};

type DentalChartDashboardProps = {
  appointments: DashboardAppointment[];
  implantSupplierSummary?: DashboardImplantSupplierSummary;
  invoices: DashboardInvoice[];
  isLoading?: boolean;
  locale: string;
  patients: DashboardPatient[];
  payments: DashboardPayment[];
  safeSummary?: DashboardSafeSummary;
  visits: DashboardVisit[];
};

const safeRadialChartConfig = {
  debts: {
    color: '#eab308',
    label: 'Debts',
  },
  inSafe: {
    color: '#16a34a',
    label: 'Safe',
  },
  unpaids: {
    color: '#dc2626',
    label: 'Unpaids',
  },
} satisfies ChartConfig;

const CALENDAR_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MS_IN_DAY = 24 * 60 * 60 * 1000;

const asText = (value: unknown): string => {
  if (typeof value === 'number') return String(value).trim();
  if (typeof value !== 'string') return '';
  return value.trim();
};

const parseMoney = (value: unknown): number => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  const raw = asText(value);
  if (!raw) return 0;
  const parsed = Number(raw.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const roundCurrency = (value: number): number => Math.round(value * 100) / 100;

const formatCurrency = (value: number): string =>
  formatMoneyByCurrency(roundCurrency(value), 'AFN');

const toDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const startOfDay = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());
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

  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    time.hour,
    time.minute,
    0,
    0
  );
};

const formatMonth = (date: Date): string =>
  new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(date);

const formatDayHeading = (date: Date): string =>
  new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    weekday: 'long',
  }).format(date);

const formatClock = (date: Date): string =>
  new Intl.DateTimeFormat('en-US', {
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

  return asText(relation.fullName) || asText(relation.full_name) || asText(relation.name) || '';
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

const normalizeStatus = (status: string): string =>
  status.trim().toLowerCase().replace(/\s+/g, '_');
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

const CALENDAR_BUCKET_ORDER: CalendarStatusBucket[] = [
  'cancelled',
  'in_progress',
  'scheduled',
  'completed',
  'other',
];

const toCalendarStatusBucket = (status: string): CalendarStatusBucket => {
  const normalized = normalizeStatus(status);

  if (normalized === 'cancelled' || normalized === 'canceled' || normalized === 'rejected')
    return 'cancelled';
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
  const gradientStops = uniqueBuckets
    .map((bucket, index) => {
      const start = (index * step).toFixed(2);
      const end = ((index + 1) * step).toFixed(2);
      return `${CALENDAR_STATUS_THEME[bucket].cell} ${start}% ${end}%`;
    })
    .join(', ');
  const badgeStops = uniqueBuckets
    .map((bucket, index) => {
      const start = (index * step).toFixed(2);
      const end = ((index + 1) * step).toFixed(2);
      return `${CALENDAR_STATUS_THEME[bucket].badge} ${start}% ${end}%`;
    })
    .join(', ');

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

type ToothSectionKey = 'buccal' | 'distal' | 'lingual' | 'mesial' | 'occlusal' | 'root';

type ToothSectionMeta = {
  description: string;
  fill: string;
  label: string;
  path: string;
};

const TOOTH_SECTION_META: Record<ToothSectionKey, ToothSectionMeta> = {
  buccal: {
    description: 'Outer cheek-facing wall. Check plaque and smoothness.',
    fill: '#dbe3ec',
    label: 'Buccal',
    path: 'M99 93 C111 99 149 99 161 93 C163 124 157 151 147 180 C136 212 127 234 121 252 C107 230 97 210 87 180 C77 151 71 124 73 93 Z',
  },
  distal: {
    description: 'Back side of the tooth next to posterior neighbor contact.',
    fill: '#cfd8e3',
    label: 'Distal',
    path: 'M164 90 C174 111 179 136 180 160 C180 181 177 203 172 225 C163 206 153 184 146 158 C142 140 140 118 140 101 C149 99 157 96 164 90 Z',
  },
  lingual: {
    description: 'Inner tongue-side wall. Review contour and restorations.',
    fill: '#c8d1dc',
    label: 'Lingual',
    path: 'M99 108 C111 114 149 114 161 108 C160 134 155 158 147 181 C138 206 130 228 121 245 C112 228 104 206 95 181 C87 158 82 134 81 108 C87 112 93 114 99 108 Z',
  },
  mesial: {
    description: 'Front side next to anterior neighbor contact area.',
    fill: '#dae2eb',
    label: 'Mesial',
    path: 'M70 90 C63 96 55 105 49 117 C41 133 37 149 37 168 C37 192 43 217 52 242 C61 222 69 203 77 175 C83 154 87 128 89 102 C81 99 74 96 70 90 Z',
  },
  occlusal: {
    description: 'Top biting surface with pits and fissures.',
    fill: '#eef2f7',
    label: 'Occlusal',
    path: 'M77 78 C87 57 101 47 117 44 C129 42 145 45 157 53 C165 58 171 67 174 79 C162 90 148 95 129 96 C108 95 92 90 77 78 Z',
  },
  root: {
    description: 'Root complex and apical area for periodontal review.',
    fill: '#b6c1cf',
    label: 'Root',
    path: 'M88 177 C97 205 108 229 121 251 C134 229 145 205 154 177 C149 205 147 229 147 253 C147 270 138 286 128 301 C118 286 109 270 109 253 C109 229 105 205 88 177 Z',
  },
};

const TOOTH_SECTION_ORDER: ToothSectionKey[] = ['occlusal', 'buccal', 'lingual', 'mesial', 'distal', 'root'];

const ToothSurfaceInspector = (): JSX.Element => {
  const [hoveredSection, setHoveredSection] = useState<ToothSectionKey | null>(null);
  const activeSection = hoveredSection ? TOOTH_SECTION_META[hoveredSection] : TOOTH_SECTION_META.occlusal;

  return (
    <div className="relative isolate overflow-hidden rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50 via-background to-purple-50 p-3 shadow-sm">
      <div className="pointer-events-none absolute -right-10 -top-10 size-28 rounded-full bg-violet-200/45 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-10 -left-10 size-24 rounded-full bg-purple-200/45 blur-2xl" />

      <div className="relative z-10">
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <div>
            <p className="flex items-center gap-1.5 text-base font-semibold text-foreground">
              <Stethoscope className="size-4 text-primary" />
              Tooth Surface Explorer
            </p>
            <p className="text-[11px] text-muted-foreground">
              Hover each section to inspect
            </p>
          </div>
          <span className="rounded-full border border-violet-300 bg-violet-100 px-2 py-1 text-[11px] font-semibold text-violet-800">
            LR6
          </span>
        </div>

        <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-xl border border-violet-200 bg-white/90 p-2.5">
            <svg
              viewBox="0 0 220 320"
              className="mx-auto h-56 w-full max-w-[220px]"
              onMouseLeave={() => {
                setHoveredSection(null);
              }}
              aria-label="Interactive segmented tooth"
              role="img"
            >
              <defs>
                <linearGradient id="dashboard-tooth-body" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#f8fafc" />
                  <stop offset="50%" stopColor="#e2e8f0" />
                  <stop offset="100%" stopColor="#cbd5e1" />
                </linearGradient>
              </defs>
              <path
                d="M110 24 C146 24 171 52 174 92 C177 129 169 162 158 194 C148 222 140 246 131 268 C126 281 120 292 110 305 C100 292 94 281 89 268 C80 246 72 222 62 194 C51 162 43 129 46 92 C49 52 74 24 110 24 Z"
                fill="url(#dashboard-tooth-body)"
                stroke="#94a3b8"
                strokeWidth="2"
              />
              {TOOTH_SECTION_ORDER.map((key) => {
                const section = TOOTH_SECTION_META[key];
                const isActive = hoveredSection === key;
                return (
                  <path
                    key={key}
                    d={section.path}
                    fill={isActive ? '#8b5cf6' : section.fill}
                    stroke={isActive ? '#7c3aed' : '#94a3b8'}
                    strokeWidth={isActive ? 2.2 : 1.5}
                    style={{ cursor: 'pointer', transition: 'fill 140ms ease, stroke 140ms ease' }}
                    onMouseEnter={() => {
                      setHoveredSection(key);
                    }}
                    onFocus={() => {
                      setHoveredSection(key);
                    }}
                    tabIndex={0}
                  />
                );
              })}
            </svg>
          </div>

          <div className="space-y-1.5">
            {TOOTH_SECTION_ORDER.map((key) => {
              const section = TOOTH_SECTION_META[key];
              const isActive = hoveredSection === key;

              return (
                <button
                  key={key}
                  type="button"
                  onMouseEnter={() => {
                    setHoveredSection(key);
                  }}
                  onFocus={() => {
                    setHoveredSection(key);
                  }}
                  className={cn(
                    'flex w-full items-center justify-between rounded-lg border px-2.5 py-1.5 text-left text-xs transition',
                    isActive
                      ? 'border-violet-400 bg-violet-100 text-violet-900'
                      : 'border-border bg-background text-muted-foreground hover:border-violet-300 hover:bg-violet-50'
                  )}
                >
                  <span>{section.label}</span>
                  <span className="size-2 rounded-full bg-current/60" />
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-2.5 rounded-lg border border-violet-200 bg-white/85 p-2.5">
          <p className="text-xs font-semibold text-foreground">{activeSection.label}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">{activeSection.description}</p>
        </div>

      </div>
    </div>
  );
};

export const DentalChartDashboard = ({
  appointments,
  implantSupplierSummary,
  invoices,
  isLoading = false,
  locale,
  patients,
  payments,
  safeSummary,
  visits,
}: DentalChartDashboardProps): JSX.Element => {
  const router = useRouter();
  const now = new Date();
  const today = startOfDay(now);

  const [currentMonth, setCurrentMonth] = useState<Date>(startOfMonth(today));
  const [searchTerm, setSearchTerm] = useState('');
  const [revenueTimeRange, setRevenueTimeRange] = useState<'90d' | '30d' | '7d'>('90d');
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [manualSelectedEventKey, setManualSelectedEventKey] = useState<string | null>(null);

  const patientNameById = useMemo(() => {
    const map = new Map<string, string>();
    patients.forEach((patient) => {
      const fullName = [asText(patient.firstName), asText(patient.lastName)]
        .filter(Boolean)
        .join(' ')
        .trim();
      const fallback = fullName || asText(patient.patientCode) || `Patient #${patient.id}`;
      map.set(String(patient.id), fallback);
    });
    return map;
  }, [patients]);

  const visitIdByAppointmentId = useMemo(() => {
    const map = new Map<string, string | number>();
    visits.forEach((visit) => {
      const appointmentId = visit.appointmentId;
      if (
        appointmentId !== undefined &&
        appointmentId !== null &&
        !map.has(String(appointmentId))
      ) {
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

      const patientName =
        asText(appointment.patientName) ||
        buildNameFromRelation(appointment.patient) ||
        patientNameById.get(String(appointment.patientId ?? '')) ||
        `Patient #${appointment.patientId ?? appointment.id}`;

      const dentistName =
        asText(appointment.dentistName) ||
        buildNameFromRelation(appointment.dentist) ||
        `Dentist #${appointment.dentistId ?? '-'}`;

      events.push({
        date: dateTime,
        dateKey: toDateKey(dateTime),
        dentistName,
        key: `appointment-${appointment.id}-${index}`,
        linkedVisitId:
          extractFirstVisitId(appointment.visits) ??
          visitIdByAppointmentId.get(String(appointment.id)) ??
          null,
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
      const fallbackTime =
        visit.appointment && typeof visit.appointment === 'object'
          ? (visit.appointment as Record<string, unknown>).startTime
          : '';

      const dateTime = parseDateTime(visit.visitDate, fallbackTime);
      if (!dateTime) return;

      const patientName =
        asText(visit.patientName) ||
        buildNameFromRelation(visit.patient) ||
        patientNameById.get(String(visit.patientId ?? '')) ||
        `Patient #${visit.patientId ?? visit.id}`;

      const dentistName =
        asText(visit.dentistName) ||
        buildNameFromRelation(visit.dentist) ||
        `Dentist #${visit.dentistId ?? '-'}`;

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
    return (eventsByDate.get(selectedDateKey) ?? [])
      .slice()
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [eventsByDate, selectedDateKey]);

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const filteredSelectedDateEvents = useMemo(() => {
    if (!normalizedSearch) return selectedDateEvents;
    return selectedDateEvents.filter((event) => toSearchBlob(event).includes(normalizedSearch));
  }, [normalizedSearch, selectedDateEvents]);

  const selectedEvent = useMemo(() => {
    if (manualSelectedEventKey) {
      const matched = filteredSelectedDateEvents.find(
        (event) => event.key === manualSelectedEventKey
      );
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
  const completedAppointmentCount = appointmentEvents.filter(
    (event) => event.status.toLowerCase() === 'completed'
  ).length;
  const cancelledAppointmentCount = appointmentEvents.filter(
    (event) => event.status.toLowerCase() === 'cancelled'
  ).length;
  const scheduledAppointmentCount = Math.max(
    appointmentCount - completedAppointmentCount - cancelledAppointmentCount,
    0
  );
  const completionRate =
    appointmentCount > 0 ? Math.round((completedAppointmentCount / appointmentCount) * 100) : 0;

  const newPatients = useMemo(() => {
    return patients.filter((patient) => {
      const createdAt = parseDateOnly(patient.createdAt);
      if (!createdAt) return false;
      return today.getTime() - createdAt.getTime() <= 30 * MS_IN_DAY;
    }).length;
  }, [patients, today]);

  const returningPatients = Math.max(patients.length - newPatients, 0);

  const revenueAreaSeries = useMemo(() => {
    const financialGrouped = new Map<string, { billed: number; paid: number }>();

    invoices.forEach((invoice) => {
      const date = parseDateOnly(invoice.invoiceDate);
      if (!date) return;
      const key = toDateKey(date);
      const current = financialGrouped.get(key) ?? { billed: 0, paid: 0 };
      current.billed = roundCurrency(current.billed + parseMoney(invoice.netAmount));
      financialGrouped.set(key, current);
    });

    payments.forEach((payment) => {
      const date = parseDateOnly(payment.paymentDate);
      if (!date) return;
      const key = toDateKey(date);
      const current = financialGrouped.get(key) ?? { billed: 0, paid: 0 };
      current.paid = roundCurrency(current.paid + parseMoney(payment.amount));
      financialGrouped.set(key, current);
    });

    const financialData = [...financialGrouped.entries()]
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([date, value]) => ({
        billed: value.billed,
        date,
        paid: value.paid,
      }));

    if (financialData.length > 0) {
      return {
        data: financialData,
        source: 'financial' as const,
      };
    }

    const activityGrouped = new Map<string, { billed: number; paid: number }>();
    appointmentEvents.forEach((event) => {
      const current = activityGrouped.get(event.dateKey) ?? { billed: 0, paid: 0 };
      current.billed += 1;
      activityGrouped.set(event.dateKey, current);
    });

    visitEvents.forEach((event) => {
      const current = activityGrouped.get(event.dateKey) ?? { billed: 0, paid: 0 };
      current.paid += 1;
      activityGrouped.set(event.dateKey, current);
    });

    const activityData = [...activityGrouped.entries()]
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([date, value]) => ({
        billed: value.billed,
        date,
        paid: value.paid,
      }));

    if (activityData.length > 0) {
      return {
        data: activityData,
        source: 'activity' as const,
      };
    }

    return {
      data: [] as Array<{ billed: number; date: string; paid: number }>,
      source: 'empty' as const,
    };
  }, [appointmentEvents, invoices, payments, visitEvents]);
  const revenueAreaData = revenueAreaSeries.data;
  const revenueAreaChartConfig = useMemo(
    () =>
      ({
        billed: {
          color: 'var(--chart-1)',
          label: revenueAreaSeries.source === 'financial' ? 'Billed' : 'Appointments',
        },
        paid: {
          color: 'var(--chart-2)',
          label: revenueAreaSeries.source === 'financial' ? 'Paid' : 'Visits',
        },
      }) satisfies ChartConfig,
    [revenueAreaSeries.source]
  );
  const revenueAreaDescription = useMemo(() => {
    if (revenueAreaSeries.source === 'financial') {
      return 'Showing total billed and paid for the selected range';
    }
    if (revenueAreaSeries.source === 'activity') {
      return 'Showing appointments and visits for the selected range';
    }
    return 'No billing or activity data available yet';
  }, [revenueAreaSeries.source]);
  const filteredRevenueAreaData = useMemo(() => {
    if (revenueAreaData.length === 0) {
      return [];
    }

    const latestDateText = revenueAreaData[revenueAreaData.length - 1]?.date;
    const referenceDate = latestDateText ? new Date(latestDateText) : new Date();
    if (Number.isNaN(referenceDate.getTime())) {
      return revenueAreaData;
    }

    const daysToSubtract = revenueTimeRange === '7d' ? 7 : revenueTimeRange === '30d' ? 30 : 90;
    const startDate = new Date(referenceDate);
    startDate.setDate(startDate.getDate() - daysToSubtract);

    return revenueAreaData.filter((item) => {
      const date = new Date(item.date);
      return !Number.isNaN(date.getTime()) && date >= startDate;
    });
  }, [revenueAreaData, revenueTimeRange]);
  const appointmentMixData = useMemo(
    () => [
      { name: 'Scheduled', value: scheduledAppointmentCount },
      { name: 'Completed', value: completedAppointmentCount },
      { name: 'Cancelled', value: cancelledAppointmentCount },
    ],
    [scheduledAppointmentCount, completedAppointmentCount, cancelledAppointmentCount]
  );
  const safeTransactions = useMemo(
    () => safeSummary?.transactions ?? [],
    [safeSummary?.transactions]
  );
  const safeBalance = safeSummary?.balance ?? 0;
  const safeTotalIn = safeSummary?.totalIn ?? 0;
  const safeTotalOut = safeSummary?.totalOut ?? 0;
  const afnPerUsd = safeSummary?.afnPerUsd ?? DEFAULT_AFN_PER_USD;
  const emptyImplantAvailability = useMemo<DashboardImplantSupplierAvailability[]>(
    () => [
      { count: 0, paid: 0, status: 'not_available', total: 0, unpaid: 0 },
      { count: 0, paid: 0, status: 'in_purchase', total: 0, unpaid: 0 },
      { count: 0, paid: 0, status: 'available', total: 0, unpaid: 0 },
      { count: 0, paid: 0, status: 'done', total: 0, unpaid: 0 },
    ],
    []
  );
  const implantSupplierData = implantSupplierSummary ?? {
    byAvailability: emptyImplantAvailability,
    implantCount: 0,
    paidRatio: 0,
    totalPaid: 0,
    totalSupplierCost: 0,
    totalUnpaid: 0,
    unpaidCount: 0,
  };
  const implantAvailabilityChart = useMemo(() => {
    const labelByStatus: Record<ImplantAvailabilityStatus, string> = {
      available: 'Available',
      done: 'Done',
      in_purchase: 'In Purchase',
      not_available: 'Not Available',
    };

    return implantSupplierData.byAvailability.map((entry) => ({
      count: entry.count,
      label: labelByStatus[entry.status],
      unpaid: entry.unpaid,
    }));
  }, [implantSupplierData.byAvailability]);
  const formatDualCurrency = (usdValue: number): string => formatDualFromUsd(usdValue, afnPerUsd);
  const topSafePickups = useMemo(() => {
    const grouped = new Map<string, number>();
    safeTransactions.forEach((entry) => {
      if (normalizeStatus(asText(entry.direction)) !== 'out') return;
      const person =
        asText(entry.pickedByStaffName) || `Staff #${asText(entry.pickedByStaffId) || '-'}`;
      grouped.set(person, roundCurrency((grouped.get(person) ?? 0) + parseMoney(entry.amount)));
    });

    return [...grouped.entries()]
      .map(([name, amount]) => ({ amount, name }))
      .sort((left, right) => right.amount - left.amount)
      .slice(0, 4);
  }, [safeTransactions]);
  const recentSafeTransactions = useMemo(() => {
    return safeTransactions
      .slice()
      .sort((left, right) =>
        asText(right.transactionDate).localeCompare(asText(left.transactionDate))
      )
      .slice(0, 6);
  }, [safeTransactions]);

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
  const debtOutstanding = useMemo(() => {
    const activeInvoices = invoices.filter(
      (invoice) => normalizeStatus(asText(invoice.status || '')) !== 'cancelled'
    );
    const paidByInvoiceId = new Map<string, number>();

    payments.forEach((payment) => {
      const invoiceId = asText(payment.invoiceId);
      if (!invoiceId) return;
      paidByInvoiceId.set(
        invoiceId,
        roundCurrency((paidByInvoiceId.get(invoiceId) ?? 0) + parseMoney(payment.amount))
      );
    });

    return roundCurrency(
      activeInvoices.reduce((sum, invoice) => {
        const invoiceId = String(invoice.id);
        const netAmount = parseMoney(invoice.netAmount);
        const paidAmount = paidByInvoiceId.get(invoiceId) ?? 0;
        const isPaidStatus = normalizeStatus(asText(invoice.status || '')) === 'paid';
        const effectivePaid = paidAmount > 0 ? paidAmount : isPaidStatus ? netAmount : 0;
        return sum + Math.max(0, netAmount - effectivePaid);
      }, 0)
    );
  }, [invoices, payments]);
  const safeMoneyForRing = Math.max(0, roundCurrency(safeBalance));
  const supplierUnpaids = Math.max(0, roundCurrency(implantSupplierData.totalUnpaid));
  const ringBreakdown = useMemo(() => {
    const total = safeMoneyForRing + debtOutstanding + supplierUnpaids;
    if (total <= 0) {
      return {
        debtPercent: 0,
        safePercent: 0,
        unpaidPercent: 0,
      };
    }

    const safePercent = Math.min(100, Math.max(0, (safeMoneyForRing / total) * 100));
    const debtPercent = Math.min(100 - safePercent, Math.max(0, (debtOutstanding / total) * 100));
    const unpaidPercent = Math.max(0, 100 - safePercent - debtPercent);

    return {
      debtPercent,
      safePercent,
      unpaidPercent,
    };
  }, [debtOutstanding, safeMoneyForRing, supplierUnpaids]);
  const safeRadialChartData = useMemo(
    () =>
      [
        { category: 'inSafe', value: safeMoneyForRing, fill: 'var(--color-inSafe)' },
        { category: 'debts', value: debtOutstanding, fill: 'var(--color-debts)' },
        { category: 'unpaids', value: supplierUnpaids, fill: 'var(--color-unpaids)' },
      ].filter((entry) => entry.value > 0),
    [debtOutstanding, safeMoneyForRing, supplierUnpaids]
  );
  const hasSafeRadialChartData = safeRadialChartData.length > 0;

  const openTreatmentChartFromSelection = (): void => {
    if (!selectedEvent) return;

    if (isCompletedStatus(selectedEvent.status)) {
      if (selectedEvent.patientId !== null && selectedEvent.patientId !== undefined) {
        const encodedPatientId = encodeURIComponent(String(selectedEvent.patientId));
        router.push(
          `/${locale}/dental-management/patients/patient-profile?patientId=${encodedPatientId}`
        );
        return;
      }

      router.push(`/${locale}/dental-management/patients`);
      return;
    }

    if (selectedEvent.linkedVisitId !== null && selectedEvent.linkedVisitId !== undefined) {
      const encodedVisitId = encodeURIComponent(String(selectedEvent.linkedVisitId));
      router.push(`/${locale}/dental-management/visits/chart?visitId=${encodedVisitId}`);
      return;
    }

    router.push(`/${locale}/dental-management/visits`);
  };

  return (
    <div className="space-y-5">
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
                  <h3 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
                    Today&apos;s Patient Visits
                  </h3>
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
                      <p className="mt-1 text-2xl font-semibold text-violet-900">
                        {returningPatients}
                      </p>
                    </div>
                    <div className="rounded-xl border border-emerald-300 bg-emerald-50/80 p-3">
                      <p className="text-xs text-emerald-700">Appointments Today</p>
                      <p className="mt-1 text-2xl font-semibold text-emerald-900">
                        {todayAppointments}
                      </p>
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

                <ToothSurfaceInspector />
              </section>

              <section className="grid gap-3 lg:grid-cols-[1fr_1fr]">
                <div className="rounded-2xl border bg-background p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h4 className="font-semibold">Patient List</h4>
                    <span className="text-xs text-muted-foreground">
                      {formatDayHeading(selectedDate)}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {isLoading ? (
                      <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                        Loading schedule...
                      </p>
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
                              <p className="text-xs text-muted-foreground">
                                {event.title} - {event.tag}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  'rounded-md border px-2 py-0.5 text-[10px] font-semibold capitalize',
                                  theme.chip
                                )}
                              >
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
                        <p className="text-xs text-muted-foreground">
                          {selectedEvent.title} - {selectedEvent.tag}
                        </p>
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
                          {isCompletedStatus(selectedEvent.status)
                            ? 'Open Patient Profile'
                            : 'Open Treatment Chart'}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            </div>

            <aside className="space-y-4">
              <section className="relative overflow-hidden rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-background to-cyan-50 p-4">
                <div className="pointer-events-none absolute -right-8 -top-8 size-24 rounded-full bg-emerald-200/60 blur-2xl" />
                <div className="pointer-events-none absolute -bottom-10 -left-8 size-24 rounded-full bg-cyan-200/50 blur-2xl" />

                <Card className="relative z-10 border-border/70 bg-background/85">
                  <CardHeader className="items-center pb-0">
                    <CardTitle>Radial Chart - Grid</CardTitle>
                    <CardDescription>Safe vs debts vs unpaids</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 pb-0">
                    {hasSafeRadialChartData ? (
                      <ChartContainer
                        config={safeRadialChartConfig}
                        className="mx-auto aspect-square max-h-[250px]"
                      >
                        <RadialBarChart
                          data={safeRadialChartData}
                          innerRadius={30}
                          outerRadius={100}
                        >
                          <ChartTooltip
                            cursor={false}
                            content={<ChartTooltipContent hideLabel nameKey="category" />}
                          />
                          <PolarGrid gridType="circle" />
                          <RadialBar dataKey="value" />
                        </RadialBarChart>
                      </ChartContainer>
                    ) : (
                      <div className="grid h-52 place-items-center rounded-xl border border-dashed text-sm text-muted-foreground">
                        No safe, debt, or unpaid data yet.
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className="flex-col gap-2 text-sm">
                    <div className="flex items-center gap-2 leading-none font-medium">
                      Safe share {Math.round(ringBreakdown.safePercent)}%{' '}
                      <TrendingUp className="h-4 w-4" />
                    </div>
                    <div className="leading-none text-muted-foreground">
                      Safe {formatDualCurrency(safeBalance)} | Debts{' '}
                      {formatCurrency(debtOutstanding)} | Unpaids {formatCurrency(supplierUnpaids)}
                    </div>
                  </CardFooter>
                </Card>
              </section>

              <section className="rounded-2xl border bg-background p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">Your Schedule</p>
                    <p className="text-xs text-muted-foreground">{formatMonth(currentMonth)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={goToPreviousMonth}
                    >
                      <ChevronLeft className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={goToNextMonth}
                    >
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
                              isSelected
                                ? 'bg-primary-foreground/90 text-primary'
                                : cellTheme.badgeClass
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
                  <span className="text-xs text-muted-foreground">
                    {upcomingEvents.length} records
                  </span>
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
                            <span
                              className={cn(
                                'rounded-md border px-2 py-0.5 text-[10px] font-semibold capitalize',
                                theme.chip
                              )}
                            >
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

      <section className="space-y-2">
        <div className="px-1">
          <p className="text-sm font-semibold">Performance Snapshot</p>
          <p className="text-xs text-muted-foreground">Quick operational health indicators</p>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
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

          <Card className="rounded-2xl border">
            <CardContent className="p-4">
              <div className="mb-2 flex items-center gap-2">
                <Building2 className="size-4 text-primary" />
                <p className="text-sm font-semibold">Supplier Unpaid</p>
              </div>
              <p className="text-3xl font-semibold">
                {formatDualCurrency(implantSupplierData.totalUnpaid)}
              </p>
              <p className="text-xs text-muted-foreground">
                {implantSupplierData.unpaidCount} implant teeth still unpaid
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-2">
        <div className="px-1">
          <p className="text-sm font-semibold">Analytics</p>
          <p className="text-xs text-muted-foreground">
            Appointments, revenue, and supplier trends
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="rounded-2xl border border-border/80 bg-gradient-to-br from-blue-50 via-background to-cyan-50 pt-0">
            <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row">
              <div className="grid flex-1 gap-1">
                <CardTitle>Area Chart - Interactive</CardTitle>
                <CardDescription>{revenueAreaDescription}</CardDescription>
              </div>
              <Select
                value={revenueTimeRange}
                onValueChange={(value) => {
                  if (value === '7d' || value === '30d' || value === '90d') {
                    setRevenueTimeRange(value);
                  }
                }}
              >
                <SelectTrigger
                  className="hidden w-[160px] rounded-lg sm:ml-auto sm:flex"
                  aria-label="Select revenue range"
                >
                  <SelectValue placeholder="Last 3 months" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="90d" className="rounded-lg">
                    Last 3 months
                  </SelectItem>
                  <SelectItem value="30d" className="rounded-lg">
                    Last 30 days
                  </SelectItem>
                  <SelectItem value="7d" className="rounded-lg">
                    Last 7 days
                  </SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
              {filteredRevenueAreaData.length === 0 ? (
                <div className="grid h-[250px] place-items-center rounded-xl border border-dashed text-sm text-muted-foreground">
                  No chart data available yet.
                </div>
              ) : (
                <ChartContainer
                  config={revenueAreaChartConfig}
                  className="aspect-auto h-[250px] w-full"
                >
                  <AreaChart data={filteredRevenueAreaData}>
                    <defs>
                      <linearGradient id="fillBilled" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-billed)" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="var(--color-billed)" stopOpacity={0.1} />
                      </linearGradient>
                      <linearGradient id="fillPaid" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-paid)" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="var(--color-paid)" stopOpacity={0.1} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      minTickGap={32}
                      tickFormatter={(value) => {
                        const date = new Date(value);
                        return date.toLocaleDateString('en-US', {
                          day: 'numeric',
                          month: 'short',
                        });
                      }}
                    />
                    <ChartTooltip
                      cursor={false}
                      content={
                        <ChartTooltipContent
                          indicator="dot"
                          labelFormatter={(value) => {
                            return new Date(String(value)).toLocaleDateString('en-US', {
                              day: 'numeric',
                              month: 'short',
                            });
                          }}
                        />
                      }
                    />
                    <Area
                      dataKey="paid"
                      type="natural"
                      fill="url(#fillPaid)"
                      stroke="var(--color-paid)"
                      stackId="a"
                    />
                    <Area
                      dataKey="billed"
                      type="natural"
                      fill="url(#fillBilled)"
                      stroke="var(--color-billed)"
                      stackId="a"
                    />
                    <ChartLegend content={<ChartLegendContent />} />
                  </AreaChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-border/80 bg-gradient-to-br from-orange-50 via-background to-emerald-50">
            <CardContent className="p-4">
              <div className="mb-3">
                <p className="text-sm font-semibold">Appointment Mix</p>
                <p className="text-xs text-muted-foreground">Current appointment distribution</p>
              </div>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={appointmentMixData}>
                    <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      tickLine={false}
                    />
                    <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} width={60} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#0ea5e9" radius={[10, 10, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-border/80 bg-gradient-to-br from-sky-50 via-background to-blue-50">
            <CardContent className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Third-Company Liability</p>
                  <p className="text-xs text-muted-foreground">Implant supplier paid vs unpaid</p>
                </div>
                <Building2 className="size-5 text-blue-700" />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl border border-blue-200 bg-blue-100/70 p-3">
                  <p className="text-xs text-blue-900">Total Supplier Cost</p>
                  <p className="text-sm font-semibold text-blue-900">
                    {formatDualCurrency(implantSupplierData.totalSupplierCost)}
                  </p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-100/70 p-3">
                  <p className="text-xs text-emerald-900">Paid to Supplier</p>
                  <p className="text-sm font-semibold text-emerald-900">
                    {formatDualCurrency(implantSupplierData.totalPaid)}
                  </p>
                </div>
                <div className="rounded-xl border border-orange-200 bg-orange-100/70 p-3">
                  <p className="text-xs text-orange-900">Unpaid to Supplier</p>
                  <p className="text-sm font-semibold text-orange-900">
                    {formatDualCurrency(implantSupplierData.totalUnpaid)}
                  </p>
                </div>
                <div className="rounded-xl border bg-white/90 p-3">
                  <p className="text-xs text-muted-foreground">Unpaid Teeth</p>
                  <p className="text-sm font-semibold text-foreground">
                    {implantSupplierData.unpaidCount} / {implantSupplierData.implantCount}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Paid ratio: {implantSupplierData.paidRatio}%
                  </p>
                </div>
              </div>
              <div className="mt-3 h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={implantAvailabilityChart}>
                    <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: '#64748b', fontSize: 10 }}
                      tickLine={false}
                    />
                    <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} width={70} />
                    <Tooltip formatter={(value) => formatDualCurrency(Number(value ?? 0))} />
                    <Bar dataKey="unpaid" fill="#f97316" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-2">
        <div className="px-1">
          <p className="text-sm font-semibold">Finance & Cashflow</p>
          <p className="text-xs text-muted-foreground">
            Safe transactions and supplier liabilities
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <Card className="rounded-2xl border border-border/80 bg-gradient-to-br from-emerald-50 via-background to-cyan-50">
            <CardContent className="p-4">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Safe Overview</p>
                  <p className="text-xs text-muted-foreground">All income and outflow summary</p>
                </div>
                <Vault className="size-5 text-emerald-700" />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border bg-white/90 p-3">
                  <p className="text-xs text-muted-foreground">Current Balance</p>
                  <p className="text-lg font-semibold">{formatDualCurrency(safeBalance)}</p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-100/70 p-3">
                  <p className="text-xs text-emerald-900">Total In</p>
                  <p className="text-lg font-semibold text-emerald-900">
                    {formatDualCurrency(safeTotalIn)}
                  </p>
                </div>
                <div className="rounded-xl border border-orange-200 bg-orange-100/70 p-3">
                  <p className="text-xs text-orange-900">Total Out</p>
                  <p className="text-lg font-semibold text-orange-900">
                    {formatDualCurrency(safeTotalOut)}
                  </p>
                </div>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="rounded-lg border bg-white/90 p-3">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Top Safe Pickups</p>
                  {topSafePickups.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No outflow by staff yet.</p>
                  ) : (
                    topSafePickups.map((row) => (
                      <div
                        key={`safe-pickup-${row.name}`}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="truncate text-muted-foreground">{row.name}</span>
                        <span className="font-semibold">{formatDualCurrency(row.amount)}</span>
                      </div>
                    ))
                  )}
                </div>
                <div className="rounded-lg border bg-white/90 p-3">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Net Position</p>
                  <div className="flex items-center justify-between text-xs">
                    <span className="inline-flex items-center gap-1 text-emerald-700">
                      <ArrowDownLeft className="size-3.5" />
                      Inflow
                    </span>
                    <span className="font-semibold">{formatDualCurrency(safeTotalIn)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs">
                    <span className="inline-flex items-center gap-1 text-orange-700">
                      <ArrowUpRight className="size-3.5" />
                      Outflow
                    </span>
                    <span className="font-semibold">{formatDualCurrency(safeTotalOut)}</span>
                  </div>
                  <div className="mt-2 border-t border-border/70 pt-2 text-xs">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Supplier unpaid</span>
                      <span className="font-semibold text-orange-700">
                        {formatDualCurrency(implantSupplierData.totalUnpaid)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-muted-foreground">
                      <span>Supplier paid</span>
                      <span className="font-semibold text-emerald-700">
                        {formatDualCurrency(implantSupplierData.totalPaid)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-border/80 bg-gradient-to-br from-slate-50 via-background to-slate-100">
            <CardContent className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold">Recent Safe Activity</p>
                <span className="text-xs text-muted-foreground">
                  {recentSafeTransactions.length} entries
                </span>
              </div>
              <div className="space-y-2">
                {recentSafeTransactions.length === 0 ? (
                  <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                    No safe transactions yet.
                  </p>
                ) : (
                  recentSafeTransactions.map((entry) => (
                    <div key={entry.id} className="rounded-xl border bg-white/90 p-3 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold capitalize">
                          {entry.entryType.replaceAll('_', ' ')}
                        </span>
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 font-semibold',
                            normalizeStatus(entry.direction) === 'in'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-orange-100 text-orange-800'
                          )}
                        >
                          {entry.direction.toUpperCase()}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-muted-foreground">
                        <span>{entry.transactionDate || '-'}</span>
                        <span className="font-semibold text-foreground">
                          {formatDualCurrency(entry.amount)}
                        </span>
                      </div>
                      <p className="mt-1 text-muted-foreground">
                        {entry.pickedByStaffName
                          ? `By: ${entry.pickedByStaffName}`
                          : entry.notes || '-'}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
};
