'use client';

import { JSX, useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Header } from '@/components/header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AxiosClient } from '@/modules/common/infrastructure/api/axios-client';
import { type Appointment } from '@/modules/dental-management/domain/entities/Appointment';
import { type Patient } from '@/modules/dental-management/domain/entities/Patient';
import { type Visit } from '@/modules/dental-management/domain/entities/Visit';
import { type VisitTreatment } from '@/modules/dental-management/domain/entities/VisitTreatment';
import {
  useAppointmentList,
  useInvoiceList,
  usePatientList,
  useVisitList,
  useVisitTreatmentList,
} from '@/modules/dental-management/presentation/hooks';
import {
  aggregateImplantSupplierBalances,
  type ImplantAvailabilityStatus,
  type ImplantSupplierTaskLike,
} from '@/modules/dental-management/presentation/utils/implant-supplier-analytics';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type ReportGranularity = 'day' | 'month' | 'year';
type InvoiceStatusFilter = 'all' | 'cancelled' | 'paid' | 'partially_paid' | 'unpaid';

type ParsedPayment = {
  amount: number;
  amountInput: number;
  currency: string;
  date: string;
  exchangeRate: number;
  invoiceId: string;
  method: string;
};

type ParsedInvoice = {
  date: string;
  debt: number;
  discount: number;
  discountInput: number;
  exchangeRate: number;
  id: string;
  net: number;
  netInput: number;
  paid: number;
  patientId: string;
  status: string;
  total: number;
  totalInput: number;
  currency: string;
  visitId: string;
};

type TrendPoint = {
  income: number;
  key: string;
  label: string;
  paymentCount: number;
};

type CashFlowPoint = {
  billed: number;
  debt: number;
  discount: number;
  key: string;
  label: string;
  net: number;
  paid: number;
};

type ProfitLossPoint = {
  income: number;
  key: string;
  label: string;
  outcome: number;
  profit: number;
};

type DebtAgingPoint = {
  amount: number;
  bucket: string;
};

const DEBT_AGING_BUCKETS = ['0-30 days', '31-60 days', '61-90 days', '90+ days'] as const;
type DebtAgingBucket = (typeof DEBT_AGING_BUCKETS)[number];

type TreatmentVolumePoint = {
  name: string;
  revenue: number;
  sessions: number;
};

type DentistProductivityPoint = {
  dentist: string;
  revenue: number;
  visits: number;
};

type PaymentMethodPoint = {
  amount: number;
  count: number;
  method: string;
};

type LedgerEntry = {
  balance: number;
  credit: number;
  date: string;
  debit: number;
  invoiceId: string;
  label: string;
  method: string;
  patientId: string;
  type: 'invoice' | 'payment';
};

type SnapshotCadence = 'daily' | 'monthly' | 'off' | 'weekly';

type SnapshotRecord = {
  activePatients: number;
  appointmentCompletionRate: number;
  appointments: number;
  billed: number;
  collectionRate: number;
  debt: number;
  discount: number;
  generatedAt: string;
  granularity: ReportGranularity;
  id: string;
  net: number;
  paid: number;
  rangeEnd: string;
  rangeStart: string;
  statusFilter: InvoiceStatusFilter;
  visits: number;
};

type ExpensePoint = {
  amount: number;
  category: string;
};

type ExpenseRow = {
  amount: number;
  amountInput: number;
  category: string;
  currency: string;
  exchangeRate: number;
  expenseDate: string;
  expenseType: string;
  id: string;
};

type SafeTransactionRow = {
  amount: number;
  amountInput: number;
  currency: string;
  direction: string;
  exchangeRate: number;
  entryType: string;
  id: string;
  notes: string;
  pickedByStaffId: string;
  pickedByStaffName: string;
  transactionDate: string;
};

type SalaryPaymentRow = {
  currency: string;
  exchangeRate: number;
  id: string;
  netAmount: number;
  netAmountInput: number;
  paymentDate: string;
  staffId: string;
  staffName: string;
  status: string;
};

type ThirdCompanyLiabilityStatusPoint = {
  count: number;
  label: string;
  status: ImplantAvailabilityStatus;
  unpaid: number;
};

type PaginatedRowsResponse = {
  data?: Array<Record<string, unknown>>;
  meta?: {
    currentPage?: number;
    lastPage?: number;
  };
};

const MAX_PER_PAGE = 100;
const MS_PER_DAY = 1000 * 60 * 60 * 24;
const REPORT_SNAPSHOT_KEY = 'dental_reports_snapshots';
const REPORT_SCHEDULE_KEY = 'dental_reports_schedule';
const apiClient = new AxiosClient();

const parseAmount = (value: unknown): number => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

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

const toInputDate = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDate = (value?: string): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    currency: 'AFN',
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
    style: 'currency',
  }).format(value);
};

const formatShortDate = (value?: string): string => {
  const parsed = parseDate(value);
  if (!parsed) return '-';
  return new Intl.DateTimeFormat('en-US', { day: '2-digit', month: 'short' }).format(parsed);
};

const formatFullDate = (value?: string): string => {
  const parsed = parseDate(value);
  if (!parsed) return '-';
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(parsed);
};

const formatDateTime = (value?: string): string => {
  const parsed = parseDate(value);
  if (!parsed) return '-';
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed);
};

const toHumanLabel = (value: string): string => value
  .replaceAll('_', ' ')
  .replace(/\b\w/g, (char) => char.toUpperCase());

const escapeHtml = (value: unknown): string => {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
};

const toBucket = (date: Date, granularity: ReportGranularity): { key: string; label: string; sort: number } => {
  if (granularity === 'month') {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return {
      key: `${year}-${month}`,
      label: new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(date),
      sort: new Date(year, date.getMonth(), 1).getTime(),
    };
  }

  if (granularity === 'year') {
    const year = date.getFullYear();
    return {
      key: String(year),
      label: String(year),
      sort: new Date(year, 0, 1).getTime(),
    };
  }

  return {
    key: toInputDate(date),
    label: formatShortDate(toInputDate(date)),
    sort: new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime(),
  };
};

const toCsv = (rows: Array<Record<string, string | number>>): string => {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const escape = (value: string | number): string => {
    const raw = String(value ?? '');
    if (raw.includes(',') || raw.includes('"') || raw.includes('\n')) {
      return `"${raw.replace(/"/g, '""')}"`;
    }
    return raw;
  };

  return [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => escape(row[header] ?? '')).join(',')),
  ].join('\n');
};

const downloadCsv = (filename: string, rows: Array<Record<string, string | number>>): void => {
  const csv = toCsv(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const inRange = (value: string, startDate: string, endDate: string): boolean => {
  const parsed = parseDate(value);
  if (!parsed) return false;
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (!start || !end) return true;
  return parsed.getTime() >= start.getTime() && parsed.getTime() <= end.getTime() + MS_PER_DAY - 1;
};

const isImplantAvailabilityStatus = (value: string): value is ImplantAvailabilityStatus => (
  value === 'not_available' || value === 'in_purchase' || value === 'available' || value === 'done'
);

const isDebtAgingBucket = (value: string): value is DebtAgingBucket => (
  DEBT_AGING_BUCKETS.includes(value as DebtAgingBucket)
);

const toDebtAgingBucket = (invoiceDate: string, endDate: string): DebtAgingBucket | null => {
  const end = parseDate(endDate);
  const date = parseDate(invoiceDate);
  if (!end || !date) return null;
  const ageDays = Math.max(0, Math.floor((end.getTime() - date.getTime()) / MS_PER_DAY));
  if (ageDays <= 30) return '0-30 days';
  if (ageDays <= 60) return '31-60 days';
  if (ageDays <= 90) return '61-90 days';
  return '90+ days';
};

const fetchAllRows = async (
  endpoint: string,
  params: Record<string, unknown>
): Promise<Array<Record<string, unknown>>> => {
  const rows: Array<Record<string, unknown>> = [];
  let page = 1;

  while (true) {
    const response = await apiClient.get<PaginatedRowsResponse>(endpoint, {
      params: {
        ...params,
        page,
        perPage: MAX_PER_PAGE,
      },
    });
    const payload = response.data;
    const pageRows = Array.isArray(payload?.data) ? payload.data : [];
    rows.push(...pageRows);

    const currentPage = Number(payload?.meta?.currentPage ?? page);
    const lastPage = Number(payload?.meta?.lastPage ?? currentPage);
    if (pageRows.length === 0 || currentPage >= lastPage) {
      break;
    }

    page += 1;
  }

  return rows;
};

const fetchPatientSessionTasks = async (patientIds: string[]): Promise<ImplantSupplierTaskLike[]> => {
  if (patientIds.length === 0) return [];

  const rows: ImplantSupplierTaskLike[] = [];
  const batchSize = 15;

  for (let index = 0; index < patientIds.length; index += batchSize) {
    const batch = patientIds.slice(index, index + batchSize);
    const batchResponses = await Promise.all(
      batch.map(async (patientId) => {
        const response = await apiClient.get<Array<Record<string, unknown>>>(
          `/api/v1/dental-management/patients/${patientId}/session-tasks`
        );
        if (!response.success || !Array.isArray(response.data)) {
          return [] as ImplantSupplierTaskLike[];
        }

        return response.data.map((task) => ({
          createdAt: asText(task.createdAt ?? task.created_at),
          id: asText(task.id),
          notes: asText(task.notes),
          patientId,
          status: asText(task.status),
          title: asText(task.title),
        }));
      })
    );

    batchResponses.forEach((batchRows) => {
      rows.push(...batchRows);
    });
  }

  return rows;
};

// eslint-disable-next-line react/function-component-definition
export default function ReportsPage(): JSX.Element {
  const locale = useLocale();
  const isRtl = locale === 'ps' || locale === 'dr';
  const tSidebar = useTranslations('sidebar');
  const tReportsPage = useTranslations('app.reportsPage');
  const ninetyDaysAgo = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - 90);
    return toInputDate(date);
  }, []);
  const today = useMemo(() => toInputDate(new Date()), []);

  const [startDate, setStartDate] = useState(ninetyDaysAgo);
  const [endDate, setEndDate] = useState(today);
  const [granularity, setGranularity] = useState<ReportGranularity>('day');
  const [statusFilter, setStatusFilter] = useState<InvoiceStatusFilter>('all');
  const [showAdvancedControls, setShowAdvancedControls] = useState(false);
  const [activeTab, setActiveTab] = useState<'clinical' | 'financial' | 'operations' | 'overview'>('overview');
  const [selectedPatientLedgerId, setSelectedPatientLedgerId] = useState<string>('all');
  const [selectedThirdCompanyAvailability, setSelectedThirdCompanyAvailability] = useState<ImplantAvailabilityStatus | 'all'>('all');
  const [selectedDebtAgingBucket, setSelectedDebtAgingBucket] = useState<DebtAgingBucket | 'all'>('all');
  const [snapshotCadence, setSnapshotCadence] = useState<SnapshotCadence>(() => {
    if (typeof window === 'undefined') return 'off';
    const raw = window.localStorage.getItem(REPORT_SCHEDULE_KEY);
    return raw === 'daily' || raw === 'weekly' || raw === 'monthly' || raw === 'off' ? raw : 'off';
  });
  const [snapshotRecords, setSnapshotRecords] = useState<SnapshotRecord[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem(REPORT_SNAPSHOT_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as SnapshotRecord[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [lastSnapshotRunAt, setLastSnapshotRunAt] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return window.localStorage.getItem(`${REPORT_SCHEDULE_KEY}_last_run`) || '';
  });
  const [expenseRows, setExpenseRows] = useState<ExpenseRow[]>([]);
  const [safeRows, setSafeRows] = useState<SafeTransactionRow[]>([]);
  const [salaryRows, setSalaryRows] = useState<SalaryPaymentRow[]>([]);
  const [implantSupplierTasks, setImplantSupplierTasks] = useState<ImplantSupplierTaskLike[]>([]);
  const [allPatientNameRows, setAllPatientNameRows] = useState<Record<string, string>>({});
  const [isLoadingFinanceData, setIsLoadingFinanceData] = useState(false);
  const granularityLabel = useMemo(() => {
    if (granularity === 'year') return tReportsPage('granularity.year');
    if (granularity === 'month') return tReportsPage('granularity.month');
    return tReportsPage('granularity.day');
  }, [granularity, tReportsPage]);

  const { entities: patients, isFetching: isLoadingPatients } = usePatientList(1, MAX_PER_PAGE);
  const { entities: appointments, isFetching: isLoadingAppointments } = useAppointmentList(
    1,
    MAX_PER_PAGE,
    '',
    [],
    ['patient', 'dentist'],
    {}
  );
  const { entities: visits, isFetching: isLoadingVisits } = useVisitList(
    1,
    MAX_PER_PAGE,
    '',
    [],
    ['patient', 'dentist'],
    {}
  );
  const { entities: invoices, isFetching: isLoadingInvoices } = useInvoiceList(
    1,
    MAX_PER_PAGE,
    '',
    [],
    ['patient', 'visit', 'payments'],
    {}
  );
  const { entities: visitTreatments, isFetching: isLoadingVisitTreatments } = useVisitTreatmentList(
    1,
    MAX_PER_PAGE,
    '',
    [],
    ['treatment', 'visit'],
    {}
  );

  const typedPatients = patients as Patient[];
  const typedAppointments = appointments as Appointment[];
  const typedVisits = visits as Visit[];
  const typedVisitTreatments = visitTreatments as Array<VisitTreatment & {
    treatment?: { name?: string };
    visit?: { dentistName?: string; visitDate?: string };
  }>;
  const patientNameById = useMemo(() => {
    const map = new Map<string, string>();
    typedPatients.forEach((patient) => {
      const fullName = [patient.firstName, patient.lastName].filter(Boolean).join(' ').trim();
      map.set(String(patient.id), fullName || patient.patientCode || `Patient #${patient.id}`);
    });
    return map;
  }, [typedPatients]);
  const mergedPatientNameById = useMemo(() => {
    const merged = new Map(patientNameById);
    Object.entries(allPatientNameRows).forEach(([id, name]) => {
      if (!merged.has(id)) {
        merged.set(id, name);
      }
    });
    return merged;
  }, [allPatientNameRows, patientNameById]);

  const fetchFinanceData = useCallback(async (): Promise<void> => {
    setIsLoadingFinanceData(true);
    try {
      const [expenseItems, safeItems, salaryItems, patientItems] = await Promise.all([
        fetchAllRows('/api/v1/dental-management/expenses', {
          include: ['staff'],
          sortBy: 'expenseDate',
          sortDirection: 'desc',
        }),
        fetchAllRows('/api/v1/dental-management/safe-transactions', {
          include: ['pickedByStaff'],
          sortBy: 'transactionDate',
          sortDirection: 'desc',
        }),
        fetchAllRows('/api/v1/dental-management/salary-payments', {
          include: ['staff'],
          sortBy: 'paymentDate',
          sortDirection: 'desc',
        }),
        fetchAllRows('/api/v1/dental-management/patients', {
          sortBy: 'createdAt',
          sortDirection: 'desc',
        }),
      ]);

      const patientNameMap: Record<string, string> = {};
      const patientIds = patientItems
        .map((row) => {
          const patientId = asText(row.id);
          if (!patientId) return '';
          const firstName = asText(row.firstName ?? row.first_name);
          const lastName = asText(row.lastName ?? row.last_name);
          const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
          patientNameMap[patientId] = fullName || asText(row.patientCode ?? row.patient_code) || `Patient #${patientId}`;
          return patientId;
        })
        .filter(Boolean);

      const sessionTasks = await fetchPatientSessionTasks(patientIds);
      setImplantSupplierTasks(sessionTasks);
      setAllPatientNameRows(patientNameMap);

      setExpenseRows(expenseItems.map((row) => ({
        amount: parseAmount(row.amount),
        amountInput: parseAmount(row.amountInput ?? row.amount_input ?? row.amount),
        category: asText(row.category) || 'Other',
        currency: 'AFN',
        exchangeRate: parseAmount(row.exchangeRate ?? row.exchange_rate ?? 1) || 1,
        expenseDate: asText(row.expenseDate ?? row.expense_date),
        expenseType: asText(row.expenseType ?? row.expense_type) || 'daily',
        id: asText(row.id),
      })));
      setSafeRows(safeItems.map((row) => {
        const pickedBy = row.pickedByStaff as Record<string, unknown> | undefined;
        const pickedByName = pickedBy
          ? [asText(pickedBy.firstName ?? pickedBy.first_name), asText(pickedBy.lastName ?? pickedBy.last_name)]
            .filter(Boolean)
            .join(' ')
          : '';
        return {
          amount: parseAmount(row.amount),
          amountInput: parseAmount(row.amountInput ?? row.amount_input ?? row.amount),
          currency: 'AFN',
          direction: asText(row.direction),
          entryType: asText(row.entryType ?? row.entry_type),
          exchangeRate: parseAmount(row.exchangeRate ?? row.exchange_rate ?? 1) || 1,
          id: asText(row.id),
          notes: asText(row.notes),
          pickedByStaffId: asText(row.pickedByStaffId ?? row.picked_by_staff_id),
          pickedByStaffName: pickedByName || asText(pickedBy?.fullName ?? pickedBy?.name),
          transactionDate: asText(row.transactionDate ?? row.transaction_date),
        };
      }));
      setSalaryRows(salaryItems.map((row) => {
        const staff = row.staff as Record<string, unknown> | undefined;
        const staffName = staff
          ? [asText(staff.firstName ?? staff.first_name), asText(staff.lastName ?? staff.last_name)]
            .filter(Boolean)
            .join(' ')
          : '';
        return {
          currency: 'AFN',
          exchangeRate: parseAmount(row.exchangeRate ?? row.exchange_rate ?? 1) || 1,
          id: asText(row.id),
          netAmount: parseAmount(row.netAmount ?? row.net_amount),
          netAmountInput: parseAmount(row.netAmountInput ?? row.net_amount_input ?? row.netAmount ?? row.net_amount),
          paymentDate: asText(row.paymentDate ?? row.payment_date),
          staffId: asText(row.staffId ?? row.staff_id),
          staffName: staffName || asText(staff?.fullName ?? staff?.name),
          status: asText(row.status) || 'pending',
        };
      }));
    } finally {
      setIsLoadingFinanceData(false);
    }
  }, []);

  useEffect(() => {
    void fetchFinanceData();
  }, [fetchFinanceData]);

  const filteredDailyExpenses = useMemo(
    () => expenseRows.filter((item) => item.expenseType === 'daily' && inRange(item.expenseDate, startDate, endDate)),
    [endDate, expenseRows, startDate]
  );
  const filteredClinicalExpenses = useMemo(
    () => expenseRows.filter((item) => item.expenseType === 'clinical' && inRange(item.expenseDate, startDate, endDate)),
    [endDate, expenseRows, startDate]
  );
  const expenseSummary = useMemo(() => {
    const daily = Number(
      filteredDailyExpenses.reduce((sum, item) => sum + parseAmount(item.amount), 0).toFixed(2)
    );
    const clinical = Number(
      filteredClinicalExpenses.reduce((sum, item) => sum + parseAmount(item.amount), 0).toFixed(2)
    );
    const byCategory = new Map<string, number>();

    filteredDailyExpenses.forEach((item) => {
      const category = asText(item.category) || 'Daily - Other';
      byCategory.set(category, Number(((byCategory.get(category) ?? 0) + parseAmount(item.amount)).toFixed(2)));
    });

    filteredClinicalExpenses.forEach((item) => {
      const baseCategory = asText(item.category) || 'Other';
      const category = `Clinical - ${baseCategory}`;
      byCategory.set(category, Number(((byCategory.get(category) ?? 0) + parseAmount(item.amount)).toFixed(2)));
    });

    const categoryRows: ExpensePoint[] = [...byCategory.entries()]
      .map(([category, amount]) => ({ amount, category }))
      .sort((left, right) => right.amount - left.amount)
      .slice(0, 12);

    return {
      byCategory: categoryRows,
      clinical,
      daily,
      total: Number((daily + clinical).toFixed(2)),
    };
  }, [filteredClinicalExpenses, filteredDailyExpenses]);
  const safePickups = useMemo(() => {
    const grouped = new Map<string, number>();
    safeRows.forEach((row) => {
      if (row.direction !== 'out') return;
      if (!inRange(row.transactionDate, startDate, endDate)) return;
      const person = row.pickedByStaffName || `Staff #${row.pickedByStaffId || '-'}`;
      grouped.set(person, Number(((grouped.get(person) ?? 0) + row.amount).toFixed(2)));
    });

    return [...grouped.entries()]
      .map(([name, amount]) => ({ amount, name }))
      .sort((left, right) => right.amount - left.amount)
      .slice(0, 12);
  }, [endDate, safeRows, startDate]);
  const salarySummary = useMemo(() => {
    const filtered = salaryRows.filter((row) => inRange(row.paymentDate, startDate, endDate));
    const paid = Number(filtered
      .filter((row) => row.status === 'paid' || row.status === 'partial')
      .reduce((sum, row) => sum + row.netAmount, 0)
      .toFixed(2));

    return {
      paid,
      records: filtered.length,
    };
  }, [endDate, salaryRows, startDate]);
  const filteredImplantSupplierTasks = useMemo(
    () =>
      implantSupplierTasks.filter((task) => {
        const createdAt = asText(task.createdAt);
        if (!createdAt) return true;
        return inRange(createdAt, startDate, endDate);
      }),
    [endDate, implantSupplierTasks, startDate]
  );
  const thirdCompanySummary = useMemo(
    () => aggregateImplantSupplierBalances(filteredImplantSupplierTasks),
    [filteredImplantSupplierTasks]
  );
  const thirdCompanyStatusChart = useMemo<ThirdCompanyLiabilityStatusPoint[]>(() => {
    const statusLabels: Record<ImplantAvailabilityStatus, string> = {
      available: 'Available',
      done: 'Done',
      in_purchase: 'In Purchase',
      not_available: 'Not Available',
    };

    return (['not_available', 'in_purchase', 'available', 'done'] as ImplantAvailabilityStatus[]).map((status) => ({
      count: thirdCompanySummary.byAvailability[status].count,
      label: statusLabels[status],
      status,
      unpaid: thirdCompanySummary.byAvailability[status].unpaid,
    }));
  }, [thirdCompanySummary.byAvailability]);
  const thirdCompanyUnpaidRows = useMemo(() => {
    const rows = selectedThirdCompanyAvailability === 'all'
      ? thirdCompanySummary.unpaidRows
      : thirdCompanySummary.unpaidRows.filter((row) => row.availability === selectedThirdCompanyAvailability);
    return rows.slice(0, 100);
  }, [selectedThirdCompanyAvailability, thirdCompanySummary.unpaidRows]);

  const parsedData = useMemo(() => {
    const allPayments: ParsedPayment[] = [];
    const allInvoices: ParsedInvoice[] = [];
    const ledgerEvents: Array<Omit<LedgerEntry, 'balance'>> = [];

    for (const invoiceRow of invoices as Array<Record<string, unknown>>) {
      const invoiceId = asText(invoiceRow.id);
      const invoiceDate = asText(invoiceRow.invoiceDate ?? invoiceRow.invoice_date);
      const status = asText(invoiceRow.status).toLowerCase();
      const patientId = asText(invoiceRow.patientId ?? invoiceRow.patient_id);
      const visitId = asText(invoiceRow.visitId ?? invoiceRow.visit_id);
      const currency = 'AFN';
      const exchangeRate = parseAmount(invoiceRow.exchangeRate ?? invoiceRow.exchange_rate ?? 1) || 1;
      const total = parseAmount(invoiceRow.totalAmount ?? invoiceRow.total_amount);
      const totalInput = parseAmount(invoiceRow.totalAmountInput ?? invoiceRow.total_amount_input ?? invoiceRow.totalAmount ?? invoiceRow.total_amount);
      const discount = parseAmount(invoiceRow.discount);
      const discountInput = parseAmount(invoiceRow.discountInput ?? invoiceRow.discount_input ?? invoiceRow.discount);
      const net = parseAmount(invoiceRow.netAmount ?? invoiceRow.net_amount);
      const netInput = parseAmount(invoiceRow.netAmountInput ?? invoiceRow.net_amount_input ?? invoiceRow.netAmount ?? invoiceRow.net_amount);
      const rawPayments = Array.isArray(invoiceRow.payments) ? invoiceRow.payments : [];
      ledgerEvents.push({
        credit: 0,
        date: invoiceDate,
        debit: net,
        invoiceId,
        label: `Invoice #${invoiceId} issued`,
        method: '-',
        patientId,
        type: 'invoice',
      });

      const invoicePayments: ParsedPayment[] = rawPayments
        .map((payment) => {
          if (!payment || typeof payment !== 'object') return null;
          const paymentRow = payment as Record<string, unknown>;
          return {
            amount: parseAmount(paymentRow.amount),
            amountInput: parseAmount(paymentRow.amountInput ?? paymentRow.amount_input ?? paymentRow.amount),
            currency,
            date: asText(paymentRow.paymentDate ?? paymentRow.payment_date) || invoiceDate,
            exchangeRate: parseAmount(paymentRow.exchangeRate ?? paymentRow.exchange_rate ?? exchangeRate) || exchangeRate,
            invoiceId,
            method: asText(paymentRow.method).toLowerCase() || 'cash',
          };
        })
        .filter((payment): payment is ParsedPayment => payment !== null && payment.amount > 0);

      if (invoicePayments.length === 0 && status === 'paid' && net > 0) {
        invoicePayments.push({
          amount: net,
          amountInput: netInput,
          currency,
          date: invoiceDate,
          exchangeRate,
          invoiceId,
          method: 'status_derived',
        });
      }

      const paid = Number(invoicePayments.reduce((sum, payment) => sum + payment.amount, 0).toFixed(2));
      const debt = Math.max(0, Number((net - paid).toFixed(2)));

      allInvoices.push({
        currency,
        date: invoiceDate,
        debt,
        discount,
        discountInput,
        exchangeRate,
        id: invoiceId,
        net,
        netInput,
        paid,
        patientId,
        status,
        total,
        totalInput,
        visitId,
      });

      allPayments.push(...invoicePayments);
      invoicePayments.forEach((payment) => {
        ledgerEvents.push({
          credit: payment.amount,
          date: payment.date,
          debit: 0,
          invoiceId,
          label: `Payment for invoice #${invoiceId}`,
          method: payment.method,
          patientId,
          type: 'payment',
        });
      });
    }

    const sortedLedgerEvents = ledgerEvents
      .slice()
      .sort((left, right) => {
        const leftDate = parseDate(left.date)?.getTime() ?? 0;
        const rightDate = parseDate(right.date)?.getTime() ?? 0;
        if (leftDate !== rightDate) return leftDate - rightDate;
        if (left.type !== right.type) {
          return left.type === 'invoice' ? -1 : 1;
        }
        return left.invoiceId.localeCompare(right.invoiceId, undefined, { numeric: true, sensitivity: 'base' });
      });

    const ledgerEntries = sortedLedgerEvents.reduce<LedgerEntry[]>((entries, event) => {
      const previousBalance = entries.length > 0 ? entries[entries.length - 1].balance : 0;
      const balance = Number((previousBalance + event.debit - event.credit).toFixed(2));
      entries.push({
        ...event,
        balance,
      });
      return entries;
    }, []);

    return { allInvoices, allPayments, ledgerEntries };
  }, [invoices]);

  const filteredInvoices = useMemo(() => {
    return parsedData.allInvoices.filter((invoice) => {
      if (statusFilter !== 'all' && invoice.status !== statusFilter) return false;
      return inRange(invoice.date, startDate, endDate);
    });
  }, [endDate, parsedData.allInvoices, startDate, statusFilter]);

  const filteredPayments = useMemo(() => {
    return parsedData.allPayments.filter((payment) => inRange(payment.date, startDate, endDate));
  }, [endDate, parsedData.allPayments, startDate]);

  const filteredAppointments = useMemo(
    () => typedAppointments.filter((item) => inRange(item.appointmentDate, startDate, endDate)),
    [endDate, startDate, typedAppointments]
  );
  const filteredVisits = useMemo(
    () => typedVisits.filter((item) => inRange(item.visitDate, startDate, endDate)),
    [endDate, startDate, typedVisits]
  );
  const filteredVisitTreatments = useMemo(
    () =>
      typedVisitTreatments.filter((item) => {
        const date = item.visit?.visitDate || item.createdAt;
        return inRange(date, startDate, endDate);
      }),
    [endDate, startDate, typedVisitTreatments]
  );

  const kpis = useMemo(() => {
    const billed = Number(filteredInvoices.reduce((sum, invoice) => sum + invoice.total, 0).toFixed(2));
    const discount = Number(filteredInvoices.reduce((sum, invoice) => sum + invoice.discount, 0).toFixed(2));
    const net = Number(filteredInvoices.reduce((sum, invoice) => sum + invoice.net, 0).toFixed(2));
    const paid = Number(filteredInvoices.reduce((sum, invoice) => sum + invoice.paid, 0).toFixed(2));
    const debt = Number(filteredInvoices.reduce((sum, invoice) => sum + invoice.debt, 0).toFixed(2));

    const activePatientIds = new Set<string>();
    filteredVisits.forEach((visit) => {
      if (visit.patientId) activePatientIds.add(String(visit.patientId));
    });
    filteredInvoices.forEach((invoice) => {
      if (invoice.patientId) activePatientIds.add(String(invoice.patientId));
    });

    const appointmentCompletionRate = filteredAppointments.length > 0
      ? Number(Math.min(100, (filteredVisits.length / filteredAppointments.length) * 100).toFixed(1))
      : 0;
    const collectionRate = net > 0 ? Number(Math.min(100, (paid / net) * 100).toFixed(1)) : 0;
    const expenses = expenseSummary.total;
    const netAfterExpenses = Number((paid - expenses).toFixed(2));
    const safeOut = Number(
      safeRows
        .filter((row) => row.direction === 'out' && inRange(row.transactionDate, startDate, endDate))
        .reduce((sum, row) => sum + row.amount, 0)
        .toFixed(2)
    );

    return {
      activePatients: activePatientIds.size,
      appointmentCompletionRate,
      appointments: filteredAppointments.length,
      billed,
      collectionRate,
      debt,
      discount,
      expenses,
      net,
      netAfterExpenses,
      paid,
      safeOut,
      salaryPaid: salarySummary.paid,
      thirdCompanyPaid: thirdCompanySummary.totalPaid,
      thirdCompanyTotal: thirdCompanySummary.totalSupplierCost,
      thirdCompanyUnpaid: thirdCompanySummary.totalUnpaid,
      thirdCompanyUnpaidCount: thirdCompanySummary.unpaidCount,
      totalPatients: typedPatients.length,
      visits: filteredVisits.length,
    };
  }, [
    endDate,
    expenseSummary.total,
    filteredAppointments,
    filteredInvoices,
    filteredVisits,
    safeRows,
    salarySummary.paid,
    startDate,
    thirdCompanySummary.totalPaid,
    thirdCompanySummary.totalSupplierCost,
    thirdCompanySummary.totalUnpaid,
    thirdCompanySummary.unpaidCount,
    typedPatients.length,
  ]);

  const totalOutcome = useMemo(
    () => Number((kpis.expenses + kpis.salaryPaid + kpis.thirdCompanyPaid).toFixed(2)),
    [kpis.expenses, kpis.salaryPaid, kpis.thirdCompanyPaid]
  );
  const profitOrLoss = useMemo(
    () => Number((kpis.paid - totalOutcome).toFixed(2)),
    [kpis.paid, totalOutcome]
  );

  const incomeTrend = useMemo<TrendPoint[]>(() => {
    const buckets = new Map<string, { income: number; label: string; paymentCount: number; sort: number }>();

    filteredPayments.forEach((payment) => {
      const parsed = parseDate(payment.date);
      if (!parsed) return;
      const bucket = toBucket(parsed, granularity);
      const current = buckets.get(bucket.key) ?? { income: 0, label: bucket.label, paymentCount: 0, sort: bucket.sort };
      current.income = Number((current.income + payment.amount).toFixed(2));
      current.paymentCount += 1;
      buckets.set(bucket.key, current);
    });

    return [...buckets.entries()]
      .map(([key, value]) => ({ income: value.income, key, label: value.label, paymentCount: value.paymentCount, sort: value.sort }))
      .sort((left, right) => left.sort - right.sort)
      .map((item) => ({
        income: item.income,
        key: item.key,
        label: item.label,
        paymentCount: item.paymentCount,
      }));
  }, [filteredPayments, granularity]);

  const debtAging = useMemo<DebtAgingPoint[]>(() => {
    const buckets: Record<DebtAgingBucket, number> = {
      '0-30 days': 0,
      '31-60 days': 0,
      '61-90 days': 0,
      '90+ days': 0,
    };

    filteredInvoices.forEach((invoice) => {
      if (invoice.debt <= 0) return;
      const bucket = toDebtAgingBucket(invoice.date, endDate);
      if (!bucket) return;
      buckets[bucket] += invoice.debt;
    });

    return Object.entries(buckets).map(([bucket, amount]) => ({
      amount: Number(amount.toFixed(2)),
      bucket,
    }));
  }, [endDate, filteredInvoices]);

  const treatmentVolume = useMemo<TreatmentVolumePoint[]>(() => {
    const grouped = new Map<string, TreatmentVolumePoint>();
    filteredVisitTreatments.forEach((row) => {
      const name = row.treatment?.name || `Treatment ${row.treatmentId}`;
      const current = grouped.get(name) ?? { name, revenue: 0, sessions: 0 };
      current.sessions += 1;
      current.revenue = Number((current.revenue + parseAmount(row.price)).toFixed(2));
      grouped.set(name, current);
    });

    return [...grouped.values()]
      .sort((left, right) => right.revenue - left.revenue || right.sessions - left.sessions)
      .slice(0, 12);
  }, [filteredVisitTreatments]);

  const dentistProductivity = useMemo<DentistProductivityPoint[]>(() => {
    const revenueByVisit = new Map<string, number>();
    filteredInvoices.forEach((invoice) => {
      if (!invoice.visitId) return;
      revenueByVisit.set(invoice.visitId, (revenueByVisit.get(invoice.visitId) ?? 0) + invoice.net);
    });

    const grouped = new Map<string, DentistProductivityPoint>();
    filteredVisits.forEach((visit) => {
      const dentist = visit.dentistName || `Dentist #${visit.dentistId || '-'}`;
      const current = grouped.get(dentist) ?? { dentist, revenue: 0, visits: 0 };
      current.visits += 1;
      current.revenue = Number((current.revenue + (revenueByVisit.get(String(visit.id)) ?? 0)).toFixed(2));
      grouped.set(dentist, current);
    });

    return [...grouped.values()]
      .sort((left, right) => right.revenue - left.revenue || right.visits - left.visits)
      .slice(0, 12);
  }, [filteredInvoices, filteredVisits]);

  const appointmentStatus = useMemo(() => {
    const grouped = new Map<string, number>();
    filteredAppointments.forEach((appointment) => {
      const status = (appointment.status || 'scheduled').toLowerCase();
      grouped.set(status, (grouped.get(status) ?? 0) + 1);
    });
    return [...grouped.entries()]
      .map(([status, count]) => ({ count, status }))
      .sort((left, right) => right.count - left.count);
  }, [filteredAppointments]);

  const cashFlowTrend = useMemo<CashFlowPoint[]>(() => {
    const buckets = new Map<string, CashFlowPoint>();

    filteredInvoices.forEach((invoice) => {
      const date = parseDate(invoice.date);
      if (!date) return;
      const bucket = toBucket(date, granularity);
      const current = buckets.get(bucket.key) ?? {
        billed: 0,
        debt: 0,
        discount: 0,
        key: bucket.key,
        label: bucket.label,
        net: 0,
        paid: 0,
      };
      current.billed = Number((current.billed + invoice.total).toFixed(2));
      current.discount = Number((current.discount + invoice.discount).toFixed(2));
      current.net = Number((current.net + invoice.net).toFixed(2));
      current.debt = Number((current.debt + invoice.debt).toFixed(2));
      buckets.set(bucket.key, current);
    });

    filteredPayments.forEach((payment) => {
      const date = parseDate(payment.date);
      if (!date) return;
      const bucket = toBucket(date, granularity);
      const current = buckets.get(bucket.key) ?? {
        billed: 0,
        debt: 0,
        discount: 0,
        key: bucket.key,
        label: bucket.label,
        net: 0,
        paid: 0,
      };
      current.paid = Number((current.paid + payment.amount).toFixed(2));
      buckets.set(bucket.key, current);
    });

    return [...buckets.values()].sort((left, right) => left.key.localeCompare(right.key));
  }, [filteredInvoices, filteredPayments, granularity]);

  const profitLossTrend = useMemo<ProfitLossPoint[]>(() => {
    const buckets = new Map<string, { income: number; label: string; outcome: number; sort: number }>();

    filteredPayments.forEach((payment) => {
      const date = parseDate(payment.date);
      if (!date) return;
      const bucket = toBucket(date, granularity);
      const current = buckets.get(bucket.key) ?? { income: 0, label: bucket.label, outcome: 0, sort: bucket.sort };
      current.income = Number((current.income + payment.amount).toFixed(2));
      buckets.set(bucket.key, current);
    });

    [...filteredDailyExpenses, ...filteredClinicalExpenses].forEach((expense) => {
      const date = parseDate(expense.expenseDate);
      if (!date) return;
      const bucket = toBucket(date, granularity);
      const current = buckets.get(bucket.key) ?? { income: 0, label: bucket.label, outcome: 0, sort: bucket.sort };
      current.outcome = Number((current.outcome + expense.amount).toFixed(2));
      buckets.set(bucket.key, current);
    });

    salaryRows
      .filter((salary) => (salary.status === 'paid' || salary.status === 'partial') && inRange(salary.paymentDate, startDate, endDate))
      .forEach((salary) => {
        const date = parseDate(salary.paymentDate);
        if (!date) return;
        const bucket = toBucket(date, granularity);
        const current = buckets.get(bucket.key) ?? { income: 0, label: bucket.label, outcome: 0, sort: bucket.sort };
        current.outcome = Number((current.outcome + salary.netAmount).toFixed(2));
        buckets.set(bucket.key, current);
      });

    return [...buckets.entries()]
      .map(([key, value]) => ({
        income: value.income,
        key,
        label: value.label,
        outcome: value.outcome,
        profit: Number((value.income - value.outcome).toFixed(2)),
        sort: value.sort,
      }))
      .sort((left, right) => left.sort - right.sort)
      .map((item) => ({
        income: item.income,
        key: item.key,
        label: item.label,
        outcome: item.outcome,
        profit: item.profit,
      }));
  }, [endDate, filteredClinicalExpenses, filteredDailyExpenses, filteredPayments, granularity, salaryRows, startDate]);

  const paymentMethodMix = useMemo<PaymentMethodPoint[]>(() => {
    const grouped = new Map<string, PaymentMethodPoint>();
    filteredPayments.forEach((payment) => {
      const method = payment.method || 'cash';
      const current = grouped.get(method) ?? { amount: 0, count: 0, method };
      current.amount = Number((current.amount + payment.amount).toFixed(2));
      current.count += 1;
      grouped.set(method, current);
    });

    return [...grouped.values()].sort((left, right) => right.amount - left.amount);
  }, [filteredPayments]);

  const ledgerRows = useMemo(() => {
    const start = parseDate(startDate);
    const startMs = start?.getTime() ?? Number.MIN_SAFE_INTEGER;
    const openingBalance = parsedData.ledgerEntries
      .filter((entry) => {
        const entryDate = parseDate(entry.date);
        return entryDate ? entryDate.getTime() < startMs : false;
      })
      .reduce((sum, entry) => Number((sum + entry.debit - entry.credit).toFixed(2)), 0);

    const inRangeEntries = parsedData.ledgerEntries
      .filter((entry) => inRange(entry.date, startDate, endDate))
      .reduce<LedgerEntry[]>((entries, entry) => {
        const previousBalance = entries.length > 0 ? entries[entries.length - 1].balance : openingBalance;
        const balance = Number((previousBalance + entry.debit - entry.credit).toFixed(2));
        entries.push({
          ...entry,
          balance,
        });
        return entries;
      }, []);

    return { inRangeEntries, openingBalance };
  }, [endDate, parsedData.ledgerEntries, startDate]);
  const ledgerRowsFilteredByPatient = useMemo(() => {
    if (selectedPatientLedgerId === 'all') {
      return ledgerRows.inRangeEntries;
    }

    return ledgerRows.inRangeEntries.filter((entry) => entry.patientId === selectedPatientLedgerId);
  }, [ledgerRows.inRangeEntries, selectedPatientLedgerId]);
  const selectedPatientName = useMemo(() => {
    if (selectedPatientLedgerId === 'all') {
      return 'All patients';
    }

    return mergedPatientNameById.get(selectedPatientLedgerId) || `Patient #${selectedPatientLedgerId}`;
  }, [mergedPatientNameById, selectedPatientLedgerId]);
  const handleThirdCompanyStatusBarClick = useCallback((payload: unknown): void => {
    const maybeStatus = asText((payload as { payload?: { status?: unknown } } | null)?.payload?.status).toLowerCase();
    if (!isImplantAvailabilityStatus(maybeStatus)) return;
    setSelectedThirdCompanyAvailability((current) => (current === maybeStatus ? 'all' : maybeStatus));
  }, []);
  const handleDebtAgingBarClick = useCallback((payload: unknown): void => {
    const maybeBucket = asText((payload as { payload?: { bucket?: unknown } } | null)?.payload?.bucket);
    if (!isDebtAgingBucket(maybeBucket)) return;
    setSelectedDebtAgingBucket((current) => (current === maybeBucket ? 'all' : maybeBucket));
  }, []);
  const ledgerTypeStyles: Record<LedgerEntry['type'], {
    badgeClass: string;
    creditClass: string;
    debitClass: string;
    dotClass: string;
    label: string;
    rowClass: string;
  }> = {
    invoice: {
      badgeClass: 'border-amber-300 bg-amber-100 text-amber-800',
      creditClass: 'text-muted-foreground',
      debitClass: 'text-amber-700',
      dotClass: 'bg-amber-500',
      label: 'Invoice Debit',
      rowClass: 'bg-amber-100/70',
    },
    payment: {
      badgeClass: 'border-emerald-300 bg-emerald-100 text-emerald-800',
      creditClass: 'text-emerald-700',
      debitClass: 'text-muted-foreground',
      dotClass: 'bg-emerald-500',
      label: 'Payment Credit',
      rowClass: 'bg-emerald-100/70',
    },
  };

  const outstandingInvoices = useMemo(
    () =>
      filteredInvoices
        .filter((invoice) => {
          if (invoice.debt <= 0) return false;
          if (selectedDebtAgingBucket === 'all') return true;
          return toDebtAgingBucket(invoice.date, endDate) === selectedDebtAgingBucket;
        })
        .sort((left, right) => right.debt - left.debt)
        .slice(0, 20),
    [endDate, filteredInvoices, selectedDebtAgingBucket]
  );

  const isLoadingAny = isLoadingPatients
    || isLoadingAppointments
    || isLoadingVisits
    || isLoadingInvoices
    || isLoadingVisitTreatments
    || isLoadingFinanceData;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(REPORT_SCHEDULE_KEY, snapshotCadence);
  }, [snapshotCadence]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(REPORT_SNAPSHOT_KEY, JSON.stringify(snapshotRecords));
  }, [snapshotRecords]);

  const captureSnapshot = useCallback((reason: 'manual' | 'scheduled'): void => {
    const now = new Date().toISOString();
    const snapshot: SnapshotRecord = {
      activePatients: kpis.activePatients,
      appointmentCompletionRate: kpis.appointmentCompletionRate,
      appointments: kpis.appointments,
      billed: kpis.billed,
      collectionRate: kpis.collectionRate,
      debt: kpis.debt,
      discount: kpis.discount,
      generatedAt: now,
      granularity,
      id: `${now}-${Math.floor(Math.random() * 10000)}`,
      net: kpis.net,
      paid: kpis.paid,
      rangeEnd: endDate,
      rangeStart: startDate,
      statusFilter,
      visits: kpis.visits,
    };

    setSnapshotRecords((previous) => [snapshot, ...previous].slice(0, 60));
    setLastSnapshotRunAt(now);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(`${REPORT_SCHEDULE_KEY}_last_run`, now);
    }

    if (reason === 'manual') {
      window.alert('Snapshot captured.');
    }
  }, [endDate, granularity, kpis, startDate, statusFilter]);

  useEffect(() => {
    if (snapshotCadence === 'off' || isLoadingAny) return;

    const scheduleCapture = (): void => {
      window.setTimeout(() => {
        captureSnapshot('scheduled');
      }, 0);
    };

    if (!lastSnapshotRunAt) {
      scheduleCapture();
      return;
    }

    const last = parseDate(lastSnapshotRunAt);
    const now = new Date();
    if (!last) {
      scheduleCapture();
      return;
    }

    const elapsedDays = Math.floor((now.getTime() - last.getTime()) / MS_PER_DAY);
    const due = (snapshotCadence === 'daily' && elapsedDays >= 1)
      || (snapshotCadence === 'weekly' && elapsedDays >= 7)
      || (snapshotCadence === 'monthly' && elapsedDays >= 30);

    if (due) {
      scheduleCapture();
    }
  }, [captureSnapshot, isLoadingAny, lastSnapshotRunAt, snapshotCadence]);

  const printCurrentTabTemplate = (): void => {
    const titleByTab = {
      clinical: 'Clinical Reports',
      financial: 'Overview & Financial Reports',
      operations: 'Operations Reports',
      overview: 'Overview & Financial Reports',
    } as const;

    const buildLineChart = (
      points: Array<{ label: string; value: number }>,
      color: string,
      title: string
    ): string => {
      if (points.length === 0) {
        return `<h3>${escapeHtml(title)}</h3><p class="muted">No chart data in selected range.</p>`;
      }

      const width = 760;
      const height = 220;
      const padding = 30;
      const max = Math.max(...points.map((point) => point.value), 1);
      const min = Math.min(...points.map((point) => point.value), 0);
      const valueRange = Math.max(max - min, 1);
      const stepX = points.length > 1 ? (width - padding * 2) / (points.length - 1) : 0;
      const toY = (value: number): number => {
        const ratio = (value - min) / valueRange;
        return Math.round(height - padding - ratio * (height - padding * 2));
      };

      const polylinePoints = points
        .map((point, index) => `${Math.round(padding + index * stepX)},${toY(point.value)}`)
        .join(' ');
      const dots = points
        .map((point, index) => {
          const x = Math.round(padding + index * stepX);
          const y = toY(point.value);
          return `<circle cx="${x}" cy="${y}" r="2.8" fill="${color}" />`;
        })
        .join('');
      const xLabels = [0, Math.floor((points.length - 1) / 2), points.length - 1]
        .filter((index, pos, list) => list.indexOf(index) === pos)
        .map((index) => {
          const x = Math.round(padding + index * stepX);
          return `<text x="${x}" y="${height - 8}" text-anchor="middle" fill="#64748b" font-size="10">${escapeHtml(points[index].label)}</text>`;
        })
        .join('');

      return `
        <h3>${escapeHtml(title)}</h3>
        <svg viewBox="0 0 ${width} ${height}" class="chart-svg" role="img" aria-label="${escapeHtml(title)}">
          <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="#cbd5e1" stroke-width="1" />
          <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}" stroke="#cbd5e1" stroke-width="1" />
          <polyline points="${polylinePoints}" fill="none" stroke="${color}" stroke-width="2.2" />
          ${dots}
          ${xLabels}
        </svg>
      `;
    };

    const buildBarChart = (
      bars: Array<{ label: string; value: number }>,
      color: string,
      title: string
    ): string => {
      if (bars.length === 0) {
        return `<h3>${escapeHtml(title)}</h3><p class="muted">No chart data in selected range.</p>`;
      }

      const width = 760;
      const height = 220;
      const padding = 30;
      const max = Math.max(...bars.map((bar) => bar.value), 1);
      const slotWidth = (width - padding * 2) / bars.length;
      const barWidth = Math.max(6, Math.floor(slotWidth * 0.6));

      const barsSvg = bars
        .map((bar, index) => {
          const barHeight = Math.max(1, Math.round((bar.value / max) * (height - padding * 2)));
          const x = Math.round(padding + index * slotWidth + (slotWidth - barWidth) / 2);
          const y = height - padding - barHeight;
          const label = bar.label.length > 12 ? `${bar.label.slice(0, 11)}...` : bar.label;
          return `
            <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="${color}" rx="2" ry="2" />
            <text x="${x + barWidth / 2}" y="${height - 8}" text-anchor="middle" fill="#64748b" font-size="10">${escapeHtml(label)}</text>
          `;
        })
        .join('');

      return `
        <h3>${escapeHtml(title)}</h3>
        <svg viewBox="0 0 ${width} ${height}" class="chart-svg" role="img" aria-label="${escapeHtml(title)}">
          <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="#cbd5e1" stroke-width="1" />
          <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}" stroke="#cbd5e1" stroke-width="1" />
          ${barsSvg}
        </svg>
      `;
    };

    const buildGroupedBarChart = (
      rows: Array<{ billed: number; debt: number; label: string; paid: number }>,
      title: string
    ): string => {
      if (rows.length === 0) {
        return `<h3>${escapeHtml(title)}</h3><p class="muted">No chart data in selected range.</p>`;
      }

      const width = 760;
      const height = 240;
      const padding = 30;
      const max = Math.max(
        ...rows.flatMap((row) => [row.billed, row.paid, row.debt]),
        1
      );
      const slotWidth = (width - padding * 2) / rows.length;
      const barWidth = Math.max(4, Math.floor(slotWidth * 0.18));

      const barsSvg = rows
        .map((row, index) => {
          const baseX = Math.round(padding + index * slotWidth + slotWidth * 0.2);
          const billedHeight = Math.max(1, Math.round((row.billed / max) * (height - padding * 2)));
          const paidHeight = Math.max(1, Math.round((row.paid / max) * (height - padding * 2)));
          const debtHeight = Math.max(1, Math.round((row.debt / max) * (height - padding * 2)));
          const label = row.label.length > 11 ? `${row.label.slice(0, 10)}...` : row.label;

          return `
            <rect x="${baseX}" y="${height - padding - billedHeight}" width="${barWidth}" height="${billedHeight}" fill="#0ea5e9" rx="2" ry="2" />
            <rect x="${baseX + barWidth + 2}" y="${height - padding - paidHeight}" width="${barWidth}" height="${paidHeight}" fill="#22c55e" rx="2" ry="2" />
            <rect x="${baseX + (barWidth + 2) * 2}" y="${height - padding - debtHeight}" width="${barWidth}" height="${debtHeight}" fill="#f97316" rx="2" ry="2" />
            <text x="${baseX + barWidth * 1.5 + 2}" y="${height - 8}" text-anchor="middle" fill="#64748b" font-size="10">${escapeHtml(label)}</text>
          `;
        })
        .join('');

      return `
        <h3>${escapeHtml(title)}</h3>
        <div class="legend-row">
          <span><i class="chip chip-blue"></i>Billed</span>
          <span><i class="chip chip-green"></i>Paid</span>
          <span><i class="chip chip-orange"></i>Debt</span>
        </div>
        <svg viewBox="0 0 ${width} ${height}" class="chart-svg" role="img" aria-label="${escapeHtml(title)}">
          <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="#cbd5e1" stroke-width="1" />
          <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}" stroke="#cbd5e1" stroke-width="1" />
          ${barsSvg}
        </svg>
      `;
    };

    const totalOutcomeForPrint = Number((kpis.expenses + kpis.salaryPaid + kpis.thirdCompanyPaid).toFixed(2));
    const profitOrLossForPrint = Number((kpis.paid - totalOutcomeForPrint).toFixed(2));
    const formatRow = (label: string, value: string): string => `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`;
    const summaryRows = [
      formatRow('Date Range', `${formatFullDate(startDate)} to ${formatFullDate(endDate)}`),
      formatRow('Granularity', toHumanLabel(granularity)),
      formatRow('Invoice Status Filter', toHumanLabel(statusFilter)),
      formatRow('Reporting Currency', 'AFN (Afghani)'),
      formatRow('Billed', formatCurrency(kpis.billed)),
      formatRow('Discount', formatCurrency(kpis.discount)),
      formatRow('Net', formatCurrency(kpis.net)),
      formatRow('Paid', formatCurrency(kpis.paid)),
      formatRow('Debt', formatCurrency(kpis.debt)),
      formatRow('Expenses', formatCurrency(kpis.expenses)),
      formatRow('Third-Company Paid', formatCurrency(kpis.thirdCompanyPaid)),
      formatRow('Third-Company Unpaid', formatCurrency(kpis.thirdCompanyUnpaid)),
      formatRow('Third-Company Supplier Total', formatCurrency(kpis.thirdCompanyTotal)),
      formatRow('Third-Company Unpaid Teeth', String(kpis.thirdCompanyUnpaidCount)),
      formatRow('Net After Expenses', formatCurrency(kpis.netAfterExpenses)),
      formatRow('Safe Outflow', formatCurrency(kpis.safeOut)),
      formatRow('Salaries Paid', formatCurrency(kpis.salaryPaid)),
      formatRow('Collection Rate', `${kpis.collectionRate}%`),
      formatRow('Profit / Loss', formatCurrency(profitOrLossForPrint)),
    ].join('');

    const maxBar = Math.max(kpis.paid, totalOutcomeForPrint, 1);
    const paidBarWidth = Math.min(100, (kpis.paid / maxBar) * 100);
    const outcomeBarWidth = Math.min(100, (totalOutcomeForPrint / maxBar) * 100);
    const profitBarWidth = Math.min(100, (Math.abs(profitOrLossForPrint) / maxBar) * 100);
    const profitLossSection = `
      <h3>Profit / Loss Visual</h3>
      <div class="bar-wrap"><span>Income (Paid)</span><div class="bar bg-blue"><i style="width:${paidBarWidth}%"></i></div><b>${escapeHtml(formatCurrency(kpis.paid))}</b></div>
      <div class="bar-wrap"><span>Outcome (Expenses + Salaries + Third-Company)</span><div class="bar bg-orange"><i style="width:${outcomeBarWidth}%"></i></div><b>${escapeHtml(formatCurrency(totalOutcomeForPrint))}</b></div>
      <div class="bar-wrap"><span>${profitOrLossForPrint >= 0 ? 'Profit' : 'Loss'}</span><div class="bar ${profitOrLossForPrint >= 0 ? 'bg-emerald' : 'bg-red'}"><i style="width:${profitBarWidth}%"></i></div><b>${escapeHtml(formatCurrency(profitOrLossForPrint))}</b></div>
    `;
    const salaryRowsForPrint = salaryRows
      .filter((row) => inRange(row.paymentDate, startDate, endDate))
      .slice(0, 50);
    const paymentMethodRowsForPrint = paymentMethodMix.slice(0, 20);
    const outstandingInvoicesForPrint = outstandingInvoices.slice(0, 30);
    const thirdCompanyStatusUnpaidRows = thirdCompanyStatusChart.filter((row) => row.unpaid > 0);
    const thirdCompanyStatusCountRows = thirdCompanyStatusChart.filter((row) => row.count > 0);

    const overviewBodySection = `
      ${profitLossSection}
      ${buildLineChart(incomeTrend.map((point) => ({ label: point.label, value: point.income })), '#0ea5e9', 'Income Trend Diagram')}
      <h3>Income Trend</h3>
      <table><thead><tr><th>Bucket</th><th>Income</th><th>Payments</th></tr></thead><tbody>
        ${incomeTrend.map((point) => `<tr><td>${escapeHtml(point.label)}</td><td>${escapeHtml(formatCurrency(point.income))}</td><td>${point.paymentCount}</td></tr>`).join('')}
      </tbody></table>
    `;
    const financialBodySection = `
      ${profitLossSection}
      ${buildBarChart([
        { label: 'Paid', value: kpis.thirdCompanyPaid },
        { label: 'Unpaid', value: kpis.thirdCompanyUnpaid },
      ], '#f97316', 'Third-Company Liability Diagram')}
      ${buildBarChart(
        thirdCompanyStatusUnpaidRows.map((row) => ({ label: row.label, value: row.unpaid })),
        '#f97316',
        'Third-Company Unpaid by Status Diagram'
      )}
      ${buildBarChart(
        thirdCompanyStatusCountRows.map((row) => ({ label: row.label, value: row.count })),
        '#0ea5e9',
        'Implant Teeth Count by Status Diagram'
      )}
      <h3>Unpaid Third-Company Payments</h3>
      <table><thead><tr><th>Patient</th><th>Tooth</th><th>Status</th><th>Total</th><th>Paid</th><th>Unpaid</th></tr></thead><tbody>
        ${thirdCompanyUnpaidRows.map((row) => `<tr><td>${escapeHtml(mergedPatientNameById.get(row.patientId) || `Patient #${row.patientId || '-'}`)}</td><td>${escapeHtml(row.toothNumber)}</td><td>${escapeHtml(toHumanLabel(row.availability))}</td><td>${escapeHtml(formatCurrency(row.supplierTotal))}</td><td>${escapeHtml(formatCurrency(row.supplierPaid))}</td><td>${escapeHtml(formatCurrency(row.supplierRemaining))}</td></tr>`).join('')}
      </tbody></table>
      ${buildBarChart(expenseSummary.byCategory.map((row) => ({ label: row.category, value: row.amount })), '#ef4444', 'Expense by Category Diagram')}
      <h3>Expense Summary</h3>
      <table><thead><tr><th>Category</th><th>Amount</th></tr></thead><tbody>
        ${expenseSummary.byCategory.map((row) => `<tr><td>${escapeHtml(row.category)}</td><td>${escapeHtml(formatCurrency(row.amount))}</td></tr>`).join('')}
      </tbody></table>
      ${buildBarChart(debtAging.map((row) => ({ label: row.bucket, value: row.amount })), '#f97316', 'Receivables Aging Diagram')}
      ${buildGroupedBarChart(cashFlowTrend.map((row) => ({ billed: row.billed, debt: row.debt, label: row.label, paid: row.paid })), `Cash Flow by ${granularity} Diagram`)}
      ${buildBarChart(
        paymentMethodRowsForPrint.map((row) => ({ label: toHumanLabel(row.method), value: row.amount })),
        '#6366f1',
        'Payment Method Mix Diagram'
      )}
      ${buildLineChart(ledgerRowsFilteredByPatient.map((row) => ({ label: formatShortDate(row.date), value: row.balance })), '#6366f1', `Ledger Trend (${selectedPatientName})`)}
      <h3>Invoice Details</h3>
      <table><thead><tr><th>Invoice</th><th>Total</th><th>Net</th></tr></thead><tbody>
        ${filteredInvoices.map((invoice) => `<tr><td>#${escapeHtml(invoice.id)}</td><td>${escapeHtml(formatCurrency(invoice.totalInput))}</td><td>${escapeHtml(formatCurrency(invoice.netInput))}</td></tr>`).join('')}
      </tbody></table>
      <h3>Salary Payments</h3>
      ${salaryRowsForPrint.length === 0
    ? '<p class="muted">No salary payments in selected range.</p>'
    : `<table><thead><tr><th>Staff</th><th>Status</th><th>Date</th><th>Amount</th></tr></thead><tbody>
          ${salaryRowsForPrint.map((row) => `<tr><td>${escapeHtml(row.staffName || row.staffId)}</td><td>${escapeHtml(toHumanLabel(row.status))}</td><td>${escapeHtml(formatFullDate(row.paymentDate))}</td><td>${escapeHtml(formatCurrency(row.netAmount))}</td></tr>`).join('')}
        </tbody></table>`}
      <h3>Highest Outstanding Invoices</h3>
      ${outstandingInvoicesForPrint.length === 0
    ? '<p class="muted">No outstanding invoices.</p>'
    : `<table><thead><tr><th>Invoice</th><th>Patient</th><th>Date</th><th>Net</th><th>Paid</th><th>Debt</th></tr></thead><tbody>
          ${outstandingInvoicesForPrint.map((invoice) => `<tr><td>#${escapeHtml(invoice.id)}</td><td>${escapeHtml(mergedPatientNameById.get(invoice.patientId) || `Patient #${invoice.patientId || '-'}`)}</td><td>${escapeHtml(formatFullDate(invoice.date))}</td><td>${escapeHtml(formatCurrency(invoice.net))}</td><td>${escapeHtml(formatCurrency(invoice.paid))}</td><td>${escapeHtml(formatCurrency(invoice.debt))}</td></tr>`).join('')}
        </tbody></table>`}
      <h3>Payment Method Mix</h3>
      ${paymentMethodRowsForPrint.length === 0
    ? '<p class="muted">No payment method data in selected range.</p>'
    : `<table><thead><tr><th>Method</th><th>Payments</th><th>Amount</th></tr></thead><tbody>
          ${paymentMethodRowsForPrint.map((row) => `<tr><td>${escapeHtml(toHumanLabel(row.method))}</td><td>${row.count}</td><td>${escapeHtml(formatCurrency(row.amount))}</td></tr>`).join('')}
        </tbody></table>`}
      <h3>Safe Pickups</h3>
      <table><thead><tr><th>Staff</th><th>Amount</th></tr></thead><tbody>
        ${safePickups.map((row) => `<tr><td>${escapeHtml(row.name)}</td><td>${escapeHtml(formatCurrency(row.amount))}</td></tr>`).join('')}
      </tbody></table>
      <h3>Ledger (${escapeHtml(selectedPatientName)})</h3>
      <div class="legend-row">
        <span><i class="chip chip-invoice"></i>Invoice Debit</span>
        <span><i class="chip chip-payment"></i>Payment Credit</span>
      </div>
      <table><thead><tr><th>Date</th><th>Type</th><th>Invoice</th><th>Method</th><th>Debit</th><th>Credit</th><th>Balance</th></tr></thead><tbody>
        ${ledgerRowsFilteredByPatient.map((entry) => {
    const isInvoice = entry.type === 'invoice';
    const rowClass = isInvoice ? 'type-invoice' : 'type-payment';
    const rowBackground = isInvoice ? '#fffbeb' : '#ecfdf5';
    const cellStyle = `background:${rowBackground};-webkit-print-color-adjust:exact;print-color-adjust:exact;`;
    return `<tr class="${rowClass}"><td style="${cellStyle}">${escapeHtml(formatFullDate(entry.date))}</td><td style="${cellStyle}"><span class="type-chip ${isInvoice ? 'chip-invoice' : 'chip-payment'}">${isInvoice ? 'Invoice Debit' : 'Payment Credit'}</span></td><td style="${cellStyle}">#${escapeHtml(entry.invoiceId)}</td><td style="${cellStyle}">${escapeHtml(toHumanLabel(entry.method))}</td><td style="${cellStyle}">${entry.debit > 0 ? escapeHtml(formatCurrency(entry.debit)) : '-'}</td><td style="${cellStyle}">${entry.credit > 0 ? escapeHtml(formatCurrency(entry.credit)) : '-'}</td><td style="${cellStyle}">${escapeHtml(formatCurrency(entry.balance))}</td></tr>`;
  }).join('')}
      </tbody></table>
    `;
    let bodySections = '';
    if (activeTab === 'overview' || activeTab === 'financial') {
      bodySections = `
        <h2>Overview</h2>
        ${overviewBodySection}
        <h2>Financial</h2>
        ${financialBodySection}
      `;
    }
    if (activeTab === 'clinical') {
      bodySections = `
        <h3>Treatment Volume</h3>
        <table><thead><tr><th>Treatment</th><th>Sessions</th><th>Revenue</th></tr></thead><tbody>
          ${treatmentVolume.map((row) => `<tr><td>${escapeHtml(row.name)}</td><td>${row.sessions}</td><td>${escapeHtml(formatCurrency(row.revenue))}</td></tr>`).join('')}
        </tbody></table>
      `;
    }
    if (activeTab === 'operations') {
      bodySections = `
        <h3>Dentist Productivity</h3>
        <table><thead><tr><th>Dentist</th><th>Visits</th><th>Revenue</th></tr></thead><tbody>
          ${dentistProductivity.map((row) => `<tr><td>${escapeHtml(row.dentist)}</td><td>${row.visits}</td><td>${escapeHtml(formatCurrency(row.revenue))}</td></tr>`).join('')}
        </tbody></table>
      `;
    }

    const printHtml = `<!doctype html><html><head><meta charset="utf-8"/><title>${escapeHtml(titleByTab[activeTab])}</title><style>
      body{font-family:Arial,sans-serif;padding:20px;color:#0f172a}
      h1,h2,h3{margin:0 0 8px}
      table{width:100%;border-collapse:collapse;margin:8px 0}
      th,td{border:1px solid #d1d5db;padding:6px;text-align:left;font-size:12px}
      th{background:#f1f5f9}
      .bar-wrap{display:grid;grid-template-columns:220px 1fr 160px;gap:10px;align-items:center;margin:8px 0;font-size:12px}
      .bar{height:10px;border-radius:999px;background:#e2e8f0;overflow:hidden}
      .bar i{display:block;height:100%}
      .chart-svg{width:100%;height:auto;border:1px solid #e2e8f0;border-radius:10px;margin:8px 0;background:#ffffff}
      .legend-row{display:flex;gap:14px;margin:4px 0 8px;font-size:11px;color:#334155}
      .legend-row .chip{display:inline-block;width:8px;height:8px;border-radius:999px;margin-right:4px}
      .chip-blue{background:#0ea5e9}
      .chip-green{background:#22c55e}
      .chip-orange{background:#f97316}
      .chip-invoice{background:#f59e0b}
      .chip-payment{background:#22c55e}
      .type-chip{display:inline-block;border:1px solid #d1d5db;border-radius:999px;padding:1px 8px;font-size:10px;font-weight:700}
      .type-invoice td{background:#fffbeb}
      .type-payment td{background:#ecfdf5}
      .muted{font-size:12px;color:#64748b;margin:6px 0 10px}
      .bg-blue i{background:#2563eb}
      .bg-orange i{background:#f97316}
      .bg-emerald i{background:#16a34a}
      .bg-red i{background:#dc2626}
      @media print{
        body,th,td{
          -webkit-print-color-adjust:exact !important;
          print-color-adjust:exact !important;
        }
        .type-invoice td{background:#fffbeb !important}
        .type-payment td{background:#ecfdf5 !important}
      }
    </style></head><body>
      <h1>${escapeHtml(titleByTab[activeTab])}</h1>
      <p>Generated at: ${escapeHtml(formatDateTime(new Date().toISOString()))}</p>
      <h3>Summary</h3>
      <table><tbody>${summaryRows}</tbody></table>
      ${bodySections}
    </body></html>`;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.setAttribute('aria-hidden', 'true');
    document.body.appendChild(iframe);

    const cleanup = (): void => {
      window.setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 0);
    };

    const frameWindow = iframe.contentWindow;
    const frameDocument = frameWindow?.document;
    if (!frameWindow || !frameDocument) {
      cleanup();
      return;
    }

    iframe.onload = () => {
      frameWindow.focus();
      frameWindow.print();
      frameWindow.onafterprint = cleanup;
      window.setTimeout(cleanup, 1500);
    };

    frameDocument.open();
    frameDocument.write(printHtml);
    frameDocument.close();
  };

  return (
    <>
      <Header
        breadcrumbs={[
          { id: 'reports', label: tSidebar('reports.title') },
          { id: 'reportsOverview', isCurrent: true, label: tSidebar('reports.overview') },
        ]}
      />

      <div dir={isRtl ? 'rtl' : 'ltr'} className="flex flex-1 flex-col px-4 pb-6 lg:px-6">
        <div className="flex flex-col gap-4 py-4">
          <Card className="border-border/70 bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{tReportsPage('controls.title')}</CardTitle>
              <CardDescription>
                {tReportsPage('controls.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-2 md:grid-cols-4">
                <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
                <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
                <select
                  value={granularity}
                  onChange={(event) => setGranularity(event.target.value as ReportGranularity)}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="day">{tReportsPage('granularity.day')}</option>
                  <option value="month">{tReportsPage('granularity.month')}</option>
                  <option value="year">{tReportsPage('granularity.year')}</option>
                </select>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as InvoiceStatusFilter)}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="all">{tReportsPage('status.all')}</option>
                  <option value="unpaid">{tReportsPage('status.unpaid')}</option>
                  <option value="partially_paid">{tReportsPage('status.partiallyPaid')}</option>
                  <option value="paid">{tReportsPage('status.paid')}</option>
                  <option value="cancelled">{tReportsPage('status.cancelled')}</option>
                </select>
              </div>
              <div className="grid gap-3 rounded-md border border-border/70 bg-muted/20 p-3 md:grid-cols-4">
                <div>
                  <p className="text-xs text-muted-foreground">{tReportsPage('summary.incomePaid')}</p>
                  <p className="text-lg font-semibold text-emerald-600">{formatCurrency(kpis.paid)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{tReportsPage('summary.outcome')}</p>
                  <p className="text-lg font-semibold text-orange-600">{formatCurrency(totalOutcome)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{tReportsPage('summary.profitLoss')}</p>
                  <p className={`text-lg font-semibold ${profitOrLoss >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {formatCurrency(profitOrLoss)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Third-Company Unpaid</p>
                  <p className="text-lg font-semibold text-orange-600">{formatCurrency(kpis.thirdCompanyUnpaid)}</p>
                  <p className="text-xs text-muted-foreground">{kpis.thirdCompanyUnpaidCount} implant teeth</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    printCurrentTabTemplate();
                  }}
                >
                  {tReportsPage('actions.print')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    downloadCsv(
                      `profit-loss-${startDate}-to-${endDate}.csv`,
                      profitLossTrend.map((row) => ({
                        'Income (AFN)': formatCurrency(row.income),
                        'Outcome (AFN)': formatCurrency(row.outcome),
                        Period: row.label,
                        'Profit/Loss (AFN)': formatCurrency(row.profit),
                        Result: row.profit >= 0 ? 'Profit' : 'Loss',
                      }))
                    );
                  }}
                  disabled={profitLossTrend.length === 0}
                >
                  {tReportsPage('actions.exportProfitLoss')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setShowAdvancedControls((previous) => !previous);
                  }}
                >
                  {showAdvancedControls ? tReportsPage('actions.hideAdvanced') : tReportsPage('actions.showAdvanced')}
                </Button>
              </div>

              {showAdvancedControls ? (
                <>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    downloadCsv(
                      `financial-report-${startDate}-to-${endDate}.csv`,
                      filteredInvoices.map((invoice) => ({
                        'Currency': invoice.currency,
                        'Discount (AFN)': formatCurrency(invoice.discount),
                        'Entered Discount (AFN)': formatCurrency(invoice.discountInput),
                        'Entered Net (AFN)': formatCurrency(invoice.netInput),
                        'Entered Total (AFN)': formatCurrency(invoice.totalInput),
                        'Exchange Rate': Number(invoice.exchangeRate).toFixed(6),
                        'Invoice #': invoice.id,
                        'Invoice Date': formatFullDate(invoice.date),
                        'Net Total (AFN)': formatCurrency(invoice.net),
                        'Outstanding Debt (AFN)': formatCurrency(invoice.debt),
                        'Paid Amount (AFN)': formatCurrency(invoice.paid),
                        'Patient': mergedPatientNameById.get(invoice.patientId) || `Patient #${invoice.patientId || '-'}`,
                        'Status': toHumanLabel(invoice.status),
                        'Total Amount (AFN)': formatCurrency(invoice.total),
                      }))
                    );
                  }}
                >
                  Export Financial CSV
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    downloadCsv(
                      `income-trend-${startDate}-to-${endDate}.csv`,
                      incomeTrend.map((point) => ({
                        'Income (AFN)': formatCurrency(point.income),
                        'Number of Payments': point.paymentCount,
                        Period: point.label,
                      }))
                    );
                  }}
                >
                  Export Income Trend CSV
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const rows = [
                      {
                        'Balance (AFN)': formatCurrency(ledgerRows.openingBalance),
                        'Credit (AFN)': '-',
                        'Date': formatFullDate(startDate),
                        'Debit (AFN)': '-',
                        'Description': 'Opening Balance',
                        'Entry Type': 'Opening',
                        'Invoice #': '-',
                        'Patient': selectedPatientName,
                        'Payment Method': '-',
                      },
                      ...ledgerRows.inRangeEntries.map((entry) => ({
                        'Balance (AFN)': formatCurrency(entry.balance),
                        'Credit (AFN)': entry.credit > 0 ? formatCurrency(entry.credit) : '-',
                        'Date': formatFullDate(entry.date),
                        'Debit (AFN)': entry.debit > 0 ? formatCurrency(entry.debit) : '-',
                        'Description': entry.label,
                        'Entry Type': toHumanLabel(entry.type),
                        'Invoice #': entry.invoiceId || '-',
                        'Patient': mergedPatientNameById.get(entry.patientId) || `Patient #${entry.patientId || '-'}`,
                        'Payment Method': toHumanLabel(entry.method || '-'),
                      })),
                    ];
                    downloadCsv(`ledger-${startDate}-to-${endDate}.csv`, rows);
                  }}
                >
                  Export Ledger CSV
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    downloadCsv(
                      `expenses-${startDate}-to-${endDate}.csv`,
                      [...filteredDailyExpenses, ...filteredClinicalExpenses].map((row) => ({
                        'Amount (AFN)': formatCurrency(row.amount),
                        'Category': row.category,
                        'Currency': row.currency,
                        'Date': formatFullDate(row.expenseDate),
                        'Entered Amount (AFN)': formatCurrency(row.amountInput),
                        'Exchange Rate': row.exchangeRate.toFixed(6),
                        'Expense Type': toHumanLabel(row.expenseType),
                        'Record ID': row.id,
                      }))
                    );
                  }}
                >
                  Export Expenses CSV
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const rows = safeRows
                      .filter((row) => inRange(row.transactionDate, startDate, endDate))
                      .map((row) => ({
                        'Amount (AFN)': formatCurrency(row.amount),
                        'Currency': row.currency,
                        'Date': formatFullDate(row.transactionDate),
                        'Direction': toHumanLabel(row.direction),
                        'Entered Amount (AFN)': formatCurrency(row.amountInput),
                        'Entry Type': toHumanLabel(row.entryType),
                        'Exchange Rate': row.exchangeRate.toFixed(6),
                        'Notes': row.notes || '-',
                        'Picked By': row.pickedByStaffName || row.pickedByStaffId || '-',
                      }));
                    downloadCsv(`safe-transactions-${startDate}-to-${endDate}.csv`, rows);
                  }}
                >
                  Export Safe CSV
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const rows = salaryRows
                      .filter((row) => inRange(row.paymentDate, startDate, endDate))
                      .map((row) => ({
                        'Currency': row.currency,
                        'Entered Net (AFN)': formatCurrency(row.netAmountInput),
                        'Exchange Rate': row.exchangeRate.toFixed(6),
                        'Net Paid (AFN)': formatCurrency(row.netAmount),
                        'Payment Date': formatFullDate(row.paymentDate),
                        'Staff': row.staffName || row.staffId,
                        'Status': toHumanLabel(row.status),
                      }));
                    downloadCsv(`salaries-${startDate}-to-${endDate}.csv`, rows);
                  }}
                >
                  Export Salaries CSV
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    downloadCsv(
                      `third-company-unpaid-${startDate}-to-${endDate}.csv`,
                      thirdCompanyUnpaidRows.map((row) => ({
                        'Availability': toHumanLabel(row.availability),
                        'Paid To Supplier (AFN)': formatCurrency(row.supplierPaid),
                        'Patient': mergedPatientNameById.get(row.patientId) || `Patient #${row.patientId || '-'}`,
                        'Supplier Total (AFN)': formatCurrency(row.supplierTotal),
                        'Tooth': row.toothNumber,
                        'Unpaid To Supplier (AFN)': formatCurrency(row.supplierRemaining),
                      }))
                    );
                  }}
                  disabled={thirdCompanyUnpaidRows.length === 0}
                >
                  Export Third-Company Unpaid CSV
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    printCurrentTabTemplate();
                  }}
                >
                  Print/PDF Current Tab
                </Button>
              </div>
              <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto_auto]">
                <select
                  value={snapshotCadence}
                  onChange={(event) => {
                    setSnapshotCadence(event.target.value as SnapshotCadence);
                  }}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="off">Snapshots: Off</option>
                  <option value="daily">Snapshots: Daily</option>
                  <option value="weekly">Snapshots: Weekly</option>
                  <option value="monthly">Snapshots: Monthly</option>
                </select>
                <Input value={lastSnapshotRunAt ? formatFullDate(lastSnapshotRunAt) : '-'} readOnly />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    captureSnapshot('manual');
                  }}
                >
                  Run Snapshot Now
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSnapshotRecords([]);
                    if (typeof window !== 'undefined') {
                      window.localStorage.removeItem(REPORT_SNAPSHOT_KEY);
                    }
                  }}
                >
                  Clear Snapshots
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    downloadCsv(
                      `report-snapshots-${today}.csv`,
                      snapshotRecords.map((snapshot) => ({
                        'Active Patients': snapshot.activePatients,
                        'Appointment Completion Rate (%)': `${snapshot.appointmentCompletionRate}%`,
                        'Appointments': snapshot.appointments,
                        'Billed (AFN)': formatCurrency(snapshot.billed),
                        'Collection Rate (%)': `${snapshot.collectionRate}%`,
                        'Debt (AFN)': formatCurrency(snapshot.debt),
                        'Discount (AFN)': formatCurrency(snapshot.discount),
                        'Generated At': formatDateTime(snapshot.generatedAt),
                        'Granularity': toHumanLabel(snapshot.granularity),
                        'Invoice Status Filter': toHumanLabel(snapshot.statusFilter),
                        'Net (AFN)': formatCurrency(snapshot.net),
                        'Paid (AFN)': formatCurrency(snapshot.paid),
                        'Range End': formatFullDate(snapshot.rangeEnd),
                        'Range Start': formatFullDate(snapshot.rangeStart),
                        'Visits': snapshot.visits,
                      }))
                    );
                  }}
                  disabled={snapshotRecords.length === 0}
                >
                  Export Snapshots CSV
                </Button>
              </div>
              {snapshotRecords.length > 0 ? (
                <div className="rounded-md border border-border/70 bg-muted/15 p-2 text-xs">
                  <p className="mb-1 font-semibold text-foreground">Recent Snapshots</p>
                  <div className="space-y-1">
                    {snapshotRecords.slice(0, 5).map((snapshot) => (
                      <div key={snapshot.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-border/60 bg-background px-2 py-1">
                        <span className="text-muted-foreground">{formatFullDate(snapshot.generatedAt)}</span>
                        <span className="text-foreground">
                          Billed {formatCurrency(snapshot.billed)} | Paid {formatCurrency(snapshot.paid)} | Debt {formatCurrency(snapshot.debt)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
                </>
              ) : null}
            </CardContent>
          </Card>

          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)} className="space-y-3">
            <TabsList>
              <TabsTrigger value="overview">{tReportsPage('tabs.overview')}</TabsTrigger>
              <TabsTrigger value="financial">{tReportsPage('tabs.financial')}</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
                <Card className="border-border/70">
                  <CardContent className="pt-5">
                    <p className="text-xs text-muted-foreground">Total Patients</p>
                    <p className="text-2xl font-semibold">{kpis.totalPatients}</p>
                    <p className="text-xs text-muted-foreground">Active: {kpis.activePatients}</p>
                  </CardContent>
                </Card>
                <Card className="border-border/70">
                  <CardContent className="pt-5">
                    <p className="text-xs text-muted-foreground">Visits / Appointments</p>
                    <p className="text-2xl font-semibold">{kpis.visits} / {kpis.appointments}</p>
                    <p className="text-xs text-muted-foreground">Completion: {kpis.appointmentCompletionRate}%</p>
                  </CardContent>
                </Card>
                <Card className="border-border/70">
                  <CardContent className="pt-5">
                    <p className="text-xs text-muted-foreground">Billed</p>
                    <p className="text-2xl font-semibold">{formatCurrency(kpis.billed)}</p>
                    <p className="text-xs text-muted-foreground">Discount: {formatCurrency(kpis.discount)}</p>
                  </CardContent>
                </Card>
                <Card className="border-border/70">
                  <CardContent className="pt-5">
                    <p className="text-xs text-muted-foreground">Collected</p>
                    <p className="text-2xl font-semibold">{formatCurrency(kpis.paid)}</p>
                    <p className="text-xs text-muted-foreground">Collection: {kpis.collectionRate}%</p>
                  </CardContent>
                </Card>
                <Card className="border-border/70">
                  <CardContent className="pt-5">
                    <p className="text-xs text-muted-foreground">Outstanding Debt</p>
                    <p className="text-2xl font-semibold">{formatCurrency(kpis.debt)}</p>
                    <p className="text-xs text-muted-foreground">Net: {formatCurrency(kpis.net)}</p>
                  </CardContent>
                </Card>
                <Card className="border-border/70">
                  <CardContent className="pt-5">
                    <p className="text-xs text-muted-foreground">All Expenses</p>
                    <p className="text-2xl font-semibold">{formatCurrency(kpis.expenses)}</p>
                    <p className="text-xs text-muted-foreground">
                      Safe outflow: {formatCurrency(kpis.safeOut)} | Salaries: {formatCurrency(kpis.salaryPaid)}
                    </p>
                    <p className="text-xs text-muted-foreground">Third-company paid: {formatCurrency(kpis.thirdCompanyPaid)}</p>
                    <p className="text-xs text-muted-foreground">Net after expenses: {formatCurrency(kpis.netAfterExpenses)}</p>
                  </CardContent>
                </Card>
                <Card className="border-border/70">
                  <CardContent className="pt-5">
                    <p className="text-xs text-muted-foreground">Third-Company Unpaid</p>
                    <p className="text-2xl font-semibold">{formatCurrency(kpis.thirdCompanyUnpaid)}</p>
                    <p className="text-xs text-muted-foreground">Supplier total: {formatCurrency(kpis.thirdCompanyTotal)}</p>
                    <p className="text-xs text-muted-foreground">Unpaid teeth: {kpis.thirdCompanyUnpaidCount}</p>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-border/70">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Revenue Flow</CardTitle>
                  <CardDescription>Flow from billed amount to current receivables.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="grid gap-2 md:grid-cols-4">
                    <div className="rounded-md border border-border/70 bg-muted/20 p-2">
                      <p className="text-xs text-muted-foreground">Billed</p>
                      <p className="text-sm font-semibold text-foreground">{formatCurrency(kpis.billed)}</p>
                    </div>
                    <div className="rounded-md border border-border/70 bg-muted/20 p-2">
                      <p className="text-xs text-muted-foreground">Discount</p>
                      <p className="text-sm font-semibold text-foreground">{formatCurrency(kpis.discount)}</p>
                    </div>
                    <div className="rounded-md border border-border/70 bg-muted/20 p-2">
                      <p className="text-xs text-muted-foreground">Collected</p>
                      <p className="text-sm font-semibold text-foreground">{formatCurrency(kpis.paid)}</p>
                    </div>
                    <div className="rounded-md border border-border/70 bg-muted/20 p-2">
                      <p className="text-xs text-muted-foreground">Outstanding</p>
                      <p className="text-sm font-semibold text-foreground">{formatCurrency(kpis.debt)}</p>
                    </div>
                    <div className="rounded-md border border-border/70 bg-muted/20 p-2 md:col-span-2">
                      <p className="text-xs text-muted-foreground">Expenses (Daily + Clinical)</p>
                      <p className="text-sm font-semibold text-foreground">
                        {formatCurrency(expenseSummary.total)} ({formatCurrency(expenseSummary.daily)} daily / {formatCurrency(expenseSummary.clinical)} clinical)
                      </p>
                      <p className="text-xs text-muted-foreground">Third-company paid: {formatCurrency(kpis.thirdCompanyPaid)}</p>
                      <p className="text-xs text-muted-foreground">Operational net cash: {formatCurrency(kpis.netAfterExpenses)}</p>
                    </div>
                    <div className="rounded-md border border-border/70 bg-muted/20 p-2 md:col-span-2">
                      <p className="text-xs text-muted-foreground">Third-Company Liability</p>
                      <p className="text-sm font-semibold text-foreground">
                        Unpaid {formatCurrency(kpis.thirdCompanyUnpaid)} / Total {formatCurrency(kpis.thirdCompanyTotal)}
                      </p>
                      <p className="text-xs text-muted-foreground">Unpaid teeth: {kpis.thirdCompanyUnpaidCount}</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="h-2 rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full bg-emerald-500"
                        style={{ width: `${kpis.net > 0 ? Math.min(100, (kpis.paid / kpis.net) * 100) : 0}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Collection flow progress: {kpis.collectionRate}% of net invoices collected.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/70">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{tReportsPage('profitLossChart.title', { granularity: granularityLabel })}</CardTitle>
                  <CardDescription>
                    {tReportsPage('profitLossChart.description')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {profitLossTrend.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{tReportsPage('profitLossChart.empty')}</p>
                  ) : (
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={profitLossTrend}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="label" />
                          <YAxis tickFormatter={(value) => `${Number(value).toFixed(0)}`} />
                          <Tooltip
                            formatter={(value, name) => [formatCurrency(Number(value ?? 0)), name]}
                            labelFormatter={(label) => `Period: ${label}`}
                          />
                          <Legend />
                          <Bar dataKey="income" fill="#22c55e" name={tReportsPage('summary.incomePaid')} radius={[4, 4, 0, 0]} />
                          <Bar dataKey="outcome" fill="#f97316" name={tReportsPage('summary.outcome')} radius={[4, 4, 0, 0]} />
                          <Bar dataKey="profit" name={tReportsPage('summary.profitLoss')} radius={[4, 4, 0, 0]}>
                            {profitLossTrend.map((entry) => (
                              <Cell key={entry.key} fill={entry.profit >= 0 ? '#16a34a' : '#dc2626'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/70">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Income Trend</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoadingAny ? (
                    <p className="text-sm text-muted-foreground">Loading report data...</p>
                  ) : incomeTrend.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No income data in selected range.</p>
                  ) : (
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={incomeTrend} margin={{ bottom: 8, left: 0, right: 10, top: 8 }}>
                          <defs>
                            <linearGradient id="reportsIncomeGradient" x1="0" x2="0" y1="0" y2="1">
                              <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.42} />
                              <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.06} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                          <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} />
                          <YAxis
                            tick={{ fill: '#64748b', fontSize: 11 }}
                            tickFormatter={(value) => `AFN ${Number(value).toFixed(0)}`}
                            tickLine={false}
                            width={70}
                          />
                          <Tooltip
                            formatter={(value) => [formatCurrency(Number(value ?? 0)), 'Income']}
                            labelFormatter={(label) => `Bucket: ${label}`}
                          />
                          <Area dataKey="income" fill="url(#reportsIncomeGradient)" stroke="#0ea5e9" strokeWidth={2} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="financial" className="space-y-4">
              <Card className="border-border/70">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Third-Company Implant Liability</CardTitle>
                  <CardDescription>
                    Tracks clinic obligations to implant supplier across lifecycle statuses.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-2 md:grid-cols-4">
                    <div className="rounded-md border border-border/70 bg-muted/20 p-2">
                      <p className="text-xs text-muted-foreground">Supplier Total</p>
                      <p className="text-sm font-semibold text-foreground">{formatCurrency(thirdCompanySummary.totalSupplierCost)}</p>
                    </div>
                    <div className="rounded-md border border-border/70 bg-muted/20 p-2">
                      <p className="text-xs text-muted-foreground">Supplier Paid</p>
                      <p className="text-sm font-semibold text-foreground">{formatCurrency(thirdCompanySummary.totalPaid)}</p>
                    </div>
                    <div className="rounded-md border border-border/70 bg-muted/20 p-2">
                      <p className="text-xs text-muted-foreground">Supplier Unpaid</p>
                      <p className="text-sm font-semibold text-foreground">{formatCurrency(thirdCompanySummary.totalUnpaid)}</p>
                    </div>
                    <div className="rounded-md border border-border/70 bg-muted/20 p-2">
                      <p className="text-xs text-muted-foreground">Unpaid Teeth</p>
                      <p className="text-sm font-semibold text-foreground">
                        {thirdCompanySummary.unpaidCount} / {thirdCompanySummary.implantCount}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full border border-border/70 bg-muted/20 px-2 py-1 text-muted-foreground">
                      Click chart bars to filter unpaid rows
                    </span>
                    {selectedThirdCompanyAvailability !== 'all' ? (
                      <>
                        <span className="rounded-full border border-orange-300 bg-orange-100 px-2 py-1 font-semibold text-orange-800">
                          Status filter: {toHumanLabel(selectedThirdCompanyAvailability)}
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-[11px]"
                          onClick={() => {
                            setSelectedThirdCompanyAvailability('all');
                          }}
                        >
                          Clear Filter
                        </Button>
                      </>
                    ) : null}
                  </div>
                  {thirdCompanyStatusChart.every((item) => item.unpaid <= 0) ? (
                    <p className="text-sm text-muted-foreground">No unpaid third-company amount right now.</p>
                  ) : (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={thirdCompanyStatusChart}>
                          <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                          <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} />
                          <YAxis
                            yAxisId="amount"
                            tick={{ fill: '#64748b', fontSize: 11 }}
                            tickFormatter={(value) => `AFN ${Number(value).toFixed(0)}`}
                            tickLine={false}
                            width={70}
                          />
                          <YAxis
                            yAxisId="count"
                            orientation="right"
                            tick={{ fill: '#64748b', fontSize: 11 }}
                            tickFormatter={(value) => Number(value).toFixed(0)}
                            tickLine={false}
                            width={52}
                          />
                          <Tooltip
                            formatter={(value, name) => {
                              if (name === 'Implant Teeth') {
                                return [`${Number(value ?? 0).toFixed(0)}`, 'Implant Teeth'];
                              }
                              return [formatCurrency(Number(value ?? 0)), 'Unpaid'];
                            }}
                            labelFormatter={(label) => `Status: ${label}`}
                          />
                          <Legend />
                          <Bar
                            yAxisId="amount"
                            dataKey="unpaid"
                            fill="#f97316"
                            name="Unpaid"
                            onClick={handleThirdCompanyStatusBarClick}
                          />
                          <Bar
                            yAxisId="count"
                            dataKey="count"
                            fill="#0ea5e9"
                            name="Implant Teeth"
                            onClick={handleThirdCompanyStatusBarClick}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/70">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Unpaid Third-Company Payments</CardTitle>
                  <CardDescription>
                    Outstanding amount the clinic still owes to implant supplier.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {selectedThirdCompanyAvailability !== 'all' ? (
                    <p className="mb-2 text-xs text-muted-foreground">
                      Showing only <span className="font-semibold text-foreground">{toHumanLabel(selectedThirdCompanyAvailability)}</span> status.
                    </p>
                  ) : null}
                  {thirdCompanyUnpaidRows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No unpaid supplier balances.</p>
                  ) : (
                    <div className="overflow-x-auto rounded-md border border-border/70">
                      <table className="min-w-full text-xs">
                        <thead className="bg-muted/30">
                          <tr>
                            <th className="px-2 py-2 text-left font-semibold text-foreground">Patient</th>
                            <th className="px-2 py-2 text-left font-semibold text-foreground">Tooth</th>
                            <th className="px-2 py-2 text-left font-semibold text-foreground">Status</th>
                            <th className="px-2 py-2 text-right font-semibold text-foreground">Total</th>
                            <th className="px-2 py-2 text-right font-semibold text-foreground">Paid</th>
                            <th className="px-2 py-2 text-right font-semibold text-foreground">Unpaid</th>
                          </tr>
                        </thead>
                        <tbody>
                          {thirdCompanyUnpaidRows.map((row) => (
                            <tr key={`third-company-unpaid-${row.patientId}-${row.taskId}-${row.toothNumber}`} className="border-t border-border/70">
                              <td className="px-2 py-2 text-muted-foreground">
                                {mergedPatientNameById.get(row.patientId) || `Patient #${row.patientId || '-'}`}
                              </td>
                              <td className="px-2 py-2 text-foreground">{row.toothNumber}</td>
                              <td className="px-2 py-2 text-muted-foreground">{row.availability.replaceAll('_', ' ')}</td>
                              <td className="px-2 py-2 text-right text-foreground">{formatCurrency(row.supplierTotal)}</td>
                              <td className="px-2 py-2 text-right text-foreground">{formatCurrency(row.supplierPaid)}</td>
                              <td className="px-2 py-2 text-right font-semibold text-orange-700">{formatCurrency(row.supplierRemaining)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/70">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Expense Control (Daily + Clinical Buys)</CardTitle>
                  <CardDescription>
                    Includes all tracked daily expenses and clinical buying expenses in the selected range.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-2 md:grid-cols-3">
                    <div className="rounded-md border border-border/70 bg-muted/20 p-2">
                      <p className="text-xs text-muted-foreground">Daily Expenses</p>
                      <p className="text-sm font-semibold text-foreground">{formatCurrency(expenseSummary.daily)}</p>
                    </div>
                    <div className="rounded-md border border-border/70 bg-muted/20 p-2">
                      <p className="text-xs text-muted-foreground">Clinical Buys</p>
                      <p className="text-sm font-semibold text-foreground">{formatCurrency(expenseSummary.clinical)}</p>
                    </div>
                    <div className="rounded-md border border-border/70 bg-muted/20 p-2">
                      <p className="text-xs text-muted-foreground">Total Expenses</p>
                      <p className="text-sm font-semibold text-foreground">{formatCurrency(expenseSummary.total)}</p>
                    </div>
                  </div>

                  {expenseSummary.byCategory.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No expense records in selected range.</p>
                  ) : (
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={expenseSummary.byCategory}>
                          <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                          <XAxis dataKey="category" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} />
                          <YAxis
                            tick={{ fill: '#64748b', fontSize: 11 }}
                            tickFormatter={(value) => `AFN ${Number(value).toFixed(0)}`}
                            tickLine={false}
                            width={70}
                          />
                          <Tooltip formatter={(value) => [formatCurrency(Number(value ?? 0)), 'Expense']} />
                          <Bar dataKey="amount" fill="#ef4444" radius={[8, 8, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/70">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Safe Pickups by Staff</CardTitle>
                  <CardDescription>
                    Shows how much each staff member took from safe in the selected range.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {safePickups.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No safe pickup records in selected range.</p>
                  ) : (
                    safePickups.map((row) => (
                      <div key={`safe-pickup-${row.name}`} className="rounded-md border border-border/70 bg-muted/20 p-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-foreground">{row.name}</p>
                          <p className="font-semibold text-foreground">{formatCurrency(row.amount)}</p>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/70">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Salary Payments</CardTitle>
                  <CardDescription>
                    Salary records paid in selected date range.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="rounded-md border border-border/70 bg-muted/20 p-2 text-xs">
                    <p className="text-muted-foreground">Records: {salarySummary.records}</p>
                    <p className="font-semibold text-foreground">Paid Amount: {formatCurrency(salarySummary.paid)}</p>
                  </div>
                  {salaryRows.filter((row) => inRange(row.paymentDate, startDate, endDate)).slice(0, 10).map((row) => (
                    <div key={`salary-row-${row.id}`} className="rounded-md border border-border/70 bg-muted/20 p-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-foreground">{row.staffName || `Staff #${row.staffId}`}</p>
                        <Badge variant="outline">{row.status}</Badge>
                      </div>
                      <p className="text-muted-foreground">Date: {formatFullDate(row.paymentDate)}</p>
                      <p className="font-semibold text-foreground">{formatCurrency(row.netAmount)}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-border/70">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Receivables Aging</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full border border-border/70 bg-muted/20 px-2 py-1 text-muted-foreground">
                      Click bars to filter outstanding invoices
                    </span>
                    {selectedDebtAgingBucket !== 'all' ? (
                      <>
                        <span className="rounded-full border border-amber-300 bg-amber-100 px-2 py-1 font-semibold text-amber-800">
                          Aging filter: {selectedDebtAgingBucket}
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-[11px]"
                          onClick={() => {
                            setSelectedDebtAgingBucket('all');
                          }}
                        >
                          Clear Filter
                        </Button>
                      </>
                    ) : null}
                  </div>
                  {debtAging.every((item) => item.amount <= 0) ? (
                    <p className="text-sm text-muted-foreground">No outstanding debt at the moment.</p>
                  ) : (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={debtAging}>
                          <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                          <XAxis dataKey="bucket" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} />
                          <YAxis
                            tick={{ fill: '#64748b', fontSize: 11 }}
                            tickFormatter={(value) => `AFN ${Number(value).toFixed(0)}`}
                            tickLine={false}
                            width={70}
                          />
                          <Tooltip formatter={(value) => [formatCurrency(Number(value ?? 0)), 'Outstanding']} />
                          <Bar dataKey="amount" fill="#f97316" radius={[8, 8, 0, 0]} onClick={handleDebtAgingBarClick} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/70">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Highest Outstanding Invoices</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {selectedDebtAgingBucket !== 'all' ? (
                    <p className="text-xs text-muted-foreground">
                      Filtered by aging bucket: <span className="font-semibold text-foreground">{selectedDebtAgingBucket}</span>
                    </p>
                  ) : null}
                  {outstandingInvoices.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No outstanding invoices.</p>
                  ) : (
                    outstandingInvoices.map((invoice) => (
                      <div key={`outstanding-${invoice.id}`} className="rounded-md border border-border/70 bg-muted/20 p-2 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold text-foreground">Invoice #{invoice.id}</p>
                          <Badge variant="outline">{invoice.status || 'unknown'}</Badge>
                        </div>
                        <p className="text-muted-foreground">
                          Date: {formatFullDate(invoice.date)} | Net: {formatCurrency(invoice.net)} | Paid: {formatCurrency(invoice.paid)}
                        </p>
                        <p className="text-muted-foreground">
                          Patient: {mergedPatientNameById.get(invoice.patientId) || `Patient #${invoice.patientId || '-'}`}
                        </p>
                        <p className="font-semibold text-foreground">Debt: {formatCurrency(invoice.debt)}</p>
                        {invoice.patientId ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="mt-1 h-7 px-2 text-[11px]"
                            onClick={() => {
                              setSelectedPatientLedgerId(invoice.patientId);
                            }}
                          >
                            Open Patient Ledger
                          </Button>
                        ) : null}
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/70">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Cash Flow by {granularity}</CardTitle>
                </CardHeader>
                <CardContent>
                  {cashFlowTrend.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No cash flow data in selected range.</p>
                  ) : (
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={cashFlowTrend}>
                          <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                          <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} />
                          <YAxis
                            tick={{ fill: '#64748b', fontSize: 11 }}
                            tickFormatter={(value) => `AFN ${Number(value).toFixed(0)}`}
                            tickLine={false}
                            width={70}
                          />
                          <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0))} />
                          <Legend />
                          <Bar dataKey="billed" fill="#0ea5e9" name="Billed" />
                          <Bar dataKey="paid" fill="#22c55e" name="Paid" />
                          <Bar dataKey="debt" fill="#f97316" name="Debt" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
                <Card className="border-border/70">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Payment Method Mix</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {paymentMethodMix.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No payment method data in selected range.</p>
                    ) : (
                      paymentMethodMix.map((item) => (
                        <div key={`payment-method-${item.method}`} className="rounded-md border border-border/70 bg-muted/20 p-2 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-semibold text-foreground">{item.method.replaceAll('_', ' ')}</p>
                            <p className="text-muted-foreground">{item.count} payments</p>
                          </div>
                          <p className="font-semibold text-foreground">{formatCurrency(item.amount)}</p>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                <Card className="border-border/70">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Ledger Balance Trend ({selectedPatientName})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {ledgerRowsFilteredByPatient.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No ledger entries in selected range.</p>
                    ) : (
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={ledgerRowsFilteredByPatient}>
                            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                            <XAxis
                              dataKey="date"
                              tick={{ fill: '#64748b', fontSize: 11 }}
                              tickFormatter={(value) => formatShortDate(String(value))}
                              tickLine={false}
                            />
                            <YAxis
                              tick={{ fill: '#64748b', fontSize: 11 }}
                              tickFormatter={(value) => `AFN ${Number(value).toFixed(0)}`}
                              tickLine={false}
                              width={70}
                            />
                            <Tooltip
                              formatter={(value) => [formatCurrency(Number(value ?? 0)), 'Balance']}
                              labelFormatter={(value) => `Date: ${formatFullDate(String(value))}`}
                            />
                            <Line dataKey="balance" stroke="#6366f1" strokeWidth={2} dot={false} name="Balance" />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card className="border-border/70">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Receivables Ledger</CardTitle>
                  <CardDescription>
                    Opening balance + invoice debits + payment credits with running balance.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                    <select
                      value={selectedPatientLedgerId}
                      onChange={(event) => {
                        setSelectedPatientLedgerId(event.target.value);
                      }}
                      className="h-9 rounded-md border border-input bg-background px-2 text-xs"
                    >
                      <option value="all">All patients</option>
                      {typedPatients.map((patient) => (
                        <option key={`ledger-patient-${patient.id}`} value={String(patient.id)}>
                          {[patient.firstName, patient.lastName].filter(Boolean).join(' ') || patient.patientCode || `Patient #${patient.id}`}
                        </option>
                      ))}
                    </select>
                    {selectedPatientLedgerId !== 'all' ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedPatientLedgerId('all');
                        }}
                      >
                        Reset Filter
                      </Button>
                    ) : null}
                  </div>
                  <div className="rounded-md border border-border/70 bg-muted/20 p-2 text-xs">
                    <p className="text-muted-foreground">Opening Balance</p>
                    <p className="font-semibold text-foreground">{formatCurrency(ledgerRows.openingBalance)}</p>
                    <p className="text-muted-foreground">Ledger Scope: {selectedPatientName}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2 py-1 text-amber-800">
                      <span className="size-2 rounded-full bg-amber-500" />
                      Invoice Debit
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-100 px-2 py-1 text-emerald-800">
                      <span className="size-2 rounded-full bg-emerald-500" />
                      Payment Credit
                    </span>
                  </div>

                  {ledgerRowsFilteredByPatient.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No ledger entries in selected range.</p>
                  ) : (
                    <div className="overflow-x-auto rounded-md border border-border/70">
                      <table className="min-w-full text-xs">
                        <thead className="bg-muted/30">
                          <tr>
                            <th className="px-2 py-2 text-left font-semibold text-foreground">Date</th>
                            <th className="px-2 py-2 text-left font-semibold text-foreground">Type</th>
                            <th className="px-2 py-2 text-left font-semibold text-foreground">Patient</th>
                            <th className="px-2 py-2 text-left font-semibold text-foreground">Invoice</th>
                            <th className="px-2 py-2 text-left font-semibold text-foreground">Method</th>
                            <th className="px-2 py-2 text-right font-semibold text-foreground">Debit</th>
                            <th className="px-2 py-2 text-right font-semibold text-foreground">Credit</th>
                            <th className="px-2 py-2 text-right font-semibold text-foreground">Balance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ledgerRowsFilteredByPatient.map((entry) => {
                            const typeStyle = ledgerTypeStyles[entry.type] ?? ledgerTypeStyles.invoice;
                            return (
                              <tr
                                key={`ledger-${entry.type}-${entry.invoiceId}-${entry.date}-${entry.debit}-${entry.credit}`}
                                className={`border-t border-border/70 ${typeStyle.rowClass}`}
                              >
                              <td className="px-2 py-2 text-muted-foreground">{formatFullDate(entry.date)}</td>
                              <td className="px-2 py-2">
                                <Badge variant="outline" className={typeStyle.badgeClass}>
                                  <span className={`me-1 inline-flex size-2 rounded-full ${typeStyle.dotClass}`} />
                                  {typeStyle.label}
                                </Badge>
                              </td>
                              <td className="px-2 py-2 text-muted-foreground">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (entry.patientId) {
                                      setSelectedPatientLedgerId(entry.patientId);
                                    }
                                  }}
                                  className="underline decoration-dotted underline-offset-2 hover:text-foreground"
                                >
                                  {mergedPatientNameById.get(entry.patientId) || `Patient #${entry.patientId || '-'}`}
                                </button>
                              </td>
                              <td className="px-2 py-2 text-muted-foreground">#{entry.invoiceId || '-'}</td>
                              <td className="px-2 py-2 text-muted-foreground">{entry.method.replaceAll('_', ' ')}</td>
                              <td className={`px-2 py-2 text-right ${entry.debit > 0 ? typeStyle.debitClass : 'text-muted-foreground'}`}>
                                {entry.debit > 0 ? formatCurrency(entry.debit) : '-'}
                              </td>
                              <td className={`px-2 py-2 text-right ${entry.credit > 0 ? typeStyle.creditClass : 'text-muted-foreground'}`}>
                                {entry.credit > 0 ? formatCurrency(entry.credit) : '-'}
                              </td>
                              <td className="px-2 py-2 text-right font-semibold text-foreground">{formatCurrency(entry.balance)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="clinical" className="space-y-4">
              <Card className="border-border/70">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Treatment Volume and Revenue</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {treatmentVolume.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No treatment activity in selected range.</p>
                  ) : (
                    treatmentVolume.map((item) => (
                      <div key={`treatment-volume-${item.name}`} className="rounded-md border border-border/70 bg-muted/20 p-2 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold text-foreground">{item.name}</p>
                          <p className="text-muted-foreground">{item.sessions} sessions</p>
                        </div>
                        <p className="font-semibold text-foreground">Revenue: {formatCurrency(item.revenue)}</p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="operations" className="space-y-4">
              <Card className="border-border/70">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Appointment Status Distribution</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {appointmentStatus.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No appointments in selected range.</p>
                  ) : (
                    appointmentStatus.map((item) => (
                      <Badge key={`appointment-status-${item.status}`} variant="secondary">
                        {item.status.replaceAll('_', ' ')}: {item.count}
                      </Badge>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/70">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Dentist Productivity</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {dentistProductivity.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No dentist activity in selected range.</p>
                  ) : (
                    dentistProductivity.map((item) => (
                      <div key={`dentist-productivity-${item.dentist}`} className="rounded-md border border-border/70 bg-muted/20 p-2 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold text-foreground">{item.dentist}</p>
                          <p className="text-muted-foreground">{item.visits} visits</p>
                        </div>
                        <p className="font-semibold text-foreground">Revenue: {formatCurrency(item.revenue)}</p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </>
  );
}
