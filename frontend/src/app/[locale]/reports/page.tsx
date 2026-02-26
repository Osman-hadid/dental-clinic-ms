'use client';

import { JSX, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
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
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type ReportGranularity = 'day' | 'month' | 'week';
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

type DebtAgingPoint = {
  amount: number;
  bucket: string;
};

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
    currency: 'USD',
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
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

const escapeHtml = (value: unknown): string => {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
};

const startOfWeek = (date: Date): Date => {
  const copy = new Date(date);
  const day = copy.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + offset);
  copy.setHours(0, 0, 0, 0);
  return copy;
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

  if (granularity === 'week') {
    const weekStart = startOfWeek(date);
    return {
      key: toInputDate(weekStart),
      label: `Week of ${formatShortDate(toInputDate(weekStart))}`,
      sort: weekStart.getTime(),
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

// eslint-disable-next-line react/function-component-definition
export default function ReportsPage(): JSX.Element {
  const tSidebar = useTranslations('sidebar');
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
  const [activeTab, setActiveTab] = useState<'clinical' | 'financial' | 'operations' | 'overview'>('overview');
  const [selectedPatientLedgerId, setSelectedPatientLedgerId] = useState<string>('all');
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
  const [isLoadingFinanceData, setIsLoadingFinanceData] = useState(false);

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

  const fetchFinanceData = useCallback(async (): Promise<void> => {
    setIsLoadingFinanceData(true);
    try {
      const [expenseItems, safeItems, salaryItems] = await Promise.all([
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
      ]);

      setExpenseRows(expenseItems.map((row) => ({
        amount: parseAmount(row.amount),
        amountInput: parseAmount(row.amountInput ?? row.amount_input ?? row.amount),
        category: asText(row.category) || 'Other',
        currency: asText(row.currency).toUpperCase() || 'USD',
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
          currency: asText(row.currency).toUpperCase() || 'USD',
          direction: asText(row.direction),
          exchangeRate: parseAmount(row.exchangeRate ?? row.exchange_rate ?? 1) || 1,
          entryType: asText(row.entryType ?? row.entry_type),
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
          currency: asText(row.currency).toUpperCase() || 'USD',
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
      const currency = asText(invoiceRow.currency).toUpperCase() || 'USD';
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
            currency: asText(paymentRow.currency).toUpperCase() || currency,
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
        currency,
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
    typedPatients.length,
  ]);

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
    const end = parseDate(endDate) ?? new Date();
    const buckets: Record<string, number> = {
      '0-30 days': 0,
      '31-60 days': 0,
      '61-90 days': 0,
      '90+ days': 0,
    };

    parsedData.allInvoices.forEach((invoice) => {
      if (invoice.debt <= 0) return;
      const date = parseDate(invoice.date);
      if (!date) return;
      const ageDays = Math.max(0, Math.floor((end.getTime() - date.getTime()) / MS_PER_DAY));

      if (ageDays <= 30) {
        buckets['0-30 days'] += invoice.debt;
      } else if (ageDays <= 60) {
        buckets['31-60 days'] += invoice.debt;
      } else if (ageDays <= 90) {
        buckets['61-90 days'] += invoice.debt;
      } else {
        buckets['90+ days'] += invoice.debt;
      }
    });

    return Object.entries(buckets).map(([bucket, amount]) => ({
      amount: Number(amount.toFixed(2)),
      bucket,
    }));
  }, [endDate, parsedData.allInvoices]);

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

    return patientNameById.get(selectedPatientLedgerId) || `Patient #${selectedPatientLedgerId}`;
  }, [patientNameById, selectedPatientLedgerId]);

  const outstandingInvoices = useMemo(
    () =>
      parsedData.allInvoices
        .filter((invoice) => invoice.debt > 0)
        .sort((left, right) => right.debt - left.debt)
        .slice(0, 20),
    [parsedData.allInvoices]
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
      financial: 'Financial Reports',
      operations: 'Operations Reports',
      overview: 'Overview Reports',
    } as const;

    const formatRow = (label: string, value: string): string => `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`;
    const summaryRows = [
      formatRow('Date Range', `${startDate} to ${endDate}`),
      formatRow('Granularity', granularity),
      formatRow('Invoice Status Filter', statusFilter),
      formatRow('Reporting Currency', 'USD (base) with original transaction currency columns'),
      formatRow('Billed', formatCurrency(kpis.billed)),
      formatRow('Discount', formatCurrency(kpis.discount)),
      formatRow('Net', formatCurrency(kpis.net)),
      formatRow('Paid', formatCurrency(kpis.paid)),
      formatRow('Debt', formatCurrency(kpis.debt)),
      formatRow('Expenses', formatCurrency(kpis.expenses)),
      formatRow('Net After Expenses', formatCurrency(kpis.netAfterExpenses)),
      formatRow('Safe Outflow', formatCurrency(kpis.safeOut)),
      formatRow('Salaries Paid', formatCurrency(kpis.salaryPaid)),
      formatRow('Collection Rate', `${kpis.collectionRate}%`),
    ].join('');

    const totalOutcome = Number((kpis.expenses + kpis.salaryPaid).toFixed(2));
    const profitOrLoss = Number((kpis.paid - totalOutcome).toFixed(2));
    const maxBar = Math.max(kpis.paid, totalOutcome, 1);
    const paidBarWidth = Math.min(100, (kpis.paid / maxBar) * 100);
    const outcomeBarWidth = Math.min(100, (totalOutcome / maxBar) * 100);
    const profitBarWidth = Math.min(100, (Math.abs(profitOrLoss) / maxBar) * 100);
    const currencyMix = filteredInvoices.reduce<Record<string, number>>((acc, invoice) => {
      const key = invoice.currency || 'USD';
      acc[key] = Number(((acc[key] ?? 0) + invoice.netInput).toFixed(2));
      return acc;
    }, {});
    const currencyMixRows = Object.entries(currencyMix)
      .map(([currency, amount]) => `<tr><td>${escapeHtml(currency)}</td><td>${escapeHtml(amount.toFixed(2))}</td></tr>`)
      .join('');
    const profitLossSection = `
      <h3>Profit / Loss Visual</h3>
      <div class="bar-wrap"><span>Income (Paid)</span><div class="bar bg-blue"><i style="width:${paidBarWidth}%"></i></div><b>${escapeHtml(formatCurrency(kpis.paid))}</b></div>
      <div class="bar-wrap"><span>Outcome (Expenses + Salaries)</span><div class="bar bg-orange"><i style="width:${outcomeBarWidth}%"></i></div><b>${escapeHtml(formatCurrency(totalOutcome))}</b></div>
      <div class="bar-wrap"><span>${profitOrLoss >= 0 ? 'Profit' : 'Loss'}</span><div class="bar ${profitOrLoss >= 0 ? 'bg-emerald' : 'bg-red'}"><i style="width:${profitBarWidth}%"></i></div><b>${escapeHtml(formatCurrency(profitOrLoss))}</b></div>
      <h3>Invoice Currency Mix</h3>
      <table><thead><tr><th>Currency</th><th>Amount (Input Currency)</th></tr></thead><tbody>${currencyMixRows || '<tr><td colspan="2">No data</td></tr>'}</tbody></table>
    `;

    let bodySections = '';
    if (activeTab === 'overview') {
      bodySections = `
        ${profitLossSection}
        <h3>Income Trend</h3>
        <table><thead><tr><th>Bucket</th><th>Income</th><th>Payments</th></tr></thead><tbody>
          ${incomeTrend.map((point) => `<tr><td>${escapeHtml(point.label)}</td><td>${escapeHtml(formatCurrency(point.income))}</td><td>${point.paymentCount}</td></tr>`).join('')}
        </tbody></table>
      `;
    }
    if (activeTab === 'financial') {
      bodySections = `
        ${profitLossSection}
        <h3>Expense Summary</h3>
        <table><thead><tr><th>Category</th><th>Amount</th></tr></thead><tbody>
          ${expenseSummary.byCategory.map((row) => `<tr><td>${escapeHtml(row.category)}</td><td>${escapeHtml(formatCurrency(row.amount))}</td></tr>`).join('')}
        </tbody></table>
        <h3>Invoice Currency Details</h3>
        <table><thead><tr><th>Invoice</th><th>Currency</th><th>Total (Input)</th><th>Net (Input)</th><th>Exchange Rate</th><th>Net (USD)</th></tr></thead><tbody>
          ${filteredInvoices.map((invoice) => `<tr><td>#${escapeHtml(invoice.id)}</td><td>${escapeHtml(invoice.currency)}</td><td>${escapeHtml(invoice.totalInput.toFixed(2))}</td><td>${escapeHtml(invoice.netInput.toFixed(2))}</td><td>${escapeHtml(invoice.exchangeRate.toFixed(6))}</td><td>${escapeHtml(formatCurrency(invoice.net))}</td></tr>`).join('')}
        </tbody></table>
        <h3>Safe Pickups</h3>
        <table><thead><tr><th>Staff</th><th>Amount</th></tr></thead><tbody>
          ${safePickups.map((row) => `<tr><td>${escapeHtml(row.name)}</td><td>${escapeHtml(formatCurrency(row.amount))}</td></tr>`).join('')}
        </tbody></table>
        <h3>Ledger (${escapeHtml(selectedPatientName)})</h3>
        <table><thead><tr><th>Date</th><th>Type</th><th>Invoice</th><th>Method</th><th>Debit</th><th>Credit</th><th>Balance</th></tr></thead><tbody>
          ${ledgerRowsFilteredByPatient.map((entry) => `<tr><td>${escapeHtml(formatFullDate(entry.date))}</td><td>${escapeHtml(entry.type)}</td><td>#${escapeHtml(entry.invoiceId)}</td><td>${escapeHtml(entry.method)}</td><td>${entry.debit > 0 ? escapeHtml(formatCurrency(entry.debit)) : '-'}</td><td>${entry.credit > 0 ? escapeHtml(formatCurrency(entry.credit)) : '-'}</td><td>${escapeHtml(formatCurrency(entry.balance))}</td></tr>`).join('')}
        </tbody></table>
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
      .bg-blue i{background:#2563eb}
      .bg-orange i{background:#f97316}
      .bg-emerald i{background:#16a34a}
      .bg-red i{background:#dc2626}
    </style></head><body>
      <h1>${escapeHtml(titleByTab[activeTab])}</h1>
      <p>Generated at: ${escapeHtml(formatFullDate(new Date().toISOString()))}</p>
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

      <div className="flex flex-1 flex-col px-4 pb-6 lg:px-6">
        <div className="flex flex-col gap-4 py-4">
          <Card className="border-border/70 bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Report Controls</CardTitle>
              <CardDescription>
                Standard reporting controls for financial, clinical, and operational insights.
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
                  <option value="day">Daily trend</option>
                  <option value="week">Weekly trend</option>
                  <option value="month">Monthly trend</option>
                </select>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as InvoiceStatusFilter)}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="all">All invoice statuses</option>
                  <option value="unpaid">Unpaid</option>
                  <option value="partially_paid">Partially paid</option>
                  <option value="paid">Paid</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    downloadCsv(
                      `financial-report-${startDate}-to-${endDate}.csv`,
                      filteredInvoices.map((invoice) => ({
                        currency: invoice.currency,
                        debt: invoice.debt.toFixed(2),
                        discount: invoice.discount.toFixed(2),
                        discountInput: invoice.discountInput.toFixed(2),
                        exchangeRate: invoice.exchangeRate.toFixed(6),
                        invoiceDate: invoice.date,
                        invoiceId: invoice.id,
                        net: invoice.net.toFixed(2),
                        netInput: invoice.netInput.toFixed(2),
                        paid: invoice.paid.toFixed(2),
                        status: invoice.status,
                        total: invoice.total.toFixed(2),
                        totalInput: invoice.totalInput.toFixed(2),
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
                        bucket: point.label,
                        income: point.income.toFixed(2),
                        paymentCount: point.paymentCount,
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
                        balance: ledgerRows.openingBalance.toFixed(2),
                        credit: '0.00',
                        date: startDate,
                        debit: '0.00',
                        invoiceId: '-',
                        label: 'Opening Balance',
                        method: '-',
                        type: 'opening',
                      },
                      ...ledgerRows.inRangeEntries.map((entry) => ({
                        balance: entry.balance.toFixed(2),
                        credit: entry.credit.toFixed(2),
                        date: entry.date,
                        debit: entry.debit.toFixed(2),
                        invoiceId: entry.invoiceId,
                        label: entry.label,
                        method: entry.method,
                        type: entry.type,
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
                        amount: row.amount.toFixed(2),
                        amountInput: row.amountInput.toFixed(2),
                        category: row.category,
                        currency: row.currency,
                        date: row.expenseDate,
                        exchangeRate: row.exchangeRate.toFixed(6),
                        expenseType: row.expenseType,
                        id: row.id,
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
                        amount: row.amount.toFixed(2),
                        amountInput: row.amountInput.toFixed(2),
                        currency: row.currency,
                        date: row.transactionDate,
                        direction: row.direction,
                        exchangeRate: row.exchangeRate.toFixed(6),
                        entryType: row.entryType,
                        pickedBy: row.pickedByStaffName || row.pickedByStaffId || '-',
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
                        currency: row.currency,
                        exchangeRate: row.exchangeRate.toFixed(6),
                        netAmount: row.netAmount.toFixed(2),
                        netAmountInput: row.netAmountInput.toFixed(2),
                        paymentDate: row.paymentDate,
                        staff: row.staffName || row.staffId,
                        status: row.status,
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
                        activePatients: snapshot.activePatients,
                        appointmentCompletionRate: snapshot.appointmentCompletionRate,
                        appointments: snapshot.appointments,
                        billed: snapshot.billed.toFixed(2),
                        collectionRate: snapshot.collectionRate,
                        debt: snapshot.debt.toFixed(2),
                        discount: snapshot.discount.toFixed(2),
                        generatedAt: snapshot.generatedAt,
                        granularity: snapshot.granularity,
                        net: snapshot.net.toFixed(2),
                        paid: snapshot.paid.toFixed(2),
                        rangeEnd: snapshot.rangeEnd,
                        rangeStart: snapshot.rangeStart,
                        statusFilter: snapshot.statusFilter,
                        visits: snapshot.visits,
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
            </CardContent>
          </Card>

          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)} className="space-y-3">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="financial">Financial</TabsTrigger>
              <TabsTrigger value="clinical">Clinical</TabsTrigger>
              <TabsTrigger value="operations">Operations</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
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
                    <p className="text-xs text-muted-foreground">Safe outflow: {formatCurrency(kpis.safeOut)} | Salaries: {formatCurrency(kpis.salaryPaid)}</p>
                    <p className="text-xs text-muted-foreground">Net after expenses: {formatCurrency(kpis.netAfterExpenses)}</p>
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
                      <p className="text-xs text-muted-foreground">Operational net cash: {formatCurrency(kpis.netAfterExpenses)}</p>
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
                            tickFormatter={(value) => `$${Number(value).toFixed(0)}`}
                            tickLine={false}
                            width={70}
                          />
                          <Tooltip
                            formatter={(value: number) => [formatCurrency(Number(value)), 'Income']}
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
                            tickFormatter={(value) => `$${Number(value).toFixed(0)}`}
                            tickLine={false}
                            width={70}
                          />
                          <Tooltip formatter={(value: number) => [formatCurrency(Number(value)), 'Expense']} />
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
                <CardContent>
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
                            tickFormatter={(value) => `$${Number(value).toFixed(0)}`}
                            tickLine={false}
                            width={70}
                          />
                          <Tooltip formatter={(value: number) => [formatCurrency(Number(value)), 'Outstanding']} />
                          <Bar dataKey="amount" fill="#f97316" radius={[8, 8, 0, 0]} />
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
                          Patient: {patientNameById.get(invoice.patientId) || `Patient #${invoice.patientId || '-'}`}
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
                            tickFormatter={(value) => `$${Number(value).toFixed(0)}`}
                            tickLine={false}
                            width={70}
                          />
                          <Tooltip formatter={(value: number) => formatCurrency(Number(value))} />
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
                              tickFormatter={(value) => `$${Number(value).toFixed(0)}`}
                              tickLine={false}
                              width={70}
                            />
                            <Tooltip
                              formatter={(value: number) => [formatCurrency(Number(value)), 'Balance']}
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
                          {ledgerRowsFilteredByPatient.map((entry) => (
                            <tr key={`ledger-${entry.type}-${entry.invoiceId}-${entry.date}-${entry.debit}-${entry.credit}`} className="border-t border-border/70">
                              <td className="px-2 py-2 text-muted-foreground">{formatFullDate(entry.date)}</td>
                              <td className="px-2 py-2">
                                <Badge variant={entry.type === 'invoice' ? 'outline' : 'secondary'}>
                                  {entry.type}
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
                                  {patientNameById.get(entry.patientId) || `Patient #${entry.patientId || '-'}`}
                                </button>
                              </td>
                              <td className="px-2 py-2 text-muted-foreground">#{entry.invoiceId || '-'}</td>
                              <td className="px-2 py-2 text-muted-foreground">{entry.method.replaceAll('_', ' ')}</td>
                              <td className="px-2 py-2 text-right text-foreground">{entry.debit > 0 ? formatCurrency(entry.debit) : '-'}</td>
                              <td className="px-2 py-2 text-right text-foreground">{entry.credit > 0 ? formatCurrency(entry.credit) : '-'}</td>
                              <td className="px-2 py-2 text-right font-semibold text-foreground">{formatCurrency(entry.balance)}</td>
                            </tr>
                          ))}
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
