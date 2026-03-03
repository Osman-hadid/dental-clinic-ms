'use client';

import { JSX, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { Header } from '@/components/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { AxiosClient } from '@/modules/common/infrastructure/api/axios-client';
import { type Tooth } from '@/modules/dental-management/domain/entities/Tooth';
import { type Treatment } from '@/modules/dental-management/domain/entities/Treatment';
import { type VisitTreatment } from '@/modules/dental-management/domain/entities/VisitTreatment';
import {
  useGetPatient,
  useInvoiceList,
  useToothList,
  useVisitList,
  useVisitTreatmentList,
} from '@/modules/dental-management/presentation/hooks';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CalendarDays,
  ClipboardCheck,
  HeartPulse,
  Printer,
  Sparkles,
  Stethoscope,
  Trash2,
  UserRound,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';

type ConditionKey =
  | 'caries'
  | 'surgery'
  | 'implant'
  | 'gingivitis'
  | 'periodontitis'
  | 'removal'
  | 'periostitis';

type ConditionMeta = {
  color: string;
  label: string;
};

type VisitTreatmentWithRelations = VisitTreatment & {
  tooth?: Partial<Tooth>;
  treatment?: Partial<Treatment>;
  visit?: { visitDate?: string };
};

type SessionTaskStatus = 'done' | 'in_progress' | 'pending';

type SessionTask = {
  id: number;
  title: string;
  mark: string;
  status: SessionTaskStatus;
  notes?: string;
  createdAt: string;
};

type PaymentItem = {
  id: number | string;
  paymentDate?: string;
  amount?: string | number;
  method?: string;
  notes?: string;
};

type InvoicePaymentSummary = {
  id: string;
  invoiceDate: string;
  invoiceKind: 'debt_settlement' | 'debt_source' | 'standard';
  linkedInvoiceId: string;
  isEstimatedPaid: boolean;
  notes: string;
  paymentType: string;
  payments: PaymentItem[];
  remainingAmount: number;
  status: string;
  totalAmount: number;
  totalDiscount: number;
  totalNet: number;
  totalPaid: number;
  visitId: string;
  visitLabel: string;
};

type IncomeTrendPoint = {
  debt: number;
  income: number;
  label: string;
  monthKey: string;
};

const CONDITIONS: Record<ConditionKey, ConditionMeta> = {
  caries: { color: '#4ade80', label: 'Caries' },
  gingivitis: { color: '#f87171', label: 'Gingivitis' },
  implant: { color: '#c084fc', label: 'Implant' },
  periodontitis: { color: '#67e8f9', label: 'Periodontitis' },
  periostitis: { color: '#8b5e3c', label: 'Periostitis' },
  removal: { color: '#cbd5e1', label: 'Removal' },
  surgery: { color: '#f9a8d4', label: 'Surgery' },
};

const CONDITION_CODES: Record<string, ConditionKey> = {
  c: 'caries',
  g: 'gingivitis',
  i: 'implant',
  o: 'periostitis',
  p: 'periodontitis',
  r: 'removal',
  s: 'surgery',
};

const UPPER_ARCH = ['18', '17', '16', '15', '14', '13', '12', '11', '21', '22', '23', '24', '25', '26', '27', '28'];
const LOWER_ARCH = ['48', '47', '46', '45', '44', '43', '42', '41', '31', '32', '33', '34', '35', '36', '37', '38'];
const RING_TEETH = [...UPPER_ARCH, ...LOWER_ARCH];
const PRINT_UPPER_ARCH = ['18', '17', '16', '15', '14', '13', '12', '11', '21', '22', '23', '24', '25', '26', '27', '28'];
const PRINT_LOWER_ARCH = ['48', '47', '46', '45', '44', '43', '42', '41', '31', '32', '33', '34', '35', '36', '37', '38'];
const PRINT_ALL_TEETH = [...PRINT_UPPER_ARCH, ...PRINT_LOWER_ARCH];
const MAX_PER_PAGE = 100;
const TASK_MARKS = [
  { color: '#22c55e', label: 'Routine', value: 'green' },
  { color: '#3b82f6', label: 'Info', value: 'blue' },
  { color: '#eab308', label: 'Watch', value: 'yellow' },
  { color: '#f97316', label: 'Priority', value: 'orange' },
  { color: '#ef4444', label: 'Urgent', value: 'red' },
  { color: '#a855f7', label: 'Special', value: 'purple' },
] as const;

const parseConditionToken = (value?: string): ConditionKey | null => {
  if (!value) return null;
  const token = value.trim().toLowerCase();
  if (token in CONDITIONS) return token as ConditionKey;
  return CONDITION_CODES[token] ?? null;
};

const isToothNumber = (value: string): boolean => /^\d{2}$/.test(value);

const parseToothNumbersFromValue = (value?: string): string[] => {
  if (!value) return [];
  const numbers = value
    .split(',')
    .map((item) => item.trim())
    .filter(isToothNumber);
  return Array.from(new Set(numbers));
};

const parseChartConditionMap = (notes?: string): Record<string, ConditionKey> => {
  if (!notes) return {};

  const match = notes.match(/\[chart:([^\]]+)\]/i);
  if (!match) return {};

  const result: Record<string, ConditionKey> = {};
  const pairs = match[1].split(',');
  for (const pair of pairs) {
    const [tooth, conditionRaw] = pair.split('=').map((item) => item?.trim() ?? '');
    const condition = parseConditionToken(conditionRaw);
    if (/^\d{2}$/.test(tooth) && condition) {
      result[tooth] = condition;
    }
  }

  return result;
};

const parseLegacyCondition = (notes?: string): ConditionKey | null => {
  if (!notes) return null;
  const match = notes.match(/\[condition:([a-z]+)\]/i);
  return parseConditionToken(match?.[1]);
};

const parseLegacyTooth = (notes?: string): string | null => {
  if (!notes) return null;
  const match = notes.match(/\[tooth:([0-9]{2})\]/i);
  return match?.[1] ?? null;
};

const stripMetadataPrefixes = (value?: string): string => {
  if (!value) return '';
  return value
    .replace(/^\[chart:[^\]]+\]\s*/i, '')
    .replace(/^\[condition:[a-z]+\]\s*/i, '')
    .replace(/^\[tooth:[0-9]{2}\]\s*/i, '')
    .replace(/^\[condition:[a-z]+\]\[tooth:[0-9]{2}\]\s*/i, '')
    .trim();
};

const inferConditionFromText = (value?: string): ConditionKey | null => {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();

  if (normalized.includes('caries')) return 'caries';
  if (normalized.includes('surgery')) return 'surgery';
  if (normalized.includes('implant')) return 'implant';
  if (normalized.includes('gingivitis')) return 'gingivitis';
  if (normalized.includes('periodontitis')) return 'periodontitis';
  if (normalized.includes('removal') || normalized.includes('extract')) return 'removal';
  if (normalized.includes('periostitis')) return 'periostitis';

  return null;
};

const hexToRgba = (hex: string, alpha: number): string => {
  const normalized = hex.replace('#', '');
  const bigint = Number.parseInt(normalized, 16);
  const red = (bigint >> 16) & 255;
  const green = (bigint >> 8) & 255;
  const blue = bigint & 255;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

const getToothRegion = (toothNumber: string): 'Maxilla' | 'Mandible' => {
  const firstDigit = Number(toothNumber[0]);
  return firstDigit <= 2 ? 'Maxilla' : 'Mandible';
};

const ageFromDate = (dateOfBirth?: string): number | null => {
  if (!dateOfBirth) return null;

  const birthday = new Date(dateOfBirth);
  if (Number.isNaN(birthday.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birthday.getFullYear();
  const monthDiff = today.getMonth() - birthday.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthday.getDate())) {
    age -= 1;
  }
  return age;
};

const parseAmount = (value: unknown): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const normalized = value.replace(/[^0-9.-]/g, '');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const asText = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value.trim();
  return '';
};

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    currency: 'AFN',
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
    style: 'currency',
  }).format(value);
};

const formatDisplayDate = (value?: string): string => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(parsed);
};

const toMonthKey = (value?: string): string | null => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const toMonthLabel = (monthKey: string): string => {
  const [yearText, monthText] = monthKey.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return monthKey;

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    year: 'numeric',
  }).format(new Date(year, month - 1, 1));
};

const escapeHtml = (value: unknown): string => {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
};

const extractLinkedInvoiceId = (notes: string): string => {
  if (!notes) return '';
  const settlementMatch = notes.match(/settlement invoice\s*#(\d+)/i);
  if (settlementMatch?.[1]) {
    return settlementMatch[1];
  }

  const sourceMatch = notes.match(/generated from invoice\s*#(\d+)/i);
  return sourceMatch?.[1] ?? '';
};

const resolveInvoiceKind = (notes: string): 'debt_settlement' | 'debt_source' | 'standard' => {
  const normalized = notes.toLowerCase();
  if (normalized.includes('settlement invoice generated from invoice #')) {
    return 'debt_settlement';
  }
  if (normalized.includes('debt moved to a settlement flow from invoice #')) {
    return 'debt_source';
  }
  return 'standard';
};

// eslint-disable-next-line react/function-component-definition
export default function PatientProfilePage(): JSX.Element {
  const searchParams = useSearchParams();
  const patientId = searchParams.get('patientId')?.trim() ?? '';
  const tSidebar = useTranslations('sidebar.dentalManagement');
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [taskTitle, setTaskTitle] = useState('');
  const [taskMark, setTaskMark] = useState<string>('blue');
  const [taskStatus, setTaskStatus] = useState<SessionTaskStatus>('pending');
  const [taskNotes, setTaskNotes] = useState('');
  const [taskError, setTaskError] = useState('');

  const { data: patientResponse, isFetching: isLoadingPatient } = useGetPatient(patientId || '', {
    enabled: !!patientId,
  });
  const patient = patientResponse?.data ?? null;

  const { entities: teeth } = useToothList(1, MAX_PER_PAGE);
  const toothById = useMemo(
    () => new Map(teeth.map((tooth) => [String(tooth.id), tooth.toothNumber])),
    [teeth]
  );

  const visitFilters = useMemo(() => ({ patientId: patientId ? [patientId] : ['-1'] }), [patientId]);
  const { entities: visits } = useVisitList(
    1,
    MAX_PER_PAGE,
    '',
    [],
    ['appointment', 'dentist'],
    visitFilters
  );
  const invoiceFilters = useMemo(() => ({ patientId: patientId ? [patientId] : ['-1'] }), [patientId]);
  const { entities: invoices, isFetching: isLoadingInvoices } = useInvoiceList(
    1,
    MAX_PER_PAGE,
    '',
    [],
    ['visit', 'payments'],
    invoiceFilters
  );
  const visitIds = useMemo(() => visits.map((visit) => String(visit.id)), [visits]);

  const visitTreatmentFilters = useMemo(
    () => ({ visitId: visitIds.length > 0 ? visitIds : ['-1'] }),
    [visitIds]
  );
  const { entities: visitTreatments, isFetching: isLoadingTreatments } = useVisitTreatmentList(
    1,
    MAX_PER_PAGE,
    '',
    [],
    ['tooth', 'treatment', 'visit'],
    visitTreatmentFilters
  );
  const typedVisitTreatments = visitTreatments as VisitTreatmentWithRelations[];
  const visitOrderIndexById = useMemo(() => {
    const sortedVisits = visits.slice().sort((left, right) => {
      const leftDate = new Date(left.visitDate || '').getTime();
      const rightDate = new Date(right.visitDate || '').getTime();

      if (!Number.isNaN(leftDate) && !Number.isNaN(rightDate) && leftDate !== rightDate) {
        return leftDate - rightDate;
      }

      const leftCreatedAt = new Date(left.createdAt || '').getTime();
      const rightCreatedAt = new Date(right.createdAt || '').getTime();
      if (!Number.isNaN(leftCreatedAt) && !Number.isNaN(rightCreatedAt) && leftCreatedAt !== rightCreatedAt) {
        return leftCreatedAt - rightCreatedAt;
      }

      return String(left.id).localeCompare(String(right.id), undefined, { numeric: true, sensitivity: 'base' });
    });

    const map = new Map<string, number>();
    sortedVisits.forEach((visit, index) => {
      map.set(String(visit.id), index);
    });
    return map;
  }, [visits]);

  const tasksQueryKey = useMemo(() => ['patient-session-tasks', patientId], [patientId]);
  const { data: manualTasks = [], isFetching: isLoadingManualTasks } = useQuery<SessionTask[]>({
    enabled: !!patientId,
    queryFn: async () => {
      const client = new AxiosClient();
      const response = await client.get<SessionTask[] | { data?: SessionTask[] }>(
        `/api/v1/dental-management/patients/${patientId}/session-tasks`
      );

      if (!response.success || !response.data) {
        return [];
      }

      if (Array.isArray(response.data)) {
        return response.data;
      }

      return Array.isArray(response.data.data) ? response.data.data : [];
    },
    queryKey: tasksQueryKey,
    staleTime: 0,
  });

  const fullName = useMemo(() => {
    if (!patient) return 'Unknown patient';
    return [patient.firstName, patient.lastName].filter(Boolean).join(' ').trim() || patient.patientCode;
  }, [patient]);

  const patientAge = useMemo(() => ageFromDate(patient?.dateOfBirth), [patient?.dateOfBirth]);

  const toothConditionMap = useMemo(() => {
    const result: Record<string, ConditionKey | null> = {};
    for (const toothNumber of RING_TEETH) result[toothNumber] = null;

    const orderedTreatments = typedVisitTreatments
      .slice()
      .sort((a, b) => {
        const visitIndexA = visitOrderIndexById.get(String(a.visitId)) ?? Number.MAX_SAFE_INTEGER;
        const visitIndexB = visitOrderIndexById.get(String(b.visitId)) ?? Number.MAX_SAFE_INTEGER;
        if (visitIndexA !== visitIndexB) {
          return visitIndexA - visitIndexB;
        }

        const createdAtA = new Date(a.createdAt || '').getTime();
        const createdAtB = new Date(b.createdAt || '').getTime();
        if (!Number.isNaN(createdAtA) && !Number.isNaN(createdAtB) && createdAtA !== createdAtB) {
          return createdAtA - createdAtB;
        }

        return String(a.id).localeCompare(String(b.id), undefined, { numeric: true, sensitivity: 'base' });
      });

    for (const row of orderedTreatments) {
      const fromChart = parseChartConditionMap(row.notes);
      const chartEntries = Object.entries(fromChart);
      if (chartEntries.length > 0) {
        for (const [tooth, condition] of chartEntries) {
          if (tooth in result) {
            result[tooth] = condition;
          }
        }
        continue;
      }

      const legacyCondition = parseLegacyCondition(row.notes);
      const legacyTooth = row.toothNumber || row.tooth?.toothNumber || toothById.get(String(row.toothId)) || parseLegacyTooth(row.notes);
      if (legacyCondition && legacyTooth && legacyTooth in result) {
        result[legacyTooth] = legacyCondition;
      }
    }

    return result;
  }, [typedVisitTreatments, toothById, visitOrderIndexById]);

  const conditionStats = useMemo(() => {
    const totalTeeth = RING_TEETH.length;
    const entries = Object.keys(CONDITIONS).map((conditionKey) => {
      const key = conditionKey as ConditionKey;
      const count = RING_TEETH.filter((tooth) => toothConditionMap[tooth] === key).length;
      return { count, key, percent: Math.round((count / totalTeeth) * 100) };
    });

    const affected = RING_TEETH.filter((tooth) => Boolean(toothConditionMap[tooth])).length;
    const overall = totalTeeth === 0 ? 0 : Math.max(0, Math.round(((totalTeeth - affected) / totalTeeth) * 100));
    return { entries, overall };
  }, [toothConditionMap]);

  const latestVisit = useMemo(() => {
    if (visits.length === 0) return null;
    return visits
      .slice()
      .sort((a, b) => new Date(b.visitDate || '').getTime() - new Date(a.visitDate || '').getTime())[0];
  }, [visits]);

  const orderedVisits = useMemo(
    () =>
      visits
        .slice()
        .sort((a, b) => new Date(b.visitDate || '').getTime() - new Date(a.visitDate || '').getTime()),
    [visits]
  );
  const paymentSummaries = useMemo<InvoicePaymentSummary[]>(() => {
    const summaries: InvoicePaymentSummary[] = [];

    for (const invoice of invoices as Array<Record<string, unknown>>) {
      const rawPayments = Array.isArray(invoice.payments) ? invoice.payments : [];
      const payments: PaymentItem[] = rawPayments
        .map<PaymentItem | null>((payment, index) => {
          if (!payment || typeof payment !== 'object') return null;
          const paymentRow = payment as Record<string, unknown>;
          const id = asText(paymentRow.id) || `${asText(invoice.id)}-${index}`;
          return {
            amount: asText(paymentRow.amount),
            id,
            method: asText(paymentRow.method),
            notes: asText(paymentRow.notes),
            paymentDate: asText(paymentRow.paymentDate ?? paymentRow.payment_date),
          };
        })
        .filter((payment): payment is PaymentItem => payment !== null);

      const totalAmount = parseAmount(invoice.totalAmount ?? invoice.total_amount);
      const totalDiscount = parseAmount(invoice.discount);
      const totalNet = parseAmount(invoice.netAmount ?? invoice.net_amount);
      const rawPaid = payments.reduce((sum, payment) => sum + parseAmount(payment.amount), 0);
      const status = asText(invoice.status).toLowerCase();
      const isEstimatedPaid = status === 'paid' && rawPaid <= 0 && totalNet > 0;
      const totalPaid = isEstimatedPaid ? totalNet : rawPaid;
      const remainingAmount = Math.max(0, Number((totalNet - totalPaid).toFixed(2)));
      const notes = asText(invoice.notes);
      const invoiceKind = resolveInvoiceKind(notes);
      const linkedInvoiceId = extractLinkedInvoiceId(notes);

      const visit = invoice.visit && typeof invoice.visit === 'object'
        ? (invoice.visit as Record<string, unknown>)
        : null;
      const visitId = asText(invoice.visitId ?? invoice.visit_id);
      const visitLabel = asText(visit?.tag ?? visit?.name) || (visitId ? `Visit #${visitId}` : '-');

      summaries.push({
        id: asText(invoice.id),
        invoiceDate: asText(invoice.invoiceDate ?? invoice.invoice_date),
        invoiceKind,
        isEstimatedPaid,
        linkedInvoiceId,
        notes,
        payments,
        paymentType: asText(invoice.paymentType ?? invoice.payment_type) || '-',
        remainingAmount,
        status: status || '-',
        totalAmount,
        totalDiscount,
        totalNet,
        totalPaid,
        visitId,
        visitLabel,
      });
    }

    return summaries.sort((left, right) => {
      const rightDate = new Date(right.invoiceDate || '').getTime();
      const leftDate = new Date(left.invoiceDate || '').getTime();
      if (!Number.isNaN(rightDate) && !Number.isNaN(leftDate) && rightDate !== leftDate) {
        return rightDate - leftDate;
      }
      return left.id.localeCompare(right.id, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [invoices]);
  const paymentSummaryById = useMemo(() => {
    const map = new Map<string, InvoicePaymentSummary>();
    paymentSummaries.forEach((invoice) => {
      map.set(invoice.id, invoice);
    });
    return map;
  }, [paymentSummaries]);
  const debtFlowByInvoiceId = useMemo(() => {
    const map = new Map<string, { settlementId: string; sourceId: string }>();

    paymentSummaries.forEach((invoice) => {
      if (invoice.invoiceKind === 'debt_source' && invoice.linkedInvoiceId) {
        const settlementId = invoice.linkedInvoiceId;
        map.set(invoice.id, { settlementId, sourceId: invoice.id });
        map.set(settlementId, { settlementId, sourceId: invoice.id });
      }

      if (invoice.invoiceKind === 'debt_settlement' && invoice.linkedInvoiceId) {
        const sourceId = invoice.linkedInvoiceId;
        map.set(invoice.id, { settlementId: invoice.id, sourceId });
        map.set(sourceId, { settlementId: invoice.id, sourceId });
      }
    });

    return map;
  }, [paymentSummaries]);

  const incomeTrend = useMemo<IncomeTrendPoint[]>(() => {
    const buckets = new Map<string, { debt: number; income: number }>();

    for (const invoice of paymentSummaries) {
      const invoiceMonthKey = toMonthKey(invoice.invoiceDate);
      if (invoiceMonthKey) {
        const currentBucket = buckets.get(invoiceMonthKey) ?? { debt: 0, income: 0 };
        currentBucket.debt = Number((currentBucket.debt + invoice.remainingAmount).toFixed(2));
        buckets.set(invoiceMonthKey, currentBucket);
      }

      if (invoice.payments.length > 0) {
        for (const payment of invoice.payments) {
          const monthKey = toMonthKey(payment.paymentDate || invoice.invoiceDate);
          if (!monthKey) {
            continue;
          }
          const currentBucket = buckets.get(monthKey) ?? { debt: 0, income: 0 };
          currentBucket.income = Number((currentBucket.income + parseAmount(payment.amount)).toFixed(2));
          buckets.set(monthKey, currentBucket);
        }
        continue;
      }

      if (invoice.totalPaid > 0) {
        const monthKey = toMonthKey(invoice.invoiceDate);
        if (!monthKey) {
          continue;
        }
        const currentBucket = buckets.get(monthKey) ?? { debt: 0, income: 0 };
        currentBucket.income = Number((currentBucket.income + invoice.totalPaid).toFixed(2));
        buckets.set(monthKey, currentBucket);
      }
    }

    return [...buckets.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([monthKey, values]) => ({
        debt: values.debt,
        income: values.income,
        label: toMonthLabel(monthKey),
        monthKey,
      }));
  }, [paymentSummaries]);

  const totalIncome = useMemo(
    () => incomeTrend.reduce((sum, point) => Number((sum + point.income).toFixed(2)), 0),
    [incomeTrend]
  );
  const totalDebt = useMemo(
    () => incomeTrend.reduce((sum, point) => Number((sum + point.debt).toFixed(2)), 0),
    [incomeTrend]
  );
  const latestIncome = incomeTrend.length > 0 ? incomeTrend[incomeTrend.length - 1].income : 0;
  const latestDebt = incomeTrend.length > 0 ? incomeTrend[incomeTrend.length - 1].debt : 0;
  const averageIncome = incomeTrend.length > 0 ? Number((totalIncome / incomeTrend.length).toFixed(2)) : 0;

  const fetchCsrfClient = async (): Promise<AxiosClient> => {
    const client = new AxiosClient();
    await client.get('/sanctum/csrf-cookie');
    return client;
  };

  const invalidateTasks = async (): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: tasksQueryKey });
  };

  const createTaskMutation = useMutation({
    mutationFn: async (payload: {
      mark: string;
      notes: string;
      status: SessionTaskStatus;
      title: string;
    }) => {
      const client = await fetchCsrfClient();
      return client.post<SessionTask>(
        `/api/v1/dental-management/patients/${patientId}/session-tasks`,
        payload
      );
    },
    onSettled: invalidateTasks,
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: Partial<Pick<SessionTask, 'mark' | 'notes' | 'status' | 'title'>> }) => {
      const client = await fetchCsrfClient();
      return client.put<SessionTask>(
        `/api/v1/dental-management/patients/${patientId}/session-tasks/${id}`,
        payload
      );
    },
    onSettled: invalidateTasks,
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (id: number) => {
      const client = await fetchCsrfClient();
      return client.delete<null>(
        `/api/v1/dental-management/patients/${patientId}/session-tasks/${id}`
      );
    },
    onSettled: invalidateTasks,
  });

  const handleAddTask = async (): Promise<void> => {
    const normalizedTitle = taskTitle.trim();
    const normalizedNotes = taskNotes.trim();
    if (!normalizedTitle || !patientId) return;

    setTaskError('');
    const response = await createTaskMutation.mutateAsync({
      mark: taskMark,
      notes: normalizedNotes,
      status: taskStatus,
      title: normalizedTitle,
    });

    if (!response.success) {
      setTaskError(response.error?.message || 'Failed to create task.');
      return;
    }

    setTaskTitle('');
    setTaskMark('blue');
    setTaskNotes('');
    setTaskStatus('pending');
  };

  const handleDeleteTask = async (taskId: number): Promise<void> => {
    setTaskError('');
    const response = await deleteTaskMutation.mutateAsync(taskId);

    if (!response.success) {
      setTaskError(response.error?.message || 'Failed to delete task.');
    }
  };

  const handleStatusChange = async (taskId: number, nextStatus: SessionTaskStatus): Promise<void> => {
    setTaskError('');
    const response = await updateTaskMutation.mutateAsync({
      id: taskId,
      payload: { status: nextStatus },
    });

    if (!response.success) {
      setTaskError(response.error?.message || 'Failed to update task status.');
    }
  };

  const handlePrintPatientRecord = (): void => {
    if (!patient) {
      toast.error('Patient data is not ready yet.');
      return;
    }

    if (typedVisitTreatments.length === 0) {
      toast.error('No recorded treatments to print.');
      return;
    }

    const printConditionColors: Record<ConditionKey, string> = {
      caries: '#4ade80',
      gingivitis: '#f87171',
      implant: '#c084fc',
      periodontitis: '#67e8f9',
      periostitis: '#8b5e3c',
      removal: '#cbd5e1',
      surgery: '#f9a8d4',
    };

    const treatmentById = new Map(
      typedVisitTreatments
        .filter((row) => row.treatment)
        .map((row) => [String(row.treatmentId), row.treatment as Partial<Treatment>])
    );

    const resolveRowTeeth = (row: VisitTreatmentWithRelations): string[] => {
      const fromChartMetadata = Object.keys(parseChartConditionMap(row.notes));
      if (fromChartMetadata.length > 0) return fromChartMetadata;

      const fromToothNumber = parseToothNumbersFromValue(row.toothNumber);
      if (fromToothNumber.length > 0) return fromToothNumber;

      const toothNumber =
        row.tooth?.toothNumber
        ?? toothById.get(String(row.toothId))
        ?? parseLegacyTooth(row.notes);

      return toothNumber ? [toothNumber] : [];
    };

    const resolveRowConditionMap = (row: VisitTreatmentWithRelations): Record<string, ConditionKey> => {
      const fromChartMetadata = parseChartConditionMap(row.notes);
      if (Object.keys(fromChartMetadata).length > 0) return fromChartMetadata;

      const condition =
        parseLegacyCondition(row.notes)
        ?? inferConditionFromText(row.treatment?.category)
        ?? inferConditionFromText(row.treatment?.name);

      if (!condition) return {};

      const mapped: Record<string, ConditionKey> = {};
      for (const toothNumber of resolveRowTeeth(row)) {
        mapped[toothNumber] = condition;
      }
      return mapped;
    };

    const latestVisitForPrint = visits
      .slice()
      .sort((a, b) => {
        const dateA = new Date(a.visitDate || '').getTime();
        const dateB = new Date(b.visitDate || '').getTime();
        if (!Number.isNaN(dateA) && !Number.isNaN(dateB) && dateA !== dateB) {
          return dateB - dateA;
        }

        const createdA = new Date(a.createdAt || '').getTime();
        const createdB = new Date(b.createdAt || '').getTime();
        if (!Number.isNaN(createdA) && !Number.isNaN(createdB) && createdA !== createdB) {
          return createdB - createdA;
        }

        return String(b.id).localeCompare(String(a.id), undefined, { numeric: true, sensitivity: 'base' });
      })[0] ?? null;

    const latestVisitTreatments = latestVisitForPrint
      ? typedVisitTreatments.filter((row) => String(row.visitId) === String(latestVisitForPrint.id))
      : [];
    const printSourceTreatments = latestVisitTreatments.length > 0 ? latestVisitTreatments : typedVisitTreatments;

    const orderedTreatmentsForScheme = typedVisitTreatments
      .slice()
      .sort((a, b) => {
        const visitIndexA = visitOrderIndexById.get(String(a.visitId)) ?? Number.MAX_SAFE_INTEGER;
        const visitIndexB = visitOrderIndexById.get(String(b.visitId)) ?? Number.MAX_SAFE_INTEGER;
        if (visitIndexA !== visitIndexB) {
          return visitIndexA - visitIndexB;
        }

        const createdAtA = new Date(a.createdAt || '').getTime();
        const createdAtB = new Date(b.createdAt || '').getTime();
        if (!Number.isNaN(createdAtA) && !Number.isNaN(createdAtB) && createdAtA !== createdAtB) {
          return createdAtA - createdAtB;
        }

        return String(a.id).localeCompare(String(b.id), undefined, { numeric: true, sensitivity: 'base' });
      });

    const orderedPrintSourceTreatments = printSourceTreatments
      .slice()
      .sort((a, b) => new Date(a.createdAt || '').getTime() - new Date(b.createdAt || '').getTime());

    const printToothConditions: Record<string, ConditionKey | null> = {};
    for (const toothNumber of PRINT_ALL_TEETH) {
      printToothConditions[toothNumber] = null;
    }
    for (const row of orderedTreatmentsForScheme) {
      const rowConditionMap = resolveRowConditionMap(row);
      for (const [toothNumber, condition] of Object.entries(rowConditionMap)) {
        if (toothNumber in printToothConditions) {
          printToothConditions[toothNumber] = condition;
        }
      }
    }

    const conditionStatsRows = (Object.keys(CONDITIONS) as ConditionKey[])
      .map((key) => {
        const count = PRINT_ALL_TEETH.filter((toothNumber) => printToothConditions[toothNumber] === key).length;
        const percent = Math.round((count / PRINT_ALL_TEETH.length) * 100);
        const color = printConditionColors[key];
        return `
          <tr>
            <td>
              <span class="color-dot" style="background:${color};"></span>
              ${escapeHtml(CONDITIONS[key].label)}
            </td>
            <td>${count}</td>
            <td>${percent}%</td>
          </tr>
        `;
      })
      .join('');

    const renderArchCells = (arch: string[]): string => {
      return arch
        .map((toothNumber) => {
          const condition = printToothConditions[toothNumber];
          const conditionLabel = condition ? CONDITIONS[condition].label : 'Healthy';
          const color = condition ? printConditionColors[condition] : '#ffffff';
          const backgroundColor = condition ? hexToRgba(color, 0.28) : '#ffffff';

          return `
            <td class="tooth-cell" style="background:${backgroundColor};border-color:${condition ? color : '#d1d5db'};">
              <div style="font-weight:700;font-size:12px;">${toothNumber}</div>
              <div style="font-size:10px;color:#374151;">${escapeHtml(conditionLabel)}</div>
            </td>
          `;
        })
        .join('');
    };

    const latestVisitTreatmentRows = latestVisitTreatments.length > 0
      ? latestVisitTreatments
        .map((row) => {
          const teeth = resolveRowTeeth(row);
          const teethLabel = teeth.length > 0 ? teeth.join(', ') : '-';
          const treatmentName =
            row.treatment?.name || treatmentById.get(String(row.treatmentId))?.name || `Treatment ${row.treatmentId}`;
          const rowConditionMap = resolveRowConditionMap(row);
          const uniqueConditions = Array.from(new Set(Object.values(rowConditionMap)));
          const conditionLabel =
            uniqueConditions.length === 0
              ? 'Unspecified'
              : uniqueConditions.length === 1
                ? CONDITIONS[uniqueConditions[0]].label
                : `Multiple (${uniqueConditions.map((key) => CONDITIONS[key].label).join(', ')})`;
          const cleanedNotes = stripMetadataPrefixes(row.notes);

          return `
            <tr>
              <td>${escapeHtml(teethLabel)}</td>
              <td>${escapeHtml(treatmentName)}</td>
              <td>${escapeHtml(conditionLabel)}</td>
              <td>${escapeHtml(row.material || '-')}</td>
              <td>${escapeHtml(row.price || '-')}</td>
              <td>${escapeHtml(cleanedNotes || '-')}</td>
            </tr>
          `;
        })
        .join('')
      : '<tr><td colspan="6">No treatments recorded for the latest visit.</td></tr>';

    const latestTreatment = orderedPrintSourceTreatments[orderedPrintSourceTreatments.length - 1] ?? null;
    const latestTeeth = latestTreatment ? resolveRowTeeth(latestTreatment) : [];
    const selectedToothNumber = latestTeeth[0] ?? '-';
    const selectedToothRegion = selectedToothNumber === '-' ? 'N/A' : getToothRegion(selectedToothNumber);
    const noteRows = printSourceTreatments
      .map((row) => {
        const cleanedNotes = stripMetadataPrefixes(row.notes);
        if (!cleanedNotes) return '';

        const teeth = resolveRowTeeth(row);
        const teethLabel = teeth.length > 0 ? teeth.join(', ') : '-';
        const treatmentName =
          row.treatment?.name || treatmentById.get(String(row.treatmentId))?.name || `Treatment ${row.treatmentId}`;

        return `
          <tr>
            <td>${escapeHtml(teethLabel)}</td>
            <td>${escapeHtml(treatmentName)}</td>
            <td>${escapeHtml(cleanedNotes)}</td>
          </tr>
        `;
      })
      .filter(Boolean)
      .join('');

    const now = new Date();
    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Patient Treatment Record</title>
  <style>
    @page { size: auto; margin: 0; }
    html, body {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body { font-family: Arial, sans-serif; padding: 24px; margin: 14mm; color: #111827; }
    h1,h2,h3 { margin: 0 0 8px 0; }
    .section { margin-top: 18px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .box { border: 1px solid #d1d5db; border-radius: 8px; padding: 10px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { border: 1px solid #d1d5db; padding: 8px; font-size: 12px; text-align: left; vertical-align: top; }
    th { background: #f3f4f6; }
    .tooth-cell {
      border: 1px solid #d1d5db;
      padding: 6px;
      text-align: center;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .condition-chip { display:inline-block; padding:2px 8px; border:1px solid; border-radius:999px; font-size:11px; font-weight:600; }
    .color-dot { display:inline-block; width:10px; height:10px; border-radius:999px; margin-right:6px; vertical-align:middle; }
    .muted { color: #6b7280; font-size: 12px; }
  </style>
</head>
<body>
  <h1>Dental Treatment Record</h1>
  <p class="muted">Printed on ${escapeHtml(now.toLocaleString())}</p>

  <div class="section grid">
    <div class="box">
      <h3>Patient</h3>
      <p><strong>Name:</strong> ${escapeHtml(fullName)}</p>
      <p><strong>Code:</strong> ${escapeHtml(patient.patientCode || '-')}</p>
      <p><strong>Contact:</strong> ${escapeHtml(patient.contactNumber || '-')}</p>
    </div>
    <div class="box">
      <h3>Clinical Context</h3>
      <p><strong>Doctor:</strong> ${escapeHtml(latestVisitForPrint?.dentistName || '-')}</p>
      <p><strong>Selected Tooth:</strong> ${escapeHtml(selectedToothNumber)} (${escapeHtml(selectedToothRegion)})</p>
    </div>
  </div>

  <div class="section">
    <h2>Teeth Chart</h2>
    <table>
      <tbody>
        <tr>${renderArchCells(PRINT_UPPER_ARCH)}</tr>
        <tr>${renderArchCells(PRINT_LOWER_ARCH)}</tr>
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2>Condition Summary</h2>
    <table>
      <thead>
        <tr>
          <th>Condition</th>
          <th>Teeth</th>
          <th>Percent</th>
        </tr>
      </thead>
      <tbody>${conditionStatsRows}</tbody>
    </table>
  </div>

  <div class="section">
    <h2>Latest Visit Data</h2>
    ${latestVisitForPrint
    ? `<div class="box">
      <p><strong>Visit:</strong> ${escapeHtml(latestVisitForPrint.tag || latestVisitForPrint.appointmentTag || `Visit #${latestVisitForPrint.id}`)}</p>
      <p><strong>Date:</strong> ${escapeHtml(latestVisitForPrint.visitDate || '-')}</p>
      <p><strong>Dentist:</strong> ${escapeHtml(latestVisitForPrint.dentistName || latestVisitForPrint.dentistId || '-')}</p>
      <p><strong>Diagnosis:</strong> ${escapeHtml(latestVisitForPrint.diagnosisNotes || '-')}</p>
      <p><strong>Next Visit:</strong> ${escapeHtml(latestVisitForPrint.nextVisitDate || '-')}</p>
    </div>
    <table>
      <thead>
        <tr>
          <th>Teeth</th>
          <th>Treatment</th>
          <th>Condition</th>
          <th>Material</th>
          <th>Price</th>
          <th>Note</th>
        </tr>
      </thead>
      <tbody>${latestVisitTreatmentRows}</tbody>
    </table>`
    : '<p class="muted">No visits are recorded for this patient.</p>'}
  </div>

  <div class="section">
    <h2>Notes</h2>
    ${noteRows
    ? `<table>
      <thead>
        <tr>
          <th>Teeth</th>
          <th>Treatment</th>
          <th>Note</th>
        </tr>
      </thead>
      <tbody>${noteRows}</tbody>
    </table>`
    : '<p class="muted">No notes were recorded for this patient.</p>'}
  </div>
</body>
</html>`;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);

    const iframeDocument = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDocument) {
      document.body.removeChild(iframe);
      toast.error('Unable to prepare print document.');
      return;
    }

    iframeDocument.open();
    iframeDocument.write(html);
    iframeDocument.close();

    let didPrint = false;
    const printAndCleanup = (): void => {
      if (didPrint) return;
      didPrint = true;

      const frameWindow = iframe.contentWindow;
      if (!frameWindow) {
        document.body.removeChild(iframe);
        toast.error('Unable to print right now.');
        return;
      }

      frameWindow.focus();
      frameWindow.print();

      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 1000);
    };

    iframe.onload = () => {
      printAndCleanup();
    };

    setTimeout(() => {
      if (document.body.contains(iframe)) {
        printAndCleanup();
      }
    }, 150);
  };

  const isTaskMutationLoading = createTaskMutation.isPending || updateTaskMutation.isPending || deleteTaskMutation.isPending;

  const breadcrumbs = useMemo(
    () => [
      { id: 'dentalManagement', label: tSidebar('title') },
      { href: `/${locale}/dental-management/patients`, id: 'patients', label: 'Patients' },
      { id: 'patientProfile', isCurrent: true, label: fullName },
    ],
    [fullName, locale, tSidebar]
  );

  if (!patientId) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Invalid patient id.</p>
      </div>
    );
  }

  return (
    <>
      <Header breadcrumbs={breadcrumbs} />
      <div className="flex flex-1 flex-col px-4 pb-6 lg:px-6">
        <div className="rounded-3xl border border-border bg-background p-4 text-foreground shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              className="border-border bg-card text-foreground hover:bg-accent hover:text-accent-foreground"
              onClick={() => {
                router.push(`/${locale}/dental-management/patients`);
              }}
            >
              <ArrowLeft className="me-2 size-4" />
              Back To Patients
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-border bg-card text-foreground hover:bg-accent hover:text-accent-foreground"
              onClick={handlePrintPatientRecord}
            >
              <Printer className="me-2 size-4" />
              Print Patient Record
            </Button>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
            <div className="space-y-4">
              <Card className="border-border bg-card text-card-foreground">
                <CardContent className="p-4">
                  <div className="grid gap-4 md:grid-cols-[auto_1fr_1fr] md:items-center">
                    <div className="flex size-16 items-center justify-center rounded-full bg-primary text-xl font-semibold text-primary-foreground">
                      {fullName.slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xl font-semibold">{isLoadingPatient ? 'Loading...' : fullName}</p>
                      <p className="text-sm text-muted-foreground">{patient?.patientCode || '-'}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <p>Age: <span className="font-semibold text-foreground">{patientAge ?? '-'}</span></p>
                      <p>Sex: <span className="font-semibold text-foreground">{patient?.gender || '-'}</span></p>
                      <p>Blood: <span className="font-semibold text-foreground">{patient?.bloodGroup || '-'}</span></p>
                      <p>Tel: <span className="font-semibold text-foreground">{patient?.contactNumber || '-'}</span></p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border bg-card text-card-foreground">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span>Income Diagram</span>
                    <Wallet className="size-4 text-primary" />
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {incomeTrend.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No income or debt data available yet.</p>
                  ) : (
                    <>
                      <div className="grid gap-2 rounded-lg border border-border/70 bg-muted/15 p-3 text-xs sm:grid-cols-5">
                        <p className="text-muted-foreground">
                          Total Income
                          <span className="mt-1 block text-sm font-semibold text-foreground">{formatCurrency(totalIncome)}</span>
                        </p>
                        <p className="text-muted-foreground">
                          Total Debt
                          <span className="mt-1 block text-sm font-semibold text-foreground">{formatCurrency(totalDebt)}</span>
                        </p>
                        <p className="text-muted-foreground">
                          Latest Month
                          <span className="mt-1 block text-sm font-semibold text-foreground">{formatCurrency(latestIncome)}</span>
                        </p>
                        <p className="text-muted-foreground">
                          Latest Debt
                          <span className="mt-1 block text-sm font-semibold text-foreground">{formatCurrency(latestDebt)}</span>
                        </p>
                        <p className="text-muted-foreground">
                          Avg / Month
                          <span className="mt-1 block text-sm font-semibold text-foreground">{formatCurrency(averageIncome)}</span>
                        </p>
                      </div>

                      <div className="h-64 rounded-lg border border-border/70 bg-background p-2">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={incomeTrend} margin={{ bottom: 8, left: 0, right: 10, top: 8 }}>
                            <defs>
                              <linearGradient id="patientIncomeGradient" x1="0" x2="0" y1="0" y2="1">
                                <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.45} />
                                <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.04} />
                              </linearGradient>
                              <linearGradient id="patientDebtGradient" x1="0" x2="0" y1="0" y2="1">
                                <stop offset="5%" stopColor="#f97316" stopOpacity={0.35} />
                                <stop offset="95%" stopColor="#f97316" stopOpacity={0.04} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                            <XAxis
                              axisLine={false}
                              dataKey="label"
                              tick={{ fill: '#64748b', fontSize: 11 }}
                              tickLine={false}
                              tickMargin={8}
                            />
                            <YAxis
                              axisLine={false}
                              tick={{ fill: '#64748b', fontSize: 11 }}
                              tickFormatter={(value) => `AFN ${Number(value).toFixed(0)}`}
                              tickLine={false}
                              width={64}
                            />
                            <RechartsTooltip
                              contentStyle={{
                                backgroundColor: '#ffffff',
                                border: '1px solid #e2e8f0',
                                borderRadius: '8px',
                                boxShadow: '0 8px 22px rgba(15, 23, 42, 0.12)',
                                color: '#0f172a',
                              }}
                              formatter={(value, key) => [
                                formatCurrency(Number(value ?? 0)),
                                key === 'debt' ? 'Debt' : 'Income',
                              ]}
                              labelFormatter={(label) => `Month: ${label}`}
                            />
                            <Area
                              dataKey="income"
                              fill="url(#patientIncomeGradient)"
                              stroke="#0ea5e9"
                              strokeWidth={2.2}
                              type="monotone"
                            />
                            <Area
                              dataKey="debt"
                              fill="url(#patientDebtGradient)"
                              stroke="#f97316"
                              strokeWidth={1.8}
                              type="monotone"
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border bg-card text-card-foreground">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span>Payments</span>
                    <Wallet className="size-4 text-primary" />
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {isLoadingInvoices ? (
                    <p className="text-sm text-muted-foreground">Loading payments...</p>
                  ) : paymentSummaries.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
                  ) : (
                    paymentSummaries.map((invoice) => {
                      const normalizedStatus = invoice.status.toLowerCase();
                      const statusTone = normalizedStatus === 'paid'
                        ? 'bg-emerald-100 text-emerald-700'
                        : normalizedStatus === 'partially_paid'
                          ? 'bg-amber-100 text-amber-700'
                          : normalizedStatus === 'cancelled'
                            ? 'bg-slate-200 text-slate-700'
                            : 'bg-rose-100 text-rose-700';
                      const debtFlow = debtFlowByInvoiceId.get(invoice.id);
                      const sourceInvoice = debtFlow ? paymentSummaryById.get(debtFlow.sourceId) : null;
                      const settlementInvoice = debtFlow ? paymentSummaryById.get(debtFlow.settlementId) : null;
                      const showPartialFlow = normalizedStatus === 'partially_paid' && Boolean(debtFlow);
                      const movedRemainingAmount = invoice.invoiceKind === 'debt_source'
                        ? settlementInvoice?.totalNet ?? 0
                        : 0;
                      const displayedRemainingAmount = Math.max(invoice.remainingAmount, movedRemainingAmount);
                      const hasRemainingAmount = displayedRemainingAmount > 0;
                      const isConnectedInvoice = Boolean(debtFlow);
                      const isBaseConnected = isConnectedInvoice && invoice.invoiceKind === 'debt_source';
                      const isSettlementConnected = isConnectedInvoice && invoice.invoiceKind === 'debt_settlement';
                      const connectionCardTone = isBaseConnected
                        ? 'border-sky-300 bg-sky-50/30'
                        : isSettlementConnected
                          ? 'border-emerald-300 bg-emerald-50/30'
                          : isConnectedInvoice
                            ? 'border-amber-300 bg-amber-50/30'
                            : 'border-border bg-background';
                      const connectionChipTone = isBaseConnected
                        ? 'bg-sky-100 text-sky-700'
                        : isSettlementConnected
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-700';
                      const connectionDotTone = isBaseConnected
                        ? 'bg-sky-500'
                        : isSettlementConnected
                          ? 'bg-emerald-500'
                          : 'bg-amber-500';
                      const connectionTextTone = isBaseConnected
                        ? 'text-sky-700'
                        : isSettlementConnected
                          ? 'text-emerald-700'
                          : 'text-amber-700';
                      const connectionLabel = isBaseConnected
                        ? 'Connected Flow - Base'
                        : isSettlementConnected
                          ? 'Connected Flow - Settlement'
                          : 'Connected Flow';

                      return (
                        <div key={`patient-payment-${invoice.id}`} className={`rounded-lg border p-3 ${connectionCardTone}`}>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-foreground">
                              Invoice #{invoice.id}
                            </p>
                            <div className="flex flex-wrap items-center gap-1.5">
                              {invoice.invoiceKind === 'debt_source' ? (
                                <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold uppercase text-sky-700">
                                  Base Invoice
                                </span>
                              ) : null}
                              {invoice.invoiceKind === 'debt_settlement' ? (
                                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold uppercase text-emerald-700">
                                  Settlement Invoice
                                </span>
                              ) : null}
                              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${statusTone}`}>
                                {invoice.status.replaceAll('_', ' ')}
                              </span>
                              {isConnectedInvoice ? (
                                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${connectionChipTone}`}>
                                  <span className={`size-2 rounded-full ${connectionDotTone}`} />
                                  {connectionLabel}
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Date: {formatDisplayDate(invoice.invoiceDate)} | Visit: {invoice.visitLabel}
                          </p>
                          {invoice.linkedInvoiceId ? (
                            <p className={`text-xs ${connectionTextTone}`}>
                              Connected Invoice: #{invoice.linkedInvoiceId}
                            </p>
                          ) : null}
                          <p className="text-xs text-muted-foreground">
                            Payment Type: {invoice.paymentType}
                          </p>

                          {showPartialFlow ? (
                            <div className="mt-2 rounded-md border border-amber-300/70 bg-amber-50/70 p-2.5">
                              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                                Partial Payment Flow
                              </p>
                              <div className="grid gap-2 md:grid-cols-[1fr_auto_1fr] md:items-center">
                                <div className="rounded-md border border-sky-200 bg-sky-50 p-2">
                                  <p className="text-[11px] font-semibold text-sky-800">Step 1: Base Invoice</p>
                                  <p className="text-xs text-muted-foreground">
                                    #{sourceInvoice?.id || debtFlow?.sourceId || '-'} | {formatDisplayDate(sourceInvoice?.invoiceDate)}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Net: {formatCurrency(sourceInvoice?.totalNet ?? 0)} | Paid: {formatCurrency(sourceInvoice?.totalPaid ?? 0)}
                                  </p>
                                </div>
                                <div className="text-center text-lg font-semibold text-amber-700">{'->'}</div>
                                <div className="rounded-md border border-emerald-200 bg-emerald-50 p-2">
                                  <p className="text-[11px] font-semibold text-emerald-800">Step 2: Settlement Invoice</p>
                                  <p className="text-xs text-muted-foreground">
                                    #{settlementInvoice?.id || debtFlow?.settlementId || '-'} | {formatDisplayDate(settlementInvoice?.invoiceDate)}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Net: {formatCurrency(settlementInvoice?.totalNet ?? 0)} | Paid: {formatCurrency(settlementInvoice?.totalPaid ?? 0)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ) : null}

                          <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                            <p>Total: <span className="font-semibold text-foreground">{formatCurrency(invoice.totalAmount)}</span></p>
                            <p>Discount: <span className="font-semibold text-foreground">{formatCurrency(invoice.totalDiscount)}</span></p>
                            <p>Net: <span className="font-semibold text-foreground">{formatCurrency(invoice.totalNet)}</span></p>
                            <p>Paid: <span className="font-semibold text-foreground">{formatCurrency(invoice.totalPaid)}</span></p>
                            <p className={`sm:col-span-2 rounded p-2 ${hasRemainingAmount ? 'bg-yellow-300' : ''}`}>
                              Remaining: <span className="font-semibold text-foreground">{formatCurrency(displayedRemainingAmount)}</span>
                            </p>
                          </div>
                          {invoice.isEstimatedPaid ? (
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              Paid amount is estimated from invoice status because no payment entries are recorded yet.
                            </p>
                          ) : null}

                          {invoice.payments.length === 0 ? (
                            <p className="mt-2 text-xs text-muted-foreground">No payment entries yet for this invoice.</p>
                          ) : (
                            <div className="mt-2 space-y-1">
                              {invoice.payments.map((payment) => (
                                <div key={`patient-payment-entry-${invoice.id}-${payment.id}`} className="rounded-md border border-border/70 bg-muted/20 px-2 py-1.5">
                                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                    <p className="text-muted-foreground">{formatDisplayDate(payment.paymentDate)}</p>
                                    <p className="font-semibold text-foreground">{formatCurrency(parseAmount(payment.amount))}</p>
                                  </div>
                                  <p className="text-xs text-muted-foreground">Method: {payment.method || '-'}</p>
                                  {payment.notes ? (
                                    <p className="text-xs text-muted-foreground">Notes: {payment.notes}</p>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          )}

                          {invoice.notes ? (
                            <p className="mt-2 text-xs text-muted-foreground">Invoice Notes: {invoice.notes}</p>
                          ) : null}
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>

              <Card className="border-border bg-card text-card-foreground">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span>Dental Condition</span>
                    <HeartPulse className="size-4 text-primary" />
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-[120px_1fr]">
                  <div className="mx-auto flex size-28 items-center justify-center rounded-full border-4 border-primary bg-background">
                    <div className="text-center">
                      <p className="text-3xl font-bold">{conditionStats.overall}%</p>
                      <p className="text-xs text-muted-foreground">overall</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {conditionStats.entries.map((entry) => (
                      <div key={entry.key} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-foreground">{CONDITIONS[entry.key].label}</span>
                          <span className="text-muted-foreground">{entry.percent}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted">
                          <div
                            className="h-1.5 rounded-full"
                            style={{
                              backgroundColor: CONDITIONS[entry.key].color,
                              width: `${entry.percent}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border bg-card text-card-foreground">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span>Session Tasks</span>
                    <ClipboardCheck className="size-4 text-primary" />
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-2 md:grid-cols-2">
                    <Input
                      value={taskTitle}
                      onChange={(event) => {
                        setTaskTitle(event.target.value);
                      }}
                      placeholder="Task title"
                      className="bg-background"
                    />
                    <div className="rounded-md border border-input bg-background p-2">
                      <p className="mb-2 text-xs text-muted-foreground">Mark Color</p>
                      <div className="flex flex-wrap gap-2">
                        {TASK_MARKS.map((mark) => (
                          <button
                            key={mark.value}
                            type="button"
                            onClick={() => {
                              setTaskMark(mark.value);
                            }}
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs ${taskMark === mark.value ? 'border-primary' : 'border-border'}`}
                          >
                            <span className="size-2.5 rounded-full" style={{ backgroundColor: mark.color }} />
                            <span>{mark.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <textarea
                    value={taskNotes}
                    onChange={(event) => {
                      setTaskNotes(event.target.value);
                    }}
                    placeholder="Task notes"
                    className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={taskStatus}
                      onChange={(event) => {
                        setTaskStatus(event.target.value as SessionTaskStatus);
                      }}
                      className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                    >
                      <option value="pending">Pending</option>
                      <option value="in_progress">In Progress</option>
                      <option value="done">Done</option>
                    </select>
                    <Button
                      type="button"
                      onClick={() => {
                        void handleAddTask();
                      }}
                      disabled={!taskTitle.trim() || isTaskMutationLoading}
                      className="bg-primary text-primary-foreground hover:bg-accent hover:text-accent-foreground"
                    >
                      Add Task
                    </Button>
                  </div>
                  {taskError ? (
                    <p className="text-xs text-destructive">{taskError}</p>
                  ) : null}

                  <div className="space-y-2">
                    {isLoadingManualTasks ? (
                      <p className="text-sm text-muted-foreground">Loading tasks...</p>
                    ) : manualTasks.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No manual tasks added yet.</p>
                    ) : (
                      manualTasks.map((task) => (
                        <div key={task.id} className="rounded-lg border border-border bg-background p-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-foreground">{task.title}</p>
                              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                                <span
                                  className="size-2.5 rounded-full"
                                  style={{
                                    backgroundColor:
                                      TASK_MARKS.find((item) => item.value === task.mark)?.color
                                      || '#94a3b8',
                                  }}
                                />
                                <span>
                                  Mark:{' '}
                                  {TASK_MARKS.find((item) => item.value === task.mark)?.label
                                    || task.mark}
                                </span>
                              </p>
                              {task.notes ? (
                                <p className="mt-1 text-xs text-muted-foreground">{task.notes}</p>
                              ) : null}
                            </div>
                            <div className="flex items-center gap-2">
                              <select
                                value={task.status}
                                onChange={(event) => {
                                  void handleStatusChange(task.id, event.target.value as SessionTaskStatus);
                                }}
                                disabled={isTaskMutationLoading}
                                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                              >
                                <option value="pending">Pending</option>
                                <option value="in_progress">In Progress</option>
                                <option value="done">Done</option>
                              </select>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="size-8"
                                disabled={isTaskMutationLoading}
                                onClick={() => {
                                  void handleDeleteTask(task.id);
                                }}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border bg-card text-card-foreground">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span>Patient Visits</span>
                    <CalendarDays className="size-4 text-primary" />
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {orderedVisits.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No visits recorded yet.</p>
                  ) : (
                    orderedVisits.map((visit) => (
                      <button
                        key={visit.id}
                        type="button"
                        onClick={() => {
                          const encodedVisitId = encodeURIComponent(String(visit.id));
                          router.push(`/${locale}/dental-management/visits/chart?visitId=${encodedVisitId}`);
                        }}
                        className="w-full rounded-lg border border-border bg-background p-3 text-left transition hover:border-primary/40 hover:bg-accent/20"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-foreground">
                            {visit.tag || visit.appointmentTag || `Visit #${visit.id}`}
                          </p>
                          <p className="text-xs text-muted-foreground">{visit.visitDate || '-'}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Dentist: {visit.dentistName || visit.dentistId || '-'}
                        </p>
                        {visit.nextVisitDate ? (
                          <p className="text-xs text-muted-foreground">Next Visit: {visit.nextVisitDate}</p>
                        ) : null}
                        {visit.diagnosisNotes ? (
                          <p className="mt-1 text-xs text-muted-foreground">{visit.diagnosisNotes}</p>
                        ) : null}
                      </button>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="border-border bg-card text-card-foreground">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span>Details</span>
                    <UserRound className="size-4 text-primary" />
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
                  <p>Email: <span className="text-foreground">{patient?.email || '-'}</span></p>
                  <p>Address: <span className="text-foreground">{patient?.address || '-'}</span></p>
                  <p>Emergency: <span className="text-foreground">{patient?.emergencyContact || '-'}</span></p>
                  <p>Latest Visit: <span className="text-foreground">{latestVisit?.visitDate || '-'}</span></p>
                  <p>Status: <span className="text-foreground">{patient?.status || '-'}</span></p>
                  <p>Visit Count: <span className="text-foreground">{visits.length}</span></p>
                  <p>Treatments: <span className="text-foreground">{typedVisitTreatments.length}</span></p>
                  <p className="md:col-span-2">Remarks: <span className="text-foreground">{patient?.remarks || '-'}</span></p>
                </CardContent>
              </Card>
            </div>

            <Card className="border-border bg-card text-card-foreground">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-base">
                  <span>Dental Scheme</span>
                  <Stethoscope className="size-4 text-primary" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative mx-auto h-[360px] w-[360px] max-w-full">
                  {RING_TEETH.map((toothNumber, index) => {
                    const angle = (index / RING_TEETH.length) * Math.PI * 2 - Math.PI / 2;
                    const markerRadius = 38;
                    const labelRadius = 47;
                    const markerX = 50 + markerRadius * Math.cos(angle);
                    const markerY = 50 + markerRadius * Math.sin(angle);
                    const labelX = 50 + labelRadius * Math.cos(angle);
                    const labelY = 50 + labelRadius * Math.sin(angle);
                    const condition = toothConditionMap[toothNumber];

                    return (
                      <div key={toothNumber}>
                        <div
                          className="absolute size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border shadow-sm"
                          style={{
                            backgroundColor: condition ? CONDITIONS[condition].color : '#d6ccc2',
                            borderColor: condition ? CONDITIONS[condition].color : '#c6ac8f',
                            left: `${markerX}%`,
                            top: `${markerY}%`,
                          }}
                        />
                        <span
                          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 text-[10px] font-semibold text-muted-foreground"
                          style={{
                            left: `${labelX}%`,
                            top: `${labelY}%`,
                          }}
                        >
                          {toothNumber}
                        </span>
                      </div>
                    );
                  })}

                  <div className="absolute left-1/2 top-1/2 flex size-28 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border border-border bg-background">
                    <Sparkles className="size-5 text-primary" />
                    <p className="mt-1 text-xs text-muted-foreground">Teeth Map</p>
                    <p className="text-sm font-semibold text-foreground">{RING_TEETH.length} teeth</p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  {Object.entries(CONDITIONS).map(([key, condition]) => (
                    <div key={key} className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5">
                      <span
                        className="size-2.5 rounded-full"
                        style={{ backgroundColor: condition.color }}
                      />
                      <span className="text-foreground">{condition.label}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  {isLoadingTreatments ? (
                    <span>Loading treatment chart...</span>
                  ) : (
                    <span>{typedVisitTreatments.length} recorded treatment entries</span>
                  )}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
