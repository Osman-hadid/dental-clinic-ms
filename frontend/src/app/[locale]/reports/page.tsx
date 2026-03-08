'use client';

import { JSX, useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Header } from '@/components/header';
import { LoadingState } from '@/components/shared/loading-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuthStore } from '@/modules/auth/application/stores/auth-store';
import { AxiosClient } from '@/modules/common/infrastructure/api/axios-client';
import { fetchAllRows } from '@/modules/common/infrastructure/api/fetch-all-rows';
import { parseApiError } from '@/modules/common/utils/http-error-utilities';
import { type Appointment } from '@/modules/dental-management/domain/entities/Appointment';
import { type Patient } from '@/modules/dental-management/domain/entities/Patient';
import { type Visit } from '@/modules/dental-management/domain/entities/Visit';
import { type VisitTreatment } from '@/modules/dental-management/domain/entities/VisitTreatment';
import {
  aggregateImplantSupplierBalances,
  type ImplantAvailabilityStatus,
  type ImplantSupplierTaskLike,
  parseAvailabilityFromTaskNotes,
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
import { toast } from 'sonner';

type ReportGranularity = 'day' | 'month' | 'year';
type InvoiceStatusFilter = 'all' | 'cancelled' | 'paid' | 'partially_paid' | 'unpaid';
type ReportStatusFilter = 'all' | 'cancelled' | 'completed' | 'pending';
type ReportExportFormat = 'csv' | 'pdf';
type CsvExportType =
  | 'audit_log'
  | 'clinical_treatment'
  | 'executive_summary'
  | 'financial_daily_safe'
  | 'financial_implant_installment'
  | 'financial_outstanding'
  | 'financial_shareholder'
  | 'financial_revenue'
  | 'inventory_stock';

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
  statusFilter: ReportStatusFilter;
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

type ShareholderReportRow = {
  balanceAmount: number;
  contributedAmount: number;
  distributedAmount: number;
  fullName: string;
  id: string;
  initialCapitalInput: number;
  ownershipPercentage: number;
  status: string;
};

type ShareholderTransactionReportRow = {
  amount: number;
  amountInput: number;
  id: string;
  notes: string;
  shareholderId: string;
  shareholderName: string;
  transactionDate: string;
  transactionType: 'contribution' | 'distribution';
};

type ThirdCompanyLiabilityStatusPoint = {
  count: number;
  label: string;
  status: ImplantAvailabilityStatus;
  unpaid: number;
};

type InventoryReportRow = {
  acquisitionSource: 'previous_stock' | 'purchase';
  category: string;
  entryDate: string;
  expiryDate: string;
  id: string;
  itemName: string;
  lotNumber: string;
  minStock: number;
  quantity: number;
  sellingPrice: number;
  supplier: string;
  totalCost: number;
  unit: string;
  unitCost: number;
  updatedAt: string;
};

type InventoryUsageReportRow = {
  inventoryItemId: string;
  itemName: string;
  patientId: string;
  patientName: string;
  quantityUsed: number;
  treatmentName: string;
  unit: string;
  usedOn: string;
  visitLabel: string;
};

type VisitTreatmentReportRow = VisitTreatment & {
  materialItems?: Array<Record<string, unknown>>;
  prescription?: VisitTreatment['prescription'];
  treatment?: { category?: string; name?: string };
  visit?: { dentistName?: string; visitDate?: string };
};

type FinancialModificationLogRow = {
  action: string;
  afterValue: string;
  beforeValue: string;
  changedBy: string;
  entity: string;
  timestamp: string;
};

type ExecutiveSummaryKpis = {
  activePatients: number;
  appointmentCompletionRate: number;
  appointments: number;
  billed: number;
  collectionRate: number;
  debt: number;
  discount: number;
  expenses: number;
  net: number;
  netAfterExpenses: number;
  paid: number;
  safeOut: number;
  salaryPaid: number;
  thirdCompanyPaid: number;
  thirdCompanyTotal: number;
  thirdCompanyUnpaid: number;
  thirdCompanyUnpaidCount: number;
  totalPatients: number;
  visits: number;
};

type ExecutiveSummaryResponse = {
  bankBalance: number;
  cashInSafe: number;
  chairUtilizationRate: number;
  dentistProductivity: DentistProductivityPoint[];
  expenseSummary: {
    byCategory: ExpensePoint[];
    clinical: number;
    daily: number;
    total: number;
  };
  filterOptions: {
    dentists: string[];
    patients: Array<{ id: string; name: string }>;
    paymentMethods: string[];
    treatments: string[];
  };
  implantPlacementTrend: Array<{ count: number; key: string; label: string; revenue: number }>;
  implantRevenue: number;
  kpis: ExecutiveSummaryKpis;
  newPatientsCount: number;
  profitLoss: number;
  profitLossTrend: ProfitLossPoint[];
  revenueTrendMonthly: Array<{ amount: number; key: string; label: string }>;
  treatmentAcceptanceRate: number;
  treatmentVolume: TreatmentVolumePoint[];
};

type ClinicalDatasetResponse = {
  appointments: Appointment[];
  patientNameMap: Record<string, string>;
  patientSessionTasks: ImplantSupplierTaskLike[];
  patients: Patient[];
  visitTreatments: VisitTreatmentReportRow[];
  visits: Visit[];
};

type FinancialDatasetResponse = {
  expenseRows: ExpenseRow[];
  invoiceRows: Array<Record<string, unknown>>;
  patientNameMap: Record<string, string>;
  patientSessionTasks: ImplantSupplierTaskLike[];
  patients: Patient[];
  safeRows: SafeTransactionRow[];
  salaryRows: SalaryPaymentRow[];
  shareholderRows: ShareholderReportRow[];
  shareholderTransactionRows: ShareholderTransactionReportRow[];
  visitTreatmentRows: VisitTreatmentReportRow[];
  visits: Visit[];
};

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const REPORT_SNAPSHOT_KEY = 'dental_reports_snapshots';
const REPORT_SCHEDULE_KEY = 'dental_reports_schedule';
const apiClient = new AxiosClient();
const EMPTY_APPOINTMENTS: Appointment[] = [];
const EMPTY_VISITS: Visit[] = [];
const EMPTY_VISIT_TREATMENTS: VisitTreatmentReportRow[] = [];
const EMPTY_EXPENSE_ROWS: ExpenseRow[] = [];
const EMPTY_IMPLANT_TASKS: ImplantSupplierTaskLike[] = [];
const EMPTY_INVENTORY_ROWS: InventoryReportRow[] = [];
const EMPTY_FINANCIAL_MODIFICATION_LOG_ROWS: FinancialModificationLogRow[] = [];
const EMPTY_ACCESS_LOG_ROWS: Array<{ action: string; generatedAt: string; range: string; user: string }> = [];
const EMPTY_SHAREHOLDER_TRANSACTION_ROWS: ShareholderTransactionReportRow[] = [];
const EMPTY_PARSED_PAYMENTS: ParsedPayment[] = [];
const EMPTY_PARSED_INVOICES: ParsedInvoice[] = [];
const EMPTY_LEDGER_ENTRIES: LedgerEntry[] = [];
const EMPTY_PARSED_DATA: {
  allInvoices: ParsedInvoice[];
  allPayments: ParsedPayment[];
  ledgerEntries: LedgerEntry[];
} = {
  allInvoices: EMPTY_PARSED_INVOICES,
  allPayments: EMPTY_PARSED_PAYMENTS,
  ledgerEntries: EMPTY_LEDGER_ENTRIES,
};

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

const formatCsvAmount = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
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

const toReportStatus = (value: string): ReportStatusFilter => {
  const normalized = value.toLowerCase();
  if (normalized === 'cancelled') return 'cancelled';
  if (normalized === 'paid' || normalized === 'completed' || normalized === 'done') return 'completed';
  return 'pending';
};

const escapeHtml = (value: unknown): string => {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
};

const PRESCRIPTION_FOOD_TIMING_LABELS: Record<'after_food' | 'anytime' | 'before_food' | 'with_food', string> = {
  after_food: 'After food',
  anytime: 'Anytime',
  before_food: 'Before food',
  with_food: 'With food',
};

const formatPrescriptionSummary = (prescription?: VisitTreatment['prescription']): string => {
  if (!prescription) return '-';

  const formatSingle = (source: Partial<{
    amount: string;
    foodTiming: string;
    frequency: string;
    name: string;
  }>): string => {
    const name = asText(source.name);
    const amount = asText(source.amount);
    const frequency = asText(source.frequency);
    const foodTimingKey = asText(source.foodTiming) as keyof typeof PRESCRIPTION_FOOD_TIMING_LABELS;
    const foodTiming = PRESCRIPTION_FOOD_TIMING_LABELS[foodTimingKey] ?? asText(source.foodTiming);

    if (!name && !amount && !frequency && !foodTiming) {
      return '';
    }

    const dose = amount;
    const parts = [
      name ? (dose ? `${name} (${dose})` : name) : dose,
      frequency,
      foodTiming,
    ].filter(Boolean);

    return parts.join(', ');
  };

  if (Array.isArray(prescription.items) && prescription.items.length > 0) {
    const rows = prescription.items
      .map((item) => formatSingle(item))
      .filter(Boolean);
    if (rows.length > 0) {
      return rows.join('; ');
    }
  }

  const single = formatSingle({
    amount: prescription.amount,
    foodTiming: prescription.foodTiming,
    frequency: prescription.frequency,
    name: prescription.name,
  });

  if (single !== '') {
    return single;
  }

  return asText(prescription.content) || '-';
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
  const normalizeCsvValue = (value: string | number): string => {
    if (typeof value === 'number') return String(value);
    return String(value ?? '')
      .replace(/\s*AFN\s*/gi, ' ')
      .replace(/\u00A0/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  };
  const escape = (value: string | number): string => {
    const raw = normalizeCsvValue(value);
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

const isImplantTreatmentRow = (row: Pick<VisitTreatmentReportRow, 'notes' | 'treatment'>): boolean => {
  const treatmentName = asText(row.treatment?.name).toLowerCase();
  if (treatmentName.includes('implant')) {
    return true;
  }

  const treatmentCategory = asText(row.treatment?.category).toLowerCase();
  if (treatmentCategory.includes('implant')) {
    return true;
  }

  const notes = asText(row.notes).toLowerCase();
  if (notes.includes('[condition:implant]')) {
    return true;
  }

  return /\bimplant\b/.test(notes);
};

const isImplantAvailabilityStatus = (value: string): value is ImplantAvailabilityStatus => (
  value === 'not_available' || value === 'in_purchase' || value === 'available' || value === 'done'
);

const isDebtAgingBucket = (value: string): value is DebtAgingBucket => (
  DEBT_AGING_BUCKETS.includes(value as DebtAgingBucket)
);

const allocateRevenueCost = (amount: number, totalOutcome: number, referenceNet: number): number => {
  if (amount <= 0 || totalOutcome <= 0 || referenceNet <= 0) {
    return 0;
  }

  return Number(((amount * totalOutcome) / referenceNet).toFixed(2));
};

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

const fetchExecutiveSummary = async (params: {
  dentistFilter: string;
  endDate: string;
  granularity: ReportGranularity;
  patientFilter: string;
  paymentMethodFilter: string;
  startDate: string;
  statusFilter: ReportStatusFilter;
  treatmentFilter: string;
}): Promise<ExecutiveSummaryResponse | null> => {
  const queryParams = new URLSearchParams();
  queryParams.append('startDate', params.startDate);
  queryParams.append('endDate', params.endDate);
  queryParams.append('granularity', params.granularity);
  queryParams.append('statusFilter', params.statusFilter);
  queryParams.append('dentistFilter', params.dentistFilter);
  queryParams.append('treatmentFilter', params.treatmentFilter);
  queryParams.append('paymentMethodFilter', params.paymentMethodFilter);
  queryParams.append('patientFilter', params.patientFilter);

  const response = await apiClient.get<ExecutiveSummaryResponse>('/api/v1/dental-management/reports/executive-summary', {
    params: queryParams,
  });

  if (!response.success || !response.data) {
    return null;
  }

  return response.data;
};

const fetchClinicalDataset = async (params: {
  endDate: string;
  startDate: string;
}): Promise<ClinicalDatasetResponse | null> => {
  const queryParams = new URLSearchParams();
  queryParams.append('startDate', params.startDate);
  queryParams.append('endDate', params.endDate);

  const response = await apiClient.get<ClinicalDatasetResponse>('/api/v1/dental-management/reports/clinical-dataset', {
    params: queryParams,
  });

  if (!response.success || !response.data) {
    return null;
  }

  return response.data;
};

const fetchFinancialDataset = async (params: {
  endDate: string;
  startDate: string;
}): Promise<FinancialDatasetResponse | null> => {
  const queryParams = new URLSearchParams();
  queryParams.append('startDate', params.startDate);
  queryParams.append('endDate', params.endDate);

  const response = await apiClient.get<FinancialDatasetResponse>('/api/v1/dental-management/reports/financial-dataset', {
    params: queryParams,
  });

  if (!response.success || !response.data) {
    return null;
  }

  return response.data;
};

// eslint-disable-next-line react/function-component-definition
export default function ReportsPage(): JSX.Element {
  const locale = useLocale();
  const router = useRouter();
  const isRtl = locale === 'ps' || locale === 'dr';
  const tSidebar = useTranslations('sidebar');
  const tReportsPage = useTranslations('app.reportsPage');
  const [, startTransition] = useTransition();
  const { isSessionChecked, setUser, user } = useAuthStore();
  const ninetyDaysAgo = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - 90);
    return toInputDate(date);
  }, []);
  const today = useMemo(() => toInputDate(new Date()), []);

  const [startDate, setStartDate] = useState(ninetyDaysAgo);
  const [endDate, setEndDate] = useState(today);
  const [granularity, setGranularity] = useState<ReportGranularity>('day');
  const [statusFilter] = useState<InvoiceStatusFilter>('all');
  const [globalStatusFilter, setGlobalStatusFilter] = useState<ReportStatusFilter>('all');
  const [selectedDentistFilter, setSelectedDentistFilter] = useState<string>('all');
  const [selectedTreatmentFilter, setSelectedTreatmentFilter] = useState<string>('all');
  const [selectedPaymentMethodFilter, setSelectedPaymentMethodFilter] = useState<string>('all');
  const [selectedPatientFilter, setSelectedPatientFilter] = useState<string>('all');
  const [exportFormat, setExportFormat] = useState<ReportExportFormat>('pdf');
  const [csvExportType, setCsvExportType] = useState<CsvExportType>('executive_summary');
  const [physicalSafeBalanceInput, setPhysicalSafeBalanceInput] = useState<string>('0');
  const [showAdvancedControls, setShowAdvancedControls] = useState(false);
  const [activeTab, setActiveTab] = useState<'audit' | 'clinical' | 'executive' | 'financial' | 'inventory'>('executive');
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
  const [shareholderRows, setShareholderRows] = useState<ShareholderReportRow[]>([]);
  const [shareholderTransactionRows, setShareholderTransactionRows] = useState<ShareholderTransactionReportRow[]>([]);
  const [implantSupplierTasks, setImplantSupplierTasks] = useState<ImplantSupplierTaskLike[]>([]);
  const [inventoryRows, setInventoryRows] = useState<InventoryReportRow[]>([]);
  const [allPatientsRows, setAllPatientsRows] = useState<Patient[]>([]);
  const [allAppointmentsRows, setAllAppointmentsRows] = useState<Appointment[]>([]);
  const [allVisitsRows, setAllVisitsRows] = useState<Visit[]>([]);
  const [allInvoiceRows, setAllInvoiceRows] = useState<Array<Record<string, unknown>>>([]);
  const [allVisitTreatmentRows, setAllVisitTreatmentRows] = useState<VisitTreatmentReportRow[]>([]);
  const [allPatientNameRows, setAllPatientNameRows] = useState<Record<string, string>>({});
  const [executiveSummary, setExecutiveSummary] = useState<ExecutiveSummaryResponse | null>(null);
  const [hasLoadedCoreData, setHasLoadedCoreData] = useState(false);
  const [hasLoadedFinanceData, setHasLoadedFinanceData] = useState(false);
  const [hasLoadedInventoryData, setHasLoadedInventoryData] = useState(false);
  const [isLoadingExecutiveSummary, setIsLoadingExecutiveSummary] = useState(false);
  const [isLoadingCoreData, setIsLoadingCoreData] = useState(false);
  const [isLoadingFinanceData, setIsLoadingFinanceData] = useState(false);
  const [isLoadingInventoryData, setIsLoadingInventoryData] = useState(false);
  const csvExportOptions = useMemo<Array<{ label: string; value: CsvExportType }>>(() => {
    if (activeTab === 'financial') {
      return [
        { label: 'Revenue Report', value: 'financial_revenue' },
        { label: 'Outstanding Aging', value: 'financial_outstanding' },
        { label: 'Daily Safe Report', value: 'financial_daily_safe' },
        { label: 'Shareholder Ledger', value: 'financial_shareholder' },
        { label: 'Implant Installment', value: 'financial_implant_installment' },
      ];
    }
    if (activeTab === 'clinical') {
      return [{ label: 'Treatment Report', value: 'clinical_treatment' }];
    }
    if (activeTab === 'inventory') {
      return [{ label: 'Inventory Stock Report', value: 'inventory_stock' }];
    }
    if (activeTab === 'audit') {
      return [{ label: 'Audit Log Report', value: 'audit_log' }];
    }
    return [{ label: 'Executive Summary', value: 'executive_summary' }];
  }, [activeTab]);

  useEffect(() => {
    if (!csvExportOptions.some((option) => option.value === csvExportType)) {
      setCsvExportType(csvExportOptions[0]?.value ?? 'executive_summary');
    }
  }, [csvExportOptions, csvExportType]);

  const granularityLabel = useMemo(() => {
    if (granularity === 'year') return tReportsPage('granularity.year');
    if (granularity === 'month') return tReportsPage('granularity.month');
    return tReportsPage('granularity.day');
  }, [granularity, tReportsPage]);

  const typedPatients = allPatientsRows;
  const typedAppointments = allAppointmentsRows;
  const typedVisits = allVisitsRows;
  const typedVisitTreatments = allVisitTreatmentRows;
  const invoiceRows = allInvoiceRows;
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

  useEffect(() => {
    setHasLoadedCoreData(false);
    setHasLoadedFinanceData(false);
    setHasLoadedInventoryData(false);
  }, [endDate, startDate]);

  const handleReportRequestError = useCallback((error: unknown, fallbackMessage: string): void => {
    const status = typeof error === 'object' && error !== null && 'response' in error
      ? (error as { response?: { status?: number } }).response?.status
      : undefined;

    if (status === 401) {
      setUser(null);
      router.replace(`/${locale}/auth/login`);
      return;
    }

    toast.error(parseApiError(error).message || fallbackMessage);
  }, [locale, router, setUser]);

  const fetchExecutiveSummaryData = useCallback(async (): Promise<void> => {
    if (!isSessionChecked || !user) return;

    setIsLoadingExecutiveSummary(true);
    try {
      const summary = await fetchExecutiveSummary({
        dentistFilter: selectedDentistFilter,
        endDate,
        granularity,
        patientFilter: selectedPatientFilter,
        paymentMethodFilter: selectedPaymentMethodFilter,
        startDate,
        statusFilter: globalStatusFilter,
        treatmentFilter: selectedTreatmentFilter,
      });
      setExecutiveSummary(summary);
    } catch (error) {
      setExecutiveSummary(null);
      handleReportRequestError(error, 'Failed to load executive summary.');
    } finally {
      setIsLoadingExecutiveSummary(false);
    }
  }, [
    endDate,
    globalStatusFilter,
    granularity,
    handleReportRequestError,
    isSessionChecked,
    selectedDentistFilter,
    selectedPatientFilter,
    selectedPaymentMethodFilter,
    selectedTreatmentFilter,
    startDate,
    user,
  ]);

  useEffect(() => {
    if (!isSessionChecked || !user) return;
    void fetchExecutiveSummaryData();
  }, [fetchExecutiveSummaryData, isSessionChecked, user]);

  const fetchCoreData = useCallback(async (): Promise<void> => {
    if (!isSessionChecked || !user) return;

    setIsLoadingCoreData(true);
    try {
      const dataset = await fetchClinicalDataset({ endDate, startDate });
      if (!dataset) {
        return;
      }

      setAllPatientsRows(dataset.patients);
      setAllAppointmentsRows(dataset.appointments);
      setAllVisitsRows(dataset.visits);
      setAllVisitTreatmentRows(dataset.visitTreatments);
      setAllPatientNameRows(dataset.patientNameMap);
      setImplantSupplierTasks(dataset.patientSessionTasks);
      setHasLoadedCoreData(true);
    } catch (error) {
      handleReportRequestError(error, 'Failed to load clinical report data.');
    } finally {
      setIsLoadingCoreData(false);
    }
  }, [endDate, handleReportRequestError, isSessionChecked, startDate, user]);

  const fetchFinanceData = useCallback(async (): Promise<void> => {
    if (!isSessionChecked || !user) return;

    setIsLoadingFinanceData(true);
    try {
      const dataset = await fetchFinancialDataset({ endDate, startDate });
      if (!dataset) {
        return;
      }

      setImplantSupplierTasks(dataset.patientSessionTasks);
      setAllPatientsRows(dataset.patients);
      setAllVisitsRows(dataset.visits);
      setAllInvoiceRows(dataset.invoiceRows);
      setAllVisitTreatmentRows(dataset.visitTreatmentRows);
      setAllPatientNameRows(dataset.patientNameMap);
      setExpenseRows(dataset.expenseRows);
      setSafeRows(dataset.safeRows);
      setSalaryRows(dataset.salaryRows);
      setShareholderRows(dataset.shareholderRows);
      setShareholderTransactionRows(dataset.shareholderTransactionRows);
      setHasLoadedFinanceData(true);
    } catch (error) {
      handleReportRequestError(error, 'Failed to load financial report data.');
    } finally {
      setIsLoadingFinanceData(false);
    }
  }, [endDate, handleReportRequestError, isSessionChecked, startDate, user]);

  const fetchInventoryData = useCallback(async (): Promise<void> => {
    if (!isSessionChecked || !user) return;

    setIsLoadingInventoryData(true);
    try {
      const items = await fetchAllRows(apiClient, '/api/v1/dental-management/inventory-items', {
        sortBy: 'entryDate',
        sortDirection: 'desc',
      });
      setInventoryRows(items.map((row) => ({
        acquisitionSource: asText(row.acquisitionSource ?? row.acquisition_source) === 'purchase' ? 'purchase' : 'previous_stock',
        category: asText(row.category) || 'other',
        entryDate: asText(row.entryDate ?? row.entry_date),
        expiryDate: asText(row.expiryDate ?? row.expiry_date),
        id: asText(row.id),
        itemName: asText(row.itemName ?? row.item_name),
        lotNumber: asText(row.lotNumber ?? row.lot_number),
        minStock: parseAmount(row.minStock ?? row.min_stock),
        quantity: parseAmount(row.quantity),
        sellingPrice: parseAmount(row.sellingPrice ?? row.selling_price),
        supplier: asText(row.supplier),
        totalCost: parseAmount(row.totalCost ?? row.total_cost),
        unit: asText(row.unit) || 'piece',
        unitCost: parseAmount(row.unitCost ?? row.unit_cost),
        updatedAt: asText(row.updatedAt ?? row.updated_at ?? row.entryDate ?? row.entry_date),
      })));
      setHasLoadedInventoryData(true);
    } catch (error) {
      handleReportRequestError(error, 'Failed to load inventory report data.');
    } finally {
      setIsLoadingInventoryData(false);
    }
  }, [handleReportRequestError, isSessionChecked, user]);

  useEffect(() => {
    if (!isSessionChecked || !user) return;
    if (activeTab !== 'clinical' || hasLoadedCoreData) return;
    void fetchCoreData();
  }, [activeTab, fetchCoreData, hasLoadedCoreData, isSessionChecked, user]);

  useEffect(() => {
    if (!isSessionChecked || !user) return;
    if ((activeTab !== 'financial' && activeTab !== 'audit') || hasLoadedFinanceData) return;
    void fetchFinanceData();
  }, [activeTab, fetchFinanceData, hasLoadedFinanceData, isSessionChecked, user]);

  useEffect(() => {
    if (!isSessionChecked || !user) return;
    if (activeTab !== 'inventory' || hasLoadedInventoryData) return;
    void fetchInventoryData();
  }, [activeTab, fetchInventoryData, hasLoadedInventoryData, isSessionChecked, user]);

  useEffect(() => {
    if (!isSessionChecked || !user) return;
    if (activeTab !== 'executive' || isLoadingExecutiveSummary || (hasLoadedFinanceData && hasLoadedCoreData)) return;

    let isCancelled = false;

    const runPrefetch = async (): Promise<void> => {
      const pendingFetches: Array<Promise<void>> = [];

      if (!hasLoadedFinanceData) {
        pendingFetches.push(fetchFinanceData());
      }

      if (!hasLoadedCoreData) {
        pendingFetches.push(fetchCoreData());
      }

      if (pendingFetches.length === 0) {
        return;
      }

      await Promise.allSettled(pendingFetches);
    };

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const idleId = window.requestIdleCallback(() => {
        if (!isCancelled) {
          void runPrefetch();
        }
      }, { timeout: 1500 });

      return () => {
        isCancelled = true;
        window.cancelIdleCallback(idleId);
      };
    }

    const timeoutId = setTimeout(() => {
      if (!isCancelled) {
        void runPrefetch();
      }
    }, 300);

    return () => {
      isCancelled = true;
      clearTimeout(timeoutId);
    };
  }, [
    activeTab,
    fetchCoreData,
    fetchFinanceData,
    hasLoadedCoreData,
    hasLoadedFinanceData,
    isSessionChecked,
    isLoadingExecutiveSummary,
    user,
  ]);

  const shouldComputeExecutiveFallback = executiveSummary === null && (hasLoadedCoreData || hasLoadedFinanceData);
  const shouldComputeFinancialDerived = hasLoadedFinanceData && (
    activeTab === 'financial'
    || activeTab === 'audit'
    || showAdvancedControls
    || shouldComputeExecutiveFallback
  );
  const shouldComputeAppointmentDerived = hasLoadedCoreData && (
    activeTab === 'clinical'
    || showAdvancedControls
    || shouldComputeExecutiveFallback
  );
  const shouldComputeVisitDerived = (hasLoadedCoreData || hasLoadedFinanceData) && (
    activeTab === 'clinical'
    || activeTab === 'financial'
    || showAdvancedControls
    || shouldComputeExecutiveFallback
  );
  const shouldComputeImplantDerived = (hasLoadedCoreData || hasLoadedFinanceData) && (
    activeTab === 'clinical'
    || activeTab === 'financial'
    || showAdvancedControls
    || shouldComputeExecutiveFallback
  );
  const shouldComputeInventoryDerived = hasLoadedInventoryData && activeTab === 'inventory';
  const shouldComputeAuditDerived = activeTab === 'audit';

  const filteredDailyExpenses = useMemo(
    () => (
      shouldComputeFinancialDerived
        ? expenseRows.filter((item) => item.expenseType === 'daily' && inRange(item.expenseDate, startDate, endDate))
        : EMPTY_EXPENSE_ROWS
    ),
    [endDate, expenseRows, shouldComputeFinancialDerived, startDate]
  );
  const filteredClinicalExpenses = useMemo(
    () => (
      shouldComputeFinancialDerived
        ? expenseRows.filter((item) => item.expenseType === 'clinical' && inRange(item.expenseDate, startDate, endDate))
        : EMPTY_EXPENSE_ROWS
    ),
    [endDate, expenseRows, shouldComputeFinancialDerived, startDate]
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
      .sort((left, right) => right.amount - left.amount);

    return {
      byCategory: categoryRows,
      clinical,
      daily,
      total: Number((daily + clinical).toFixed(2)),
    };
  }, [filteredClinicalExpenses, filteredDailyExpenses]);
  const safePickups = useMemo(() => {
    if (!shouldComputeFinancialDerived) {
      return [];
    }

    const grouped = new Map<string, number>();
    safeRows.forEach((row) => {
      if (row.direction !== 'out') return;
      if (!inRange(row.transactionDate, startDate, endDate)) return;
      const person = row.pickedByStaffName || `Staff #${row.pickedByStaffId || '-'}`;
      grouped.set(person, Number(((grouped.get(person) ?? 0) + row.amount).toFixed(2)));
    });

    return [...grouped.entries()]
      .map(([name, amount]) => ({ amount, name }))
      .sort((left, right) => right.amount - left.amount);
  }, [endDate, safeRows, shouldComputeFinancialDerived, startDate]);
  const salarySummary = useMemo(() => {
    if (!shouldComputeFinancialDerived) {
      return {
        paid: 0,
        records: 0,
      };
    }

    const filtered = salaryRows.filter((row) => inRange(row.paymentDate, startDate, endDate));
    const paid = Number(filtered
      .filter((row) => row.status === 'paid' || row.status === 'partial')
      .reduce((sum, row) => sum + row.netAmount, 0)
      .toFixed(2));

    return {
      paid,
      records: filtered.length,
    };
  }, [endDate, salaryRows, shouldComputeFinancialDerived, startDate]);
  const shareholderTransactionsInRange = useMemo(
    () => (
      shouldComputeFinancialDerived
        ? shareholderTransactionRows.filter((row) => inRange(row.transactionDate, startDate, endDate))
        : EMPTY_SHAREHOLDER_TRANSACTION_ROWS
    ),
    [endDate, shareholderTransactionRows, shouldComputeFinancialDerived, startDate]
  );
  const shareholderFinancialSummary = useMemo(() => {
    if (!shouldComputeFinancialDerived) {
      return {
        activeCount: 0,
        rangeContributed: 0,
        rangeDistributed: 0,
        rangeRows: [],
        totalBalance: 0,
        totalContributed: 0,
        totalDistributed: 0,
        totalInitial: 0,
        totalShareholders: 0,
        topBalances: [],
        transactionCount: 0,
      };
    }

    const totalInitial = Number(shareholderRows.reduce((sum, row) => sum + row.initialCapitalInput, 0).toFixed(2));
    const totalContributed = Number(shareholderRows.reduce((sum, row) => sum + row.contributedAmount, 0).toFixed(2));
    const totalDistributed = Number(shareholderRows.reduce((sum, row) => sum + row.distributedAmount, 0).toFixed(2));
    const totalBalance = Number(shareholderRows.reduce((sum, row) => sum + row.balanceAmount, 0).toFixed(2));
    const rangeContributed = Number(shareholderTransactionsInRange
      .filter((row) => row.transactionType === 'contribution')
      .reduce((sum, row) => sum + row.amountInput, 0)
      .toFixed(2));
    const rangeDistributed = Number(shareholderTransactionsInRange
      .filter((row) => row.transactionType === 'distribution')
      .reduce((sum, row) => sum + row.amountInput, 0)
      .toFixed(2));

    const grouped = new Map<string, { contribution: number; distribution: number; name: string }>();
    shareholderTransactionsInRange.forEach((row) => {
      const existing = grouped.get(row.shareholderId) ?? { contribution: 0, distribution: 0, name: row.shareholderName || `Shareholder #${row.shareholderId}` };
      if (row.transactionType === 'contribution') existing.contribution += row.amountInput;
      else existing.distribution += row.amountInput;
      grouped.set(row.shareholderId, existing);
    });

    const rangeRows = [...grouped.entries()]
      .map(([id, item]) => ({
        contribution: Number(item.contribution.toFixed(2)),
        distribution: Number(item.distribution.toFixed(2)),
        id,
        name: item.name,
        net: Number((item.contribution - item.distribution).toFixed(2)),
      }))
      .sort((left, right) => right.net - left.net);

    const topBalances = [...shareholderRows]
      .map((row) => ({ balance: row.balanceAmount, id: row.id, name: row.fullName || `Shareholder #${row.id}` }))
      .sort((left, right) => right.balance - left.balance)
      .slice(0, 8);

    return {
      activeCount: shareholderRows.filter((row) => row.status === 'active').length,
      rangeContributed,
      rangeDistributed,
      rangeRows,
      totalBalance,
      totalContributed,
      totalDistributed,
      totalInitial,
      totalShareholders: shareholderRows.length,
      topBalances,
      transactionCount: shareholderTransactionsInRange.length,
    };
  }, [shareholderRows, shareholderTransactionsInRange, shouldComputeFinancialDerived]);
  const filteredImplantSupplierTasks = useMemo(
    () => {
      if (!shouldComputeImplantDerived) {
        return EMPTY_IMPLANT_TASKS;
      }

      return implantSupplierTasks.filter((task) => {
        const taskDate = asText(task.updatedAt) || asText(task.createdAt);
        const availability = parseAvailabilityFromTaskNotes(task.notes, task.status);
        if (!taskDate) return true;
        if (!inRange(taskDate, startDate, endDate)) return false;
        if (selectedPatientFilter !== 'all' && asText(task.patientId) !== selectedPatientFilter) return false;
        if (globalStatusFilter !== 'all') {
          const mappedStatus: ReportStatusFilter = availability === 'done' ? 'completed' : 'pending';
          if (mappedStatus !== globalStatusFilter) return false;
        }
        return true;
      });
    },
    [endDate, globalStatusFilter, implantSupplierTasks, selectedPatientFilter, shouldComputeImplantDerived, startDate]
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
    return rows;
  }, [selectedThirdCompanyAvailability, thirdCompanySummary.unpaidRows]);
  const thirdCompanyInstallmentRows = useMemo(() => {
    const rows = selectedThirdCompanyAvailability === 'all'
      ? thirdCompanySummary.rows
      : thirdCompanySummary.rows.filter((row) => row.availability === selectedThirdCompanyAvailability);
    return rows;
  }, [selectedThirdCompanyAvailability, thirdCompanySummary.rows]);

  const parsedData = useMemo(() => {
    if (!shouldComputeFinancialDerived) {
      return EMPTY_PARSED_DATA;
    }

    const allPayments: ParsedPayment[] = [];
    const allInvoices: ParsedInvoice[] = [];
    const ledgerEvents: Array<Omit<LedgerEntry, 'balance'>> = [];

    for (const invoiceRow of invoiceRows) {
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
  }, [invoiceRows, shouldComputeFinancialDerived]);
  const invoiceById = useMemo(
    () => new Map(parsedData.allInvoices.map((invoice) => [invoice.id, invoice])),
    [parsedData.allInvoices]
  );

  const visitById = useMemo(() => {
    const map = new Map<string, Visit>();
    typedVisits.forEach((visit) => {
      map.set(String(visit.id), visit);
    });
    return map;
  }, [typedVisits]);

  const treatmentNamesByVisitId = useMemo(() => {
    const map = new Map<string, Set<string>>();
    typedVisitTreatments.forEach((row) => {
      const visitId = asText(row.visitId);
      if (!visitId) return;
      const current = map.get(visitId) ?? new Set<string>();
      current.add((row.treatment?.name || `Treatment ${row.treatmentId}`).toLowerCase());
      map.set(visitId, current);
    });
    return map;
  }, [typedVisitTreatments]);

  const paymentMethodsByInvoiceId = useMemo(() => {
    const map = new Map<string, Set<string>>();
    parsedData.allPayments.forEach((payment) => {
      const current = map.get(payment.invoiceId) ?? new Set<string>();
      current.add(payment.method.toLowerCase());
      map.set(payment.invoiceId, current);
    });
    return map;
  }, [parsedData.allPayments]);

  const filteredInvoices = useMemo(() => {
    return parsedData.allInvoices.filter((invoice) => {
      if (statusFilter !== 'all' && invoice.status !== statusFilter) return false;
      if (globalStatusFilter !== 'all' && toReportStatus(invoice.status) !== globalStatusFilter) return false;
      if (!inRange(invoice.date, startDate, endDate)) return false;
      if (selectedPatientFilter !== 'all' && invoice.patientId !== selectedPatientFilter) return false;

      const visit = visitById.get(invoice.visitId);
      if (selectedDentistFilter !== 'all') {
        const dentistId = asText(visit?.dentistId);
        const dentistName = asText(visit?.dentistName);
        if (dentistId !== selectedDentistFilter && dentistName !== selectedDentistFilter) return false;
      }

      if (selectedTreatmentFilter !== 'all') {
        const treatments = treatmentNamesByVisitId.get(invoice.visitId);
        if (!treatments?.has(selectedTreatmentFilter.toLowerCase())) return false;
      }

      if (selectedPaymentMethodFilter !== 'all') {
        const methods = paymentMethodsByInvoiceId.get(invoice.id);
        if (!methods?.has(selectedPaymentMethodFilter.toLowerCase())) return false;
      }

      return true;
    });
  }, [
    endDate,
    globalStatusFilter,
    parsedData.allInvoices,
    paymentMethodsByInvoiceId,
    selectedDentistFilter,
    selectedPatientFilter,
    selectedPaymentMethodFilter,
    selectedTreatmentFilter,
    startDate,
    statusFilter,
    treatmentNamesByVisitId,
    visitById,
  ]);

  const filteredPayments = useMemo(() => {
    return parsedData.allPayments.filter((payment) => {
      if (!inRange(payment.date, startDate, endDate)) return false;
      if (selectedPaymentMethodFilter !== 'all' && payment.method.toLowerCase() !== selectedPaymentMethodFilter.toLowerCase()) {
        return false;
      }

      const invoice = invoiceById.get(payment.invoiceId);
      if (!invoice) return false;

      if (selectedPatientFilter !== 'all' && invoice.patientId !== selectedPatientFilter) return false;
      if (globalStatusFilter !== 'all' && toReportStatus(invoice.status) !== globalStatusFilter) return false;
      if (selectedTreatmentFilter !== 'all') {
        const treatments = treatmentNamesByVisitId.get(invoice.visitId);
        if (!treatments?.has(selectedTreatmentFilter.toLowerCase())) return false;
      }

      if (selectedDentistFilter !== 'all') {
        const visit = visitById.get(invoice.visitId);
        const dentistId = asText(visit?.dentistId);
        const dentistName = asText(visit?.dentistName);
        if (dentistId !== selectedDentistFilter && dentistName !== selectedDentistFilter) return false;
      }

      return true;
    });
  }, [
    endDate,
    globalStatusFilter,
    parsedData.allPayments,
    invoiceById,
    selectedDentistFilter,
    selectedPatientFilter,
    selectedPaymentMethodFilter,
    selectedTreatmentFilter,
    startDate,
    treatmentNamesByVisitId,
    visitById,
  ]);

  const filteredAppointments = useMemo(
    () => (
      shouldComputeAppointmentDerived
        ? typedAppointments.filter((item) => {
        if (!inRange(item.appointmentDate, startDate, endDate)) return false;
        if (selectedPatientFilter !== 'all' && asText(item.patientId) !== selectedPatientFilter) return false;
        if (selectedDentistFilter !== 'all') {
          const dentistId = asText(item.dentistId);
          const dentistName = asText(item.dentistName);
          if (dentistId !== selectedDentistFilter && dentistName !== selectedDentistFilter) return false;
        }
        if (globalStatusFilter !== 'all' && toReportStatus(item.status || 'pending') !== globalStatusFilter) return false;
        return true;
      })
        : EMPTY_APPOINTMENTS
    ),
    [endDate, globalStatusFilter, selectedDentistFilter, selectedPatientFilter, shouldComputeAppointmentDerived, startDate, typedAppointments]
  );
  const filteredVisits = useMemo(
    () => (
      shouldComputeVisitDerived
        ? typedVisits.filter((item) => {
        if (!inRange(item.visitDate, startDate, endDate)) return false;
        if (selectedPatientFilter !== 'all' && asText(item.patientId) !== selectedPatientFilter) return false;
        if (selectedDentistFilter !== 'all') {
          const dentistId = asText(item.dentistId);
          const dentistName = asText(item.dentistName);
          if (dentistId !== selectedDentistFilter && dentistName !== selectedDentistFilter) return false;
        }
        return true;
      })
        : EMPTY_VISITS
    ),
    [endDate, selectedDentistFilter, selectedPatientFilter, shouldComputeVisitDerived, startDate, typedVisits]
  );
  const filteredVisitTreatments = useMemo(
    () => (
      shouldComputeVisitDerived
        ? typedVisitTreatments.filter((item) => {
        const visit = visitById.get(asText(item.visitId));
        const date = asText(item.visit?.visitDate) || asText(visit?.visitDate) || item.createdAt;
        if (!inRange(date, startDate, endDate)) return false;
        if (selectedTreatmentFilter !== 'all') {
          const treatmentName = item.treatment?.name || `Treatment ${item.treatmentId}`;
          if (treatmentName.toLowerCase() !== selectedTreatmentFilter.toLowerCase()) return false;
        }
        if (selectedDentistFilter !== 'all') {
          const itemVisit = item.visit as Record<string, unknown> | undefined;
          const dentistName = asText(item.visit?.dentistName) || asText(visit?.dentistName);
          const dentistId = asText(itemVisit?.dentistId ?? itemVisit?.dentist_id) || asText(visit?.dentistId);
          if (dentistId !== selectedDentistFilter && dentistName !== selectedDentistFilter) return false;
        }
        if (selectedPatientFilter !== 'all') {
          if (asText(visit?.patientId) !== selectedPatientFilter) return false;
        }
        return true;
      })
        : EMPTY_VISIT_TREATMENTS
    ),
    [endDate, selectedDentistFilter, selectedPatientFilter, selectedTreatmentFilter, shouldComputeVisitDerived, startDate, typedVisitTreatments, visitById]
  );

  const dentistFilterOptions = useMemo(() => {
    const names = new Set<string>();
    typedAppointments.forEach((item) => {
      const dentist = asText(item.dentistName) || asText(item.dentistId);
      if (dentist) names.add(dentist);
    });
    typedVisits.forEach((item) => {
      const dentist = asText(item.dentistName) || asText(item.dentistId);
      if (dentist) names.add(dentist);
    });
    if (names.size === 0) {
      executiveSummary?.filterOptions.dentists.forEach((dentist) => {
        if (dentist) names.add(dentist);
      });
    }
    return [...names].sort((left, right) => left.localeCompare(right));
  }, [executiveSummary, typedAppointments, typedVisits]);

  const treatmentFilterOptions = useMemo(() => {
    const names = new Set<string>();
    typedVisitTreatments.forEach((item) => {
      const name = item.treatment?.name || `Treatment ${item.treatmentId}`;
      if (name) names.add(name);
    });
    if (names.size === 0) {
      executiveSummary?.filterOptions.treatments.forEach((treatment) => {
        if (treatment) names.add(treatment);
      });
    }
    return [...names].sort((left, right) => left.localeCompare(right));
  }, [executiveSummary, typedVisitTreatments]);

  const paymentMethodFilterOptions = useMemo(() => {
    const names = new Set<string>();
    parsedData.allPayments.forEach((item) => {
      if (item.method) names.add(item.method.toLowerCase());
    });
    if (names.size === 0) {
      executiveSummary?.filterOptions.paymentMethods.forEach((method) => {
        if (method) names.add(method.toLowerCase());
      });
    }
    return [...names].sort((left, right) => left.localeCompare(right));
  }, [executiveSummary, parsedData.allPayments]);

  const patientFilterOptions = useMemo(() => {
    const rows = [...mergedPatientNameById.entries()]
      .map(([id, name]) => ({ id, name: name || `Patient #${id}` }));
    if (rows.length === 0 && executiveSummary) {
      return [...executiveSummary.filterOptions.patients].sort((left, right) => left.name.localeCompare(right.name));
    }
    return rows.sort((left, right) => left.name.localeCompare(right.name));
  }, [executiveSummary, mergedPatientNameById]);

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

  const dailyFinancialSummary = useMemo(() => {
    if (!shouldComputeFinancialDerived) {
      return {
        closingBalance: 0,
        openingBalance: 0,
        physicalBalance: 0,
        totalCashIn: 0,
        totalCashOut: 0,
        variance: 0,
      };
    }

    const start = parseDate(startDate)?.getTime() ?? Number.MIN_SAFE_INTEGER;
    let opening = 0;
    let cashIn = 0;
    let cashOut = 0;

    safeRows.forEach((row) => {
      const date = parseDate(row.transactionDate)?.getTime() ?? Number.MIN_SAFE_INTEGER;
      const amount = parseAmount(row.amount);
      if (date < start) {
        opening += row.direction === 'in' ? amount : -amount;
        return;
      }
      if (!inRange(row.transactionDate, startDate, endDate)) return;
      if (row.direction === 'in') {
        cashIn += amount;
      } else {
        cashOut += amount;
      }
    });

    const openingBalance = Number(opening.toFixed(2));
    const totalCashIn = Number(cashIn.toFixed(2));
    const totalCashOut = Number(cashOut.toFixed(2));
    const closingBalance = Number((openingBalance + totalCashIn - totalCashOut).toFixed(2));
    const physicalBalance = parseAmount(physicalSafeBalanceInput);
    const variance = Number((physicalBalance - closingBalance).toFixed(2));

    return {
      closingBalance,
      openingBalance,
      physicalBalance,
      totalCashIn,
      totalCashOut,
      variance,
    };
  }, [endDate, physicalSafeBalanceInput, safeRows, shouldComputeFinancialDerived, startDate]);

  const inventoryRowsInRange = useMemo(
    () => (
      shouldComputeInventoryDerived
        ? inventoryRows.filter((row) => inRange(row.entryDate, startDate, endDate))
        : EMPTY_INVENTORY_ROWS
    ),
    [endDate, inventoryRows, shouldComputeInventoryDerived, startDate]
  );
  const inventoryRowsById = useMemo(
    () => new Map(inventoryRows.map((row) => [row.id, row])),
    [inventoryRows]
  );
  const totalInventoryItemsInDatabase = inventoryRows.length;

  const stockStatusRows = useMemo(() => {
    return inventoryRowsInRange.map((row) => {
      const status = row.quantity <= 0
        ? 'Out'
        : row.quantity <= row.minStock
          ? 'Low'
          : 'In Stock';
      return {
        ...row,
        status,
      };
    });
  }, [inventoryRowsInRange]);

  const materialUsagePerTreatment = useMemo(() => {
    const grouped = new Map<string, { cost: number; sessions: number }>();
    filteredVisitTreatments.forEach((row) => {
      const treatment = row.treatment?.name || `Treatment ${row.treatmentId}`;
      const current = grouped.get(treatment) ?? { cost: 0, sessions: 0 };
      current.sessions += 1;
      current.cost = Number((current.cost + parseAmount(row.price)).toFixed(2));
      grouped.set(treatment, current);
    });
    return [...grouped.entries()]
      .map(([treatment, value]) => ({
        avgCost: Number((value.cost / Math.max(value.sessions, 1)).toFixed(2)),
        sessions: value.sessions,
        totalCost: value.cost,
        treatment,
      }))
      .sort((left, right) => right.totalCost - left.totalCost);
  }, [filteredVisitTreatments]);
  const inventoryUsageRows = useMemo<InventoryUsageReportRow[]>(() => {
    const rows: InventoryUsageReportRow[] = [];

    filteredVisitTreatments.forEach((row) => {
      const treatmentName = row.treatment?.name || `Treatment ${row.treatmentId}`;
      const visitId = asText(row.visitId);
      const visit = visitById.get(visitId);
      const patientId = asText(visit?.patientId);
      const patientName = mergedPatientNameById.get(patientId) || (patientId ? `Patient #${patientId}` : 'Unknown');
      const usedOn = asText(row.visit?.visitDate) || asText(visit?.visitDate) || asText(row.createdAt);
      const visitLabel = visit ? (visit.tag || `Visit #${visit.id}`) : (visitId ? `Visit #${visitId}` : '-');

      const materialItems = Array.isArray(row.materialItems) ? row.materialItems : [];
      materialItems.forEach((item) => {
        const materialItem = item as Record<string, unknown>;
        const inventoryItemId = asText(materialItem.inventoryItemId ?? materialItem.inventory_item_id);
        const quantity = parseAmount(materialItem.quantityUsed ?? materialItem.quantity_used ?? materialItem.quantity);
        if (!inventoryItemId || quantity <= 0) return;

        const inventoryRow = inventoryRowsById.get(inventoryItemId);
        const itemName = asText(materialItem.itemName ?? materialItem.item_name) || inventoryRow?.itemName || `Item #${inventoryItemId}`;
        const unit = asText(materialItem.unit) || inventoryRow?.unit || 'unit';

        rows.push({
          inventoryItemId,
          itemName,
          patientId,
          patientName,
          quantityUsed: quantity,
          treatmentName,
          unit,
          usedOn,
          visitLabel,
        });
      });
    });

    return rows.sort((left, right) => {
      const leftDate = parseDate(left.usedOn)?.getTime() ?? 0;
      const rightDate = parseDate(right.usedOn)?.getTime() ?? 0;
      if (leftDate !== rightDate) return rightDate - leftDate;
      return left.itemName.localeCompare(right.itemName, undefined, { sensitivity: 'base' });
    });
  }, [filteredVisitTreatments, inventoryRowsById, mergedPatientNameById, visitById]);
  const clinicalPrescriptionRows = useMemo(() => {
    return filteredVisitTreatments
      .map((row) => {
        const summary = formatPrescriptionSummary(row.prescription);
        if (!summary || summary === '-') {
          return null;
        }

        const visitId = asText(row.visitId);
        const visit = visitById.get(visitId);
        const patientId = asText(visit?.patientId);
        return {
          dentist: asText(row.visit?.dentistName) || asText(visit?.dentistName) || '-',
          patientName: mergedPatientNameById.get(patientId) || (patientId ? `Patient #${patientId}` : 'Unknown'),
          prescription: summary,
          treatmentName: row.treatment?.name || `Treatment ${row.treatmentId}`,
          visitDate: asText(row.visit?.visitDate) || asText(visit?.visitDate) || asText(row.createdAt),
        };
      })
      .filter((row): row is {
        dentist: string;
        patientName: string;
        prescription: string;
        treatmentName: string;
        visitDate: string;
      } => row !== null);
  }, [filteredVisitTreatments, mergedPatientNameById, visitById]);

  const implantInventoryRows = useMemo(
    () => inventoryRowsInRange.filter((row) => row.category.toLowerCase() === 'implant'),
    [inventoryRowsInRange]
  );

  const implantPlacementTrend = useMemo(() => {
    const grouped = new Map<string, { count: number; label: string; revenue: number; sort: number }>();
    filteredVisitTreatments.forEach((row) => {
      if (!isImplantTreatmentRow(row)) return;
      const visit = visitById.get(asText(row.visitId));
      const date = parseDate(asText(row.visit?.visitDate) || asText(visit?.visitDate) || row.createdAt);
      if (!date) return;
      const bucket = toBucket(date, 'month');
      const current = grouped.get(bucket.key) ?? { count: 0, label: bucket.label, revenue: 0, sort: bucket.sort };
      current.count += 1;
      current.revenue = Number((current.revenue + parseAmount(row.price)).toFixed(2));
      grouped.set(bucket.key, current);
    });
    return [...grouped.entries()]
      .map(([key, value]) => ({ count: value.count, key, label: value.label, revenue: value.revenue, sort: value.sort }))
      .sort((left, right) => left.sort - right.sort)
      .map((row) => ({ count: row.count, key: row.key, label: row.label, revenue: row.revenue }));
  }, [filteredVisitTreatments, visitById]);

  const executiveRevenueTrendMonthly = useMemo(() => {
    const grouped = new Map<string, { amount: number; label: string; sort: number }>();
    filteredPayments.forEach((payment) => {
      const date = parseDate(payment.date);
      if (!date) return;
      const bucket = toBucket(date, 'month');
      const current = grouped.get(bucket.key) ?? { amount: 0, label: bucket.label, sort: bucket.sort };
      current.amount = Number((current.amount + payment.amount).toFixed(2));
      grouped.set(bucket.key, current);
    });
    return [...grouped.entries()]
      .map(([key, value]) => ({ amount: value.amount, key, label: value.label, sort: value.sort }))
      .sort((left, right) => left.sort - right.sort)
      .map((row) => ({ amount: row.amount, key: row.key, label: row.label }));
  }, [filteredPayments]);

  const bankBalance = useMemo(() => {
    return Number(
      filteredPayments
        .filter((row) => ['bank', 'bank_transfer', 'transfer', 'card'].includes(row.method.toLowerCase()))
        .reduce((sum, row) => sum + row.amount, 0)
        .toFixed(2)
    );
  }, [filteredPayments]);

  const cashInSafe = useMemo(() => {
    let balance = 0;
    safeRows
      .filter((row) => {
        const date = parseDate(row.transactionDate);
        const end = parseDate(endDate);
        return Boolean(date && end && date.getTime() <= end.getTime() + MS_PER_DAY - 1);
      })
      .forEach((row) => {
        balance += row.direction === 'in' ? row.amount : -row.amount;
      });
    return Number(balance.toFixed(2));
  }, [endDate, safeRows]);

  const newPatientsCount = useMemo(() => {
    return typedPatients.filter((patient) => {
      if (selectedPatientFilter !== 'all' && asText(patient.id) !== selectedPatientFilter) return false;
      const created = asText((patient as unknown as Record<string, unknown>).createdAt ?? (patient as unknown as Record<string, unknown>).created_at);
      return inRange(created, startDate, endDate);
    }).length;
  }, [endDate, selectedPatientFilter, startDate, typedPatients]);

  const implantRevenue = useMemo(
    () => Number(implantPlacementTrend.reduce((sum, row) => sum + row.revenue, 0).toFixed(2)),
    [implantPlacementTrend]
  );

  const treatmentAcceptanceRate = useMemo(() => {
    if (filteredAppointments.length === 0) return 0;
    return Number(Math.min(100, (filteredVisits.length / filteredAppointments.length) * 100).toFixed(1));
  }, [filteredAppointments.length, filteredVisits.length]);

  const chairUtilizationRate = useMemo(() => {
    const start = parseDate(startDate);
    const end = parseDate(endDate);
    if (!start || !end) return 0;
    const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / MS_PER_DAY) + 1);
    return Number(Math.min(100, (filteredVisits.length / days) * 100).toFixed(1));
  }, [endDate, filteredVisits.length, startDate]);

  const financialModificationLogRows = useMemo<FinancialModificationLogRow[]>(() => {
    if (!shouldComputeAuditDerived) {
      return EMPTY_FINANCIAL_MODIFICATION_LOG_ROWS;
    }

    const rows: FinancialModificationLogRow[] = [];
    invoiceRows.forEach((invoice) => {
      const createdAt = asText(invoice.createdAt ?? invoice.created_at);
      const updatedAt = asText(invoice.updatedAt ?? invoice.updated_at);
      if (!createdAt || !updatedAt || createdAt === updatedAt) return;
      rows.push({
        action: 'Invoice Updated',
        afterValue: `Invoice #${asText(invoice.id)} current total ${formatCurrency(parseAmount(invoice.netAmount ?? invoice.net_amount))}`,
        beforeValue: 'Previous values stored in backend audit log',
        changedBy: asText(invoice.updatedBy ?? invoice.updated_by) || 'System',
        entity: `Invoice #${asText(invoice.id)}`,
        timestamp: updatedAt,
      });
    });

    safeRows
      .filter((row) => row.notes.toLowerCase().includes('delete'))
      .forEach((row) => {
        rows.push({
          action: 'Payment/Safe Deleted',
          afterValue: `Deleted amount ${formatCurrency(row.amount)}`,
          beforeValue: `Original entry ${row.id}`,
          changedBy: row.pickedByStaffName || row.pickedByStaffId || 'System',
          entity: `Safe Transaction #${row.id}`,
          timestamp: row.transactionDate,
        });
      });

    return rows
      .sort((left, right) => {
        const leftTime = parseDate(left.timestamp)?.getTime() ?? 0;
        const rightTime = parseDate(right.timestamp)?.getTime() ?? 0;
        return rightTime - leftTime;
      });
  }, [invoiceRows, safeRows, shouldComputeAuditDerived]);

  const accessLogRows = useMemo(() => {
    if (!shouldComputeAuditDerived) {
      return EMPTY_ACCESS_LOG_ROWS;
    }

    return snapshotRecords.map((snapshot) => ({
      action: `Report snapshot (${snapshot.granularity})`,
      generatedAt: snapshot.generatedAt,
      range: `${snapshot.rangeStart} to ${snapshot.rangeEnd}`,
      user: 'Current user',
    }));
  }, [shouldComputeAuditDerived, snapshotRecords]);

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
      .sort((left, right) => right.revenue - left.revenue || right.sessions - left.sessions);
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
      .sort((left, right) => right.revenue - left.revenue || right.visits - left.visits);
  }, [filteredInvoices, filteredVisits]);

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

  const displayExpenseSummary = executiveSummary?.expenseSummary ?? expenseSummary;
  const displayKpis = executiveSummary?.kpis ?? kpis;
  const displayProfitOrLoss = executiveSummary?.profitLoss ?? profitOrLoss;
  const displayProfitLossTrend = executiveSummary?.profitLossTrend ?? profitLossTrend;
  const displayExecutiveRevenueTrendMonthly = executiveSummary?.revenueTrendMonthly ?? executiveRevenueTrendMonthly;
  const displayTreatmentVolume = executiveSummary?.treatmentVolume ?? treatmentVolume;
  const displayDentistProductivity = executiveSummary?.dentistProductivity ?? dentistProductivity;
  const displayImplantPlacementTrend = executiveSummary?.implantPlacementTrend ?? implantPlacementTrend;
  const displayNewPatientsCount = executiveSummary?.newPatientsCount ?? newPatientsCount;
  const displayImplantRevenue = executiveSummary?.implantRevenue ?? implantRevenue;
  const displayCashInSafe = executiveSummary?.cashInSafe ?? cashInSafe;
  const displayBankBalance = executiveSummary?.bankBalance ?? bankBalance;
  const displayTreatmentAcceptanceRate = executiveSummary?.treatmentAcceptanceRate ?? treatmentAcceptanceRate;
  const displayChairUtilizationRate = executiveSummary?.chairUtilizationRate ?? chairUtilizationRate;

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

  const revenueByTreatmentRows = useMemo(() => {
    return treatmentVolume.map((row) => ({
      cost: formatCurrency(allocateRevenueCost(row.revenue, totalOutcome, kpis.net)),
      count: row.sessions,
      discount: formatCurrency(0),
      gross: formatCurrency(row.revenue),
      label: row.name,
      net: formatCurrency(row.revenue),
      profit: formatCurrency(Number((row.revenue - allocateRevenueCost(row.revenue, totalOutcome, kpis.net)).toFixed(2))),
    }));
  }, [kpis.net, totalOutcome, treatmentVolume]);

  const revenueByDentistRows = useMemo(() => {
    return dentistProductivity.map((row) => ({
      cost: formatCurrency(allocateRevenueCost(row.revenue, totalOutcome, kpis.net)),
      count: row.visits,
      discount: formatCurrency(0),
      gross: formatCurrency(row.revenue),
      label: row.dentist,
      net: formatCurrency(row.revenue),
      profit: formatCurrency(Number((row.revenue - allocateRevenueCost(row.revenue, totalOutcome, kpis.net)).toFixed(2))),
    }));
  }, [dentistProductivity, kpis.net, totalOutcome]);

  const revenueByPaymentMethodRows = useMemo(() => {
    return paymentMethodMix.map((row) => ({
      cost: formatCurrency(allocateRevenueCost(row.amount, totalOutcome, kpis.net)),
      count: row.count,
      discount: formatCurrency(0),
      gross: formatCurrency(row.amount),
      label: toHumanLabel(row.method),
      net: formatCurrency(row.amount),
      profit: formatCurrency(Number((row.amount - allocateRevenueCost(row.amount, totalOutcome, kpis.net)).toFixed(2))),
    }));
  }, [kpis.net, paymentMethodMix, totalOutcome]);

  const revenueByPatientRows = useMemo(() => {
    const grouped = new Map<string, { count: number; discount: number; gross: number; net: number }>();
    filteredInvoices.forEach((row) => {
      const key = row.patientId || 'unknown';
      const current = grouped.get(key) ?? { count: 0, discount: 0, gross: 0, net: 0 };
      current.count += 1;
      current.discount = Number((current.discount + row.discount).toFixed(2));
      current.gross = Number((current.gross + row.total).toFixed(2));
      current.net = Number((current.net + row.net).toFixed(2));
      grouped.set(key, current);
    });
    return [...grouped.entries()].map(([patientId, row]) => ({
      cost: formatCurrency(allocateRevenueCost(row.net, totalOutcome, kpis.net)),
      count: row.count,
      discount: formatCurrency(row.discount),
      gross: formatCurrency(row.gross),
      label: mergedPatientNameById.get(patientId) || `Patient #${patientId}`,
      net: formatCurrency(row.net),
      profit: formatCurrency(Number((row.net - allocateRevenueCost(row.net, totalOutcome, kpis.net)).toFixed(2))),
    }));
  }, [filteredInvoices, kpis.net, mergedPatientNameById, totalOutcome]);

  const treatmentPerformanceSummary = useMemo(() => {
    const completedTreatments = filteredVisitTreatments.length;
    const cancelledTreatments = filteredAppointments.filter((row) => (row.status || '').toLowerCase() === 'cancelled').length;
    const total = completedTreatments + cancelledTreatments;
    const successRate = total > 0 ? Number(((completedTreatments / total) * 100).toFixed(1)) : 0;
    return {
      avgDurationMinutes: 0,
      cancelledTreatments,
      completedTreatments,
      successRate,
    };
  }, [filteredAppointments, filteredVisitTreatments.length]);

  const dentistPerformanceRows = useMemo(() => {
    const revenueByDentist = new Map<string, number>();
    const treatmentCountByDentist = new Map<string, number>();
    filteredVisitTreatments.forEach((row) => {
      const visit = visitById.get(asText(row.visitId));
      const dentist = asText(row.visit?.dentistName) || asText(visit?.dentistName) || `Dentist #${asText(visit?.dentistId) || '-'}`;
      treatmentCountByDentist.set(dentist, (treatmentCountByDentist.get(dentist) ?? 0) + 1);
      revenueByDentist.set(dentist, Number(((revenueByDentist.get(dentist) ?? 0) + parseAmount(row.price)).toFixed(2)));
    });

    const patientsByDentist = new Map<string, Set<string>>();
    filteredVisits.forEach((row) => {
      const dentist = row.dentistName || `Dentist #${row.dentistId || '-'}`;
      const set = patientsByDentist.get(dentist) ?? new Set<string>();
      set.add(asText(row.patientId));
      patientsByDentist.set(dentist, set);
    });

    return [...new Set([...treatmentCountByDentist.keys(), ...patientsByDentist.keys(), ...revenueByDentist.keys()])]
      .map((dentist) => {
        const revenue = revenueByDentist.get(dentist) ?? 0;
        return {
          commission: Number((revenue * 0.1).toFixed(2)),
          dentist,
          patientsSeen: patientsByDentist.get(dentist)?.size ?? 0,
          revenue,
          treatments: treatmentCountByDentist.get(dentist) ?? 0,
        };
      })
      .sort((left, right) => right.revenue - left.revenue || right.treatments - left.treatments);
  }, [filteredVisitTreatments, filteredVisits, visitById]);

  const implantSuccessRows = useMemo(() => {
    const rows = filteredImplantSupplierTasks.map((task) => ({
      brand: 'Implant',
      failures: parseAvailabilityFromTaskNotes(task.notes, task.status) === 'not_available' ? 1 : 0,
      patientName: mergedPatientNameById.get(asText(task.patientId)) || `Patient #${asText(task.patientId) || '-'}`,
      placementDate: task.createdAt,
      status: parseAvailabilityFromTaskNotes(task.notes, task.status),
      warrantyTracking: parseAvailabilityFromTaskNotes(task.notes, task.status) === 'done' ? 'Active' : 'Pending',
    }));
    return rows;
  }, [filteredImplantSupplierTasks, mergedPatientNameById]);

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
        .sort((left, right) => right.debt - left.debt),
    [endDate, filteredInvoices, selectedDebtAgingBucket]
  );

  const isLoadingAny = isLoadingCoreData
    || isLoadingExecutiveSummary
    || isLoadingFinanceData
    || isLoadingInventoryData;

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
      activePatients: displayKpis.activePatients,
      appointmentCompletionRate: displayKpis.appointmentCompletionRate,
      appointments: displayKpis.appointments,
      billed: displayKpis.billed,
      collectionRate: displayKpis.collectionRate,
      debt: displayKpis.debt,
      discount: displayKpis.discount,
      generatedAt: now,
      granularity,
      id: `${now}-${Math.floor(Math.random() * 10000)}`,
      net: displayKpis.net,
      paid: displayKpis.paid,
      rangeEnd: endDate,
      rangeStart: startDate,
      statusFilter: globalStatusFilter,
      visits: displayKpis.visits,
    };

    setSnapshotRecords((previous) => [snapshot, ...previous].slice(0, 60));
    setLastSnapshotRunAt(now);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(`${REPORT_SCHEDULE_KEY}_last_run`, now);
    }

    if (reason === 'manual') {
      window.alert('Snapshot captured.');
    }
  }, [displayKpis, endDate, globalStatusFilter, granularity, startDate]);

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
      audit: 'Audit & Compliance Reports',
      clinical: 'Clinical Reports',
      executive: 'Executive Dashboard',
      financial: 'Financial Reports',
      inventory: 'Inventory Reports',
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

    const totalOutcomeForPrint = Number((displayKpis.expenses + displayKpis.salaryPaid + displayKpis.thirdCompanyPaid).toFixed(2));
    const profitOrLossForPrint = displayProfitOrLoss;
    const executiveTrendRowsForPrint = displayExecutiveRevenueTrendMonthly.map((row) => ({
      income: row.amount,
      label: row.label,
      paymentCount: '-',
    }));
    const formatRow = (label: string, value: string): string => `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`;
    const summaryRows = [
      formatRow('Date Range', `${formatFullDate(startDate)} to ${formatFullDate(endDate)}`),
      formatRow('Granularity', toHumanLabel(granularity)),
      formatRow('Status Filter', toHumanLabel(globalStatusFilter)),
      formatRow('Reporting Currency', 'AFN (Afghani)'),
      formatRow('Billed', formatCurrency(displayKpis.billed)),
      formatRow('Discount', formatCurrency(displayKpis.discount)),
      formatRow('Net', formatCurrency(displayKpis.net)),
      formatRow('Paid', formatCurrency(displayKpis.paid)),
      formatRow('Debt', formatCurrency(displayKpis.debt)),
      formatRow('Expenses', formatCurrency(displayKpis.expenses)),
      formatRow('Third-Company Paid', formatCurrency(displayKpis.thirdCompanyPaid)),
      formatRow('Third-Company Unpaid', formatCurrency(displayKpis.thirdCompanyUnpaid)),
      formatRow('Third-Company Supplier Total', formatCurrency(displayKpis.thirdCompanyTotal)),
      formatRow('Third-Company Unpaid Teeth', String(displayKpis.thirdCompanyUnpaidCount)),
      formatRow('Net After Expenses', formatCurrency(displayKpis.netAfterExpenses)),
      formatRow('Safe Outflow', formatCurrency(displayKpis.safeOut)),
      formatRow('Salaries Paid', formatCurrency(displayKpis.salaryPaid)),
      formatRow('Collection Rate', `${displayKpis.collectionRate}%`),
      formatRow('Profit / Loss', formatCurrency(profitOrLossForPrint)),
    ].join('');

    const maxBar = Math.max(displayKpis.paid, totalOutcomeForPrint, 1);
    const paidBarWidth = Math.min(100, (displayKpis.paid / maxBar) * 100);
    const outcomeBarWidth = Math.min(100, (totalOutcomeForPrint / maxBar) * 100);
    const profitBarWidth = Math.min(100, (Math.abs(profitOrLossForPrint) / maxBar) * 100);
    const profitLossSection = `
      <h3>Profit / Loss Visual</h3>
      <div class="bar-wrap"><span>Income (Paid)</span><div class="bar bg-blue"><i style="width:${paidBarWidth}%"></i></div><b>${escapeHtml(formatCurrency(displayKpis.paid))}</b></div>
      <div class="bar-wrap"><span>Outcome (Expenses + Salaries + Third-Company)</span><div class="bar bg-orange"><i style="width:${outcomeBarWidth}%"></i></div><b>${escapeHtml(formatCurrency(totalOutcomeForPrint))}</b></div>
      <div class="bar-wrap"><span>${profitOrLossForPrint >= 0 ? 'Profit' : 'Loss'}</span><div class="bar ${profitOrLossForPrint >= 0 ? 'bg-emerald' : 'bg-red'}"><i style="width:${profitBarWidth}%"></i></div><b>${escapeHtml(formatCurrency(profitOrLossForPrint))}</b></div>
    `;
    const salaryRowsForPrint = salaryRows
      .filter((row) => inRange(row.paymentDate, startDate, endDate));
    const paymentMethodRowsForPrint = paymentMethodMix;
    const outstandingInvoicesForPrint = outstandingInvoices;
    const thirdCompanyStatusUnpaidRows = thirdCompanyStatusChart.filter((row) => row.unpaid > 0);
    const thirdCompanyStatusCountRows = thirdCompanyStatusChart.filter((row) => row.count > 0);

    const overviewBodySection = `
      ${profitLossSection}
      ${buildLineChart(executiveTrendRowsForPrint.map((point) => ({ label: point.label, value: point.income })), '#0ea5e9', 'Income Trend Diagram')}
      <h3>Income Trend</h3>
      <table><thead><tr><th>Bucket</th><th>Income</th><th>Payments</th></tr></thead><tbody>
        ${executiveTrendRowsForPrint.map((point) => `<tr><td>${escapeHtml(point.label)}</td><td>${escapeHtml(formatCurrency(point.income))}</td><td>${point.paymentCount}</td></tr>`).join('')}
      </tbody></table>
      <h3>Revenue by Treatment Type</h3>
      <table><thead><tr><th>Treatment</th><th>Sessions</th><th>Revenue</th></tr></thead><tbody>
        ${displayTreatmentVolume.map((row) => `<tr><td>${escapeHtml(row.name)}</td><td>${row.sessions}</td><td>${escapeHtml(formatCurrency(row.revenue))}</td></tr>`).join('')}
      </tbody></table>
      <h3>Revenue by Dentist</h3>
      <table><thead><tr><th>Dentist</th><th>Visits</th><th>Revenue</th></tr></thead><tbody>
        ${displayDentistProductivity.map((row) => `<tr><td>${escapeHtml(row.dentist)}</td><td>${row.visits}</td><td>${escapeHtml(formatCurrency(row.revenue))}</td></tr>`).join('')}
      </tbody></table>
      <h3>Implant Placement Trend</h3>
      <table><thead><tr><th>Month</th><th>Placements</th><th>Revenue</th></tr></thead><tbody>
        ${displayImplantPlacementTrend.map((row) => `<tr><td>${escapeHtml(row.label)}</td><td>${row.count}</td><td>${escapeHtml(formatCurrency(row.revenue))}</td></tr>`).join('')}
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
      <h3>Expense Details</h3>
      ${[...filteredDailyExpenses, ...filteredClinicalExpenses].length === 0
    ? '<p class="muted">No expense rows in selected range.</p>'
    : `<table><thead><tr><th>Date</th><th>Type</th><th>Category</th><th>Amount</th></tr></thead><tbody>
          ${[...filteredDailyExpenses, ...filteredClinicalExpenses].map((row) => `<tr><td>${escapeHtml(formatFullDate(row.expenseDate))}</td><td>${escapeHtml(toHumanLabel(row.expenseType))}</td><td>${escapeHtml(row.category)}</td><td>${escapeHtml(formatCurrency(row.amount))}</td></tr>`).join('')}
        </tbody></table>`}
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
    if (activeTab === 'executive') {
      bodySections = `
        <h2>Executive Dashboard</h2>
        ${overviewBodySection}
      `;
    }
    if (activeTab === 'financial') {
      bodySections = `
        <h2>Financial Reports</h2>
        ${financialBodySection}
      `;
    }
    if (activeTab === 'clinical') {
      bodySections = `
        <h3>Treatment Performance</h3>
        <table><thead><tr><th>Metric</th><th>Value</th></tr></thead><tbody>
          <tr><td>Completed Treatments</td><td>${treatmentPerformanceSummary.completedTreatments}</td></tr>
          <tr><td>Cancelled Treatments</td><td>${treatmentPerformanceSummary.cancelledTreatments}</td></tr>
          <tr><td>Average Duration</td><td>${treatmentPerformanceSummary.avgDurationMinutes > 0 ? `${treatmentPerformanceSummary.avgDurationMinutes}m` : 'N/A'}</td></tr>
          <tr><td>Success Rate</td><td>${treatmentPerformanceSummary.successRate}%</td></tr>
        </tbody></table>
        <h3>Treatment Volume</h3>
        <table><thead><tr><th>Treatment</th><th>Sessions</th><th>Revenue</th></tr></thead><tbody>
          ${treatmentVolume.map((row) => `<tr><td>${escapeHtml(row.name)}</td><td>${row.sessions}</td><td>${escapeHtml(formatCurrency(row.revenue))}</td></tr>`).join('')}
        </tbody></table>
        <h3>Dentist Performance</h3>
        <table><thead><tr><th>Dentist</th><th>Patients Seen</th><th>Revenue</th><th>Treatments</th><th>Commission</th></tr></thead><tbody>
          ${dentistPerformanceRows.map((row) => `<tr><td>${escapeHtml(row.dentist)}</td><td>${row.patientsSeen}</td><td>${escapeHtml(formatCurrency(row.revenue))}</td><td>${row.treatments}</td><td>${escapeHtml(formatCurrency(row.commission))}</td></tr>`).join('')}
        </tbody></table>
        <h3>Implant Success Report</h3>
        <table><thead><tr><th>Patient</th><th>Brand</th><th>Placement Date</th><th>Failures</th><th>Warranty</th></tr></thead><tbody>
          ${implantSuccessRows.map((row) => `<tr><td>${escapeHtml(row.patientName)}</td><td>${escapeHtml(row.brand)}</td><td>${escapeHtml(formatFullDate(row.placementDate))}</td><td>${row.failures}</td><td>${escapeHtml(row.warrantyTracking)}</td></tr>`).join('')}
        </tbody></table>
        <h3>Prescriptions</h3>
        <table><thead><tr><th>Date</th><th>Patient</th><th>Treatment</th><th>Dentist</th><th>Prescription</th></tr></thead><tbody>
          ${clinicalPrescriptionRows.length === 0
    ? '<tr><td colspan="5">No prescription data in selected range.</td></tr>'
    : clinicalPrescriptionRows.map((row) => `<tr><td>${escapeHtml(formatFullDate(row.visitDate))}</td><td>${escapeHtml(row.patientName)}</td><td>${escapeHtml(row.treatmentName)}</td><td>${escapeHtml(row.dentist)}</td><td>${escapeHtml(row.prescription)}</td></tr>`).join('')}
        </tbody></table>
      `;
    }
    if (activeTab === 'inventory') {
      bodySections = `
        <h3>Inventory Summary</h3>
        <table><thead><tr><th>Metric</th><th>Value</th></tr></thead><tbody>
          <tr><td>Total Items in Database</td><td>${totalInventoryItemsInDatabase}</td></tr>
          <tr><td>Total Usage Rows (Selected Range)</td><td>${inventoryUsageRows.length}</td></tr>
        </tbody></table>
        <h3>Stock Status</h3>
        <table><thead><tr><th>Item</th><th>In Stock</th><th>Min</th><th>Expiry</th><th>Status</th></tr></thead><tbody>
          ${stockStatusRows.map((row) => `<tr><td>${escapeHtml(row.itemName)}</td><td>${row.quantity}</td><td>${row.minStock}</td><td>${escapeHtml(formatFullDate(row.expiryDate))}</td><td>${escapeHtml(row.status)}</td></tr>`).join('')}
        </tbody></table>
        <h3>Material Usage Per Treatment</h3>
        <table><thead><tr><th>Treatment</th><th>Sessions</th><th>Total Cost</th><th>Avg Cost</th></tr></thead><tbody>
          ${materialUsagePerTreatment.map((row) => `<tr><td>${escapeHtml(row.treatment)}</td><td>${row.sessions}</td><td>${escapeHtml(formatCurrency(row.totalCost))}</td><td>${escapeHtml(formatCurrency(row.avgCost))}</td></tr>`).join('')}
        </tbody></table>
        <h3>Implant Inventory</h3>
        <table><thead><tr><th>Item</th><th>Batch / Serial</th><th>Qty</th><th>Supplier</th><th>Entry Date</th><th>Expiry</th></tr></thead><tbody>
          ${implantInventoryRows.map((row) => `<tr><td>${escapeHtml(row.itemName)}</td><td>${escapeHtml(row.lotNumber || '-')}</td><td>${row.quantity}</td><td>${escapeHtml(row.supplier || '-')}</td><td>${escapeHtml(formatFullDate(row.entryDate))}</td><td>${escapeHtml(formatFullDate(row.expiryDate))}</td></tr>`).join('')}
        </tbody></table>
        <h3>Inventory Usage by Patient</h3>
        <table><thead><tr><th>Date</th><th>Item</th><th>Qty Used</th><th>Patient</th><th>Treatment</th><th>Visit</th></tr></thead><tbody>
          ${inventoryUsageRows.length === 0
    ? '<tr><td colspan="6">No inventory usage data in selected range.</td></tr>'
    : inventoryUsageRows.map((row) => `<tr><td>${escapeHtml(formatFullDate(row.usedOn))}</td><td>${escapeHtml(row.itemName)}</td><td>${escapeHtml(`${row.quantityUsed} ${row.unit}`)}</td><td>${escapeHtml(row.patientName)}</td><td>${escapeHtml(row.treatmentName)}</td><td>${escapeHtml(row.visitLabel)}</td></tr>`).join('')}
        </tbody></table>
      `;
    }
    if (activeTab === 'audit') {
      bodySections = `
        <h3>Financial Modification Log</h3>
        <table><thead><tr><th>Entity</th><th>Action</th><th>Changed By</th><th>Timestamp</th><th>Before</th><th>After</th></tr></thead><tbody>
          ${financialModificationLogRows.map((row) => `<tr><td>${escapeHtml(row.entity)}</td><td>${escapeHtml(row.action)}</td><td>${escapeHtml(row.changedBy)}</td><td>${escapeHtml(formatDateTime(row.timestamp))}</td><td>${escapeHtml(row.beforeValue)}</td><td>${escapeHtml(row.afterValue)}</td></tr>`).join('')}
        </tbody></table>
        <h3>Access Logs</h3>
        <table><thead><tr><th>Action</th><th>User</th><th>Range</th><th>Timestamp</th></tr></thead><tbody>
          ${accessLogRows.map((row) => `<tr><td>${escapeHtml(row.action)}</td><td>${escapeHtml(row.user)}</td><td>${escapeHtml(row.range)}</td><td>${escapeHtml(formatDateTime(row.generatedAt))}</td></tr>`).join('')}
        </tbody></table>
        <h3>Snapshots</h3>
        <table><thead><tr><th>Generated</th><th>Range</th><th>Billed</th><th>Paid</th><th>Debt</th></tr></thead><tbody>
          ${snapshotRecords.map((row) => `<tr><td>${escapeHtml(formatDateTime(row.generatedAt))}</td><td>${escapeHtml(`${formatFullDate(row.rangeStart)} to ${formatFullDate(row.rangeEnd)}`)}</td><td>${escapeHtml(formatCurrency(row.billed))}</td><td>${escapeHtml(formatCurrency(row.paid))}</td><td>${escapeHtml(formatCurrency(row.debt))}</td></tr>`).join('')}
        </tbody></table>
      `;
    }

    const printHtml = `<!doctype html><html><head><meta charset="utf-8"/><title>${escapeHtml(titleByTab[activeTab])}</title><style>
      @page{margin:18mm}
      body{font-family:Arial,sans-serif;padding:20px;color:#0f172a}
      h1,h2,h3{margin:0 0 8px}
      table{width:100%;border-collapse:collapse;margin:8px 0}
      th,td{border:1px solid #d1d5db;padding:6px;text-align:left;font-size:12px}
      th{background:#f1f5f9}
      .report-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px}
      .logo-box{border:1px dashed #94a3b8;border-radius:8px;padding:8px 12px;font-size:11px;color:#64748b}
      .meta-line{font-size:12px;color:#334155;margin:2px 0}
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
      .page-footer{position:fixed;right:0;bottom:0;font-size:10px;color:#64748b}
      .page-footer::after{content:"Page " counter(page)}
      @media print{
        body,th,td{
          -webkit-print-color-adjust:exact !important;
          print-color-adjust:exact !important;
        }
        .type-invoice td{background:#fffbeb !important}
        .type-payment td{background:#ecfdf5 !important}
      }
    </style></head><body>
      <div class="report-head">
        <div class="logo-box">Clinic Logo</div>
        <div>
          <h1>${escapeHtml(titleByTab[activeTab])}</h1>
          <p class="meta-line">Generated at: ${escapeHtml(formatDateTime(new Date().toISOString()))}</p>
          <p class="meta-line">Generated by: Current User</p>
          <p class="meta-line">Filters: Date ${escapeHtml(formatFullDate(startDate))} to ${escapeHtml(formatFullDate(endDate))} | Dentist ${escapeHtml(selectedDentistFilter)} | Treatment ${escapeHtml(selectedTreatmentFilter)} | Payment ${escapeHtml(toHumanLabel(selectedPaymentMethodFilter))} | Patient ${escapeHtml(selectedPatientFilter)} | Status ${escapeHtml(toHumanLabel(globalStatusFilter))}</p>
        </div>
      </div>
      <h3>Summary</h3>
      <table><tbody>${summaryRows}</tbody></table>
      ${bodySections}
      <div class="page-footer"></div>
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

  const handleGlobalExport = (): void => {
    if (exportFormat === 'pdf') {
      printCurrentTabTemplate();
      return;
    }

    const parseTaggedText = (notes: string | undefined, key: string): string => {
      if (!notes) return '';
      const match = notes.match(new RegExp(`\\[${key}:([^\\]]+)\\]`, 'i'));
      return match?.[1]?.trim() ?? '';
    };
    const parseTaggedNumber = (notes: string | undefined, key: string): number => {
      const value = parseTaggedText(notes, key);
      return parseAmount(value);
    };
    const parseTaggedDate = (notes: string | undefined, key: string): string => {
      const raw = parseTaggedText(notes, key);
      const parsed = parseDate(raw);
      return parsed ? formatFullDate(raw) : '-';
    };

    const patientPhoneById = new Map<string, string>();
    typedPatients.forEach((patient) => {
      const record = patient as unknown as Record<string, unknown>;
      const phone = asText(
        record.phoneNumber
        ?? record.phone_number
        ?? record.mobile
        ?? record.mobileNumber
        ?? record.mobile_number
        ?? record.contactNumber
        ?? record.contact_number
      );
      patientPhoneById.set(String(patient.id), phone || '-');
    });

    const invoiceMetaById = new Map<string, { createdBy: string; taxAmount: number }>();
    invoiceRows.forEach((row) => {
      const invoiceId = asText(row.id);
      if (!invoiceId) return;
      invoiceMetaById.set(invoiceId, {
        createdBy: asText(row.createdBy ?? row.created_by) || 'System',
        taxAmount: parseAmount(row.taxAmount ?? row.tax_amount ?? row.vatAmount ?? row.vat_amount ?? 0),
      });
    });

    const paymentInfoByInvoiceId = new Map<string, { lastPaymentDate: string; methods: Set<string> }>();
    const exportEndTs = parseDate(endDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    parsedData.allPayments.forEach((payment) => {
      const paymentTs = parseDate(payment.date)?.getTime() ?? Number.MIN_SAFE_INTEGER;
      if (paymentTs > exportEndTs) return;
      const current = paymentInfoByInvoiceId.get(payment.invoiceId) ?? { lastPaymentDate: '', methods: new Set<string>() };
      current.methods.add(toHumanLabel(payment.method || 'cash'));
      if (!current.lastPaymentDate || paymentTs > (parseDate(current.lastPaymentDate)?.getTime() ?? Number.MIN_SAFE_INTEGER)) {
        current.lastPaymentDate = payment.date;
      }
      paymentInfoByInvoiceId.set(payment.invoiceId, current);
    });

    if (csvExportType === 'financial_revenue') {
      const treatmentSummaryByVisitId = new Map<string, {
        categories: Set<string>;
        ids: Set<string>;
        materialCost: number;
        names: Set<string>;
        quantity: number;
      }>();
      filteredVisitTreatments.forEach((row) => {
        const visitId = asText(row.visitId);
        if (!visitId) return;
        const summary = treatmentSummaryByVisitId.get(visitId) ?? {
          categories: new Set<string>(),
          ids: new Set<string>(),
          materialCost: 0,
          names: new Set<string>(),
          quantity: 0,
        };
        summary.quantity += 1;
        summary.ids.add(asText(row.treatmentId) || '-');
        summary.names.add(row.treatment?.name || `Treatment ${row.treatmentId}`);
        const category = asText((row.treatment as unknown as Record<string, unknown> | undefined)?.category);
        summary.categories.add(category || 'General');
        summary.materialCost = Number((
          summary.materialCost
          + parseAmount((row as unknown as Record<string, unknown>).materialCost ?? (row as unknown as Record<string, unknown>).material_cost ?? 0)
        ).toFixed(2));
        treatmentSummaryByVisitId.set(visitId, summary);
      });

      const rows = filteredInvoices.map((invoice) => {
        const visit = visitById.get(invoice.visitId);
        const treatmentSummary = treatmentSummaryByVisitId.get(invoice.visitId);
        const paymentInfo = paymentInfoByInvoiceId.get(invoice.id);
        const invoiceMeta = invoiceMetaById.get(invoice.id);
        const taxAmount = invoiceMeta?.taxAmount ?? 0;
        const dentistCommission = Number((invoice.net * 0.1).toFixed(2));
        const clinicShare = Number((invoice.net - dentistCommission).toFixed(2));
        return {
          'Invoice ID': invoice.id,
          'Invoice Date': formatFullDate(invoice.date),
          'Patient ID': invoice.patientId || '-',
          'Patient Name': mergedPatientNameById.get(invoice.patientId) || `Patient #${invoice.patientId || '-'}`,
          'Treatment ID': treatmentSummary ? [...treatmentSummary.ids].join(' | ') : '-',
          'Treatment Name': treatmentSummary ? [...treatmentSummary.names].join(' | ') : '-',
          Dentist: asText(visit?.dentistName) || `Dentist #${asText(visit?.dentistId) || '-'}`,
          'Treatment Category': treatmentSummary ? [...treatmentSummary.categories].join(' | ') : '-',
          Quantity: treatmentSummary?.quantity ?? 1,
          'Gross Amount': formatCsvAmount(invoice.total),
          'Discount Amount': formatCsvAmount(invoice.discount),
          'Tax Amount': formatCsvAmount(taxAmount),
          'Net Amount': formatCsvAmount(invoice.net),
          'Material Cost': formatCsvAmount(treatmentSummary?.materialCost ?? 0),
          'Clinic Share': formatCsvAmount(clinicShare),
          'Dentist Commission': formatCsvAmount(dentistCommission),
          'Payment Status': toHumanLabel(invoice.status),
          'Payment Method': paymentInfo ? [...paymentInfo.methods].join(' | ') : '-',
          'Created By': invoiceMeta?.createdBy || 'System',
        };
      });

      downloadCsv(`financial-revenue-${startDate}-to-${endDate}.csv`, rows.length > 0 ? rows : [{
        'Invoice ID': 'No data',
        'Invoice Date': '-',
        'Patient ID': '-',
        'Patient Name': '-',
        'Treatment ID': '-',
        'Treatment Name': '-',
        Dentist: '-',
        'Treatment Category': '-',
        Quantity: '-',
        'Gross Amount': '-',
        'Discount Amount': '-',
        'Tax Amount': '-',
        'Net Amount': '-',
        'Material Cost': '-',
        'Clinic Share': '-',
        'Dentist Commission': '-',
        'Payment Status': '-',
        'Payment Method': '-',
        'Created By': '-',
      }]);
      return;
    }

    if (csvExportType === 'financial_outstanding') {
      const rows = outstandingInvoices.map((invoice) => {
        const visit = visitById.get(invoice.visitId);
        const paymentInfo = paymentInfoByInvoiceId.get(invoice.id);
        const ageDays = Math.max(0, Math.floor(((parseDate(endDate)?.getTime() ?? 0) - (parseDate(invoice.date)?.getTime() ?? 0)) / MS_PER_DAY));
        const bucket = toDebtAgingBucket(invoice.date, endDate);
        return {
          'Patient ID': invoice.patientId || '-',
          'Patient Name': mergedPatientNameById.get(invoice.patientId) || `Patient #${invoice.patientId || '-'}`,
          'Invoice ID': invoice.id,
          'Invoice Date': formatFullDate(invoice.date),
          'Total Amount': formatCsvAmount(invoice.net),
          'Total Paid': formatCsvAmount(invoice.paid),
          'Remaining Balance': formatCsvAmount(invoice.debt),
          'Days Overdue': ageDays,
          '0-30 Days': formatCsvAmount(bucket === '0-30 days' ? invoice.debt : 0),
          '31-60 Days': formatCsvAmount(bucket === '31-60 days' ? invoice.debt : 0),
          '61-90 Days': formatCsvAmount(bucket === '61-90 days' ? invoice.debt : 0),
          '90+ Days': formatCsvAmount(bucket === '90+ days' ? invoice.debt : 0),
          'Contact Number': patientPhoneById.get(invoice.patientId) || '-',
          'Last Payment Date': paymentInfo?.lastPaymentDate ? formatFullDate(paymentInfo.lastPaymentDate) : '-',
          'Responsible Dentist': asText(visit?.dentistName) || `Dentist #${asText(visit?.dentistId) || '-'}`,
        };
      });

      downloadCsv(`financial-outstanding-${startDate}-to-${endDate}.csv`, rows.length > 0 ? rows : [{
        'Patient ID': 'No data',
        'Patient Name': '-',
        'Invoice ID': '-',
        'Invoice Date': '-',
        'Total Amount': '-',
        'Total Paid': '-',
        'Remaining Balance': '-',
        'Days Overdue': '-',
        '0-30 Days': '-',
        '31-60 Days': '-',
        '61-90 Days': '-',
        '90+ Days': '-',
        'Contact Number': '-',
        'Last Payment Date': '-',
        'Responsible Dentist': '-',
      }]);
      return;
    }

    if (csvExportType === 'financial_daily_safe') {
      const transactions = safeRows
        .filter((row) => inRange(row.transactionDate, startDate, endDate))
        .sort((left, right) => {
          const leftTs = parseDate(left.transactionDate)?.getTime() ?? 0;
          const rightTs = parseDate(right.transactionDate)?.getTime() ?? 0;
          if (leftTs !== rightTs) return leftTs - rightTs;
          return left.id.localeCompare(right.id, undefined, { numeric: true, sensitivity: 'base' });
        });

      let runningBalance = dailyFinancialSummary.openingBalance;
      const rows = transactions.map((row) => {
        const delta = row.direction === 'in' ? row.amount : -row.amount;
        runningBalance = Number((runningBalance + delta).toFixed(2));
        return {
          'Transaction ID': row.id,
          'Transaction Date': formatFullDate(row.transactionDate),
          'Type (IN/OUT)': row.direction === 'in' ? 'IN' : 'OUT',
          Source: toHumanLabel(row.entryType || 'manual'),
          'Reference ID': row.id,
          Description: row.notes || '-',
          Amount: formatCsvAmount(row.amount),
          'Handled By': row.pickedByStaffName || row.pickedByStaffId || '-',
          'Opening Balance': formatCsvAmount(dailyFinancialSummary.openingBalance),
          'Running Balance': formatCsvAmount(runningBalance),
          'Closing Balance': formatCsvAmount(dailyFinancialSummary.closingBalance),
          Variance: formatCsvAmount(dailyFinancialSummary.variance),
        };
      });

      downloadCsv(`daily-safe-${startDate}-to-${endDate}.csv`, rows.length > 0 ? rows : [{
        'Transaction ID': 'No data',
        'Transaction Date': '-',
        'Type (IN/OUT)': '-',
        Source: '-',
        'Reference ID': '-',
        Description: '-',
        Amount: '-',
        'Handled By': '-',
        'Opening Balance': formatCsvAmount(dailyFinancialSummary.openingBalance),
        'Running Balance': formatCsvAmount(dailyFinancialSummary.openingBalance),
        'Closing Balance': formatCsvAmount(dailyFinancialSummary.closingBalance),
        Variance: formatCsvAmount(dailyFinancialSummary.variance),
      }]);
      return;
    }

    if (csvExportType === 'financial_shareholder') {
      const rows = shareholderTransactionsInRange
        .map((row) => ({
          'Transaction ID': row.id,
          Date: formatFullDate(row.transactionDate),
          Shareholder: row.shareholderName || `Shareholder #${row.shareholderId || '-'}`,
          Type: row.transactionType,
          Amount: formatCsvAmount(row.amountInput),
          'Safe Effect': row.transactionType === 'contribution' ? 'IN' : 'OUT',
          Notes: row.notes || '-',
        }))
        .sort((left, right) => String(left.Date).localeCompare(String(right.Date)));

      downloadCsv(`shareholder-ledger-${startDate}-to-${endDate}.csv`, rows.length > 0 ? rows : [{
        'Transaction ID': 'No data',
        Date: '-',
        Shareholder: '-',
        Type: '-',
        Amount: '-',
        'Safe Effect': '-',
        Notes: '-',
      }]);
      return;
    }

    if (csvExportType === 'financial_implant_installment') {
      const taskById = new Map<string, ImplantSupplierTaskLike>();
      filteredImplantSupplierTasks.forEach((task) => {
        taskById.set(asText(task.id), task);
      });
      const rows = thirdCompanySummary.rows.map((row) => {
        const task = taskById.get(asText(row.taskId));
        const depositPaid = parseTaggedNumber(task?.notes, 'deposit_paid');
        const installmentAmount = parseTaggedNumber(task?.notes, 'installment_amount');
        const totalPaid = row.supplierPaid;
        return {
          'Implant ID': asText(row.taskId) || '-',
          'Patient Name': mergedPatientNameById.get(row.patientId) || `Patient #${row.patientId || '-'}`,
          'Implant Brand': parseTaggedText(task?.notes, 'implant_brand') || 'Implant',
          'Serial Number': parseTaggedText(task?.notes, 'serial_number') || '-',
          'Placement Date': formatFullDate(row.createdAt),
          'Total Cost': formatCsvAmount(row.supplierTotal),
          'Deposit Paid': formatCsvAmount(depositPaid > 0 ? depositPaid : Math.min(totalPaid, row.supplierTotal)),
          'Installment Amount': formatCsvAmount(installmentAmount > 0 ? installmentAmount : 0),
          'Total Paid': formatCsvAmount(totalPaid),
          'Remaining Balance': formatCsvAmount(row.supplierRemaining),
          'Next Due Date': parseTaggedDate(task?.notes, 'next_due_date'),
          'Payment Status': row.supplierRemaining > 0 ? 'Pending' : 'Paid',
          'Warranty Expiry': parseTaggedDate(task?.notes, 'warranty_expiry'),
          Surgeon: parseTaggedText(task?.notes, 'surgeon') || '-',
        };
      });

      downloadCsv(`implant-installments-${startDate}-to-${endDate}.csv`, rows.length > 0 ? rows : [{
        'Implant ID': 'No data',
        'Patient Name': '-',
        'Implant Brand': '-',
        'Serial Number': '-',
        'Placement Date': '-',
        'Total Cost': '-',
        'Deposit Paid': '-',
        'Installment Amount': '-',
        'Total Paid': '-',
        'Remaining Balance': '-',
        'Next Due Date': '-',
        'Payment Status': '-',
        'Warranty Expiry': '-',
        Surgeon: '-',
      }]);
      return;
    }

    if (csvExportType === 'clinical_treatment') {
      const grouped = new Map<string, {
        completionDate: string;
        dentist: string;
        diagnosis: string;
        materialCost: number;
        notes: string;
        outcome: string;
        patientId: string;
        prescriptions: Set<string>;
        procedureType: string;
        sessions: number;
        startDate: string;
        status: string;
        totalCost: number;
        treatmentId: string;
      }>();

      filteredVisitTreatments.forEach((row) => {
        const visit = visitById.get(asText(row.visitId));
        const patientId = asText(visit?.patientId);
        const treatmentId = asText(row.treatmentId) || '-';
        const dentist = asText(visit?.dentistName) || `Dentist #${asText(visit?.dentistId) || '-'}`;
        const visitDate = asText(row.visit?.visitDate) || asText(visit?.visitDate) || asText(row.createdAt);
        const status = toHumanLabel(asText((visit as unknown as Record<string, unknown> | undefined)?.status) || 'completed');
        const diagnosis = asText((visit as unknown as Record<string, unknown> | undefined)?.diagnosis) || '-';
        const procedureType = asText((row.treatment as unknown as Record<string, unknown> | undefined)?.category) || 'General';
        const treatmentNotes = asText((row as unknown as Record<string, unknown>).notes);
        const prescription = formatPrescriptionSummary(row.prescription);
        const materialCost = parseAmount(
          (row as unknown as Record<string, unknown>).materialCost
          ?? (row as unknown as Record<string, unknown>).material_cost
          ?? 0
        );
        const key = `${patientId}|${treatmentId}|${dentist}`;
        const current = grouped.get(key) ?? {
          completionDate: visitDate,
          dentist,
          diagnosis,
          materialCost: 0,
          notes: treatmentNotes || '-',
          outcome: status.toLowerCase() === 'completed' ? 'Successful' : '-',
          patientId,
          prescriptions: new Set<string>(),
          procedureType,
          sessions: 0,
          startDate: visitDate,
          status,
          totalCost: 0,
          treatmentId,
        };

        const currentStart = parseDate(current.startDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const currentEnd = parseDate(current.completionDate)?.getTime() ?? Number.MIN_SAFE_INTEGER;
        const rowDate = parseDate(visitDate)?.getTime() ?? Number.MIN_SAFE_INTEGER;
        if (rowDate < currentStart) current.startDate = visitDate;
        if (rowDate > currentEnd) current.completionDate = visitDate;

        current.sessions += 1;
        current.totalCost = Number((current.totalCost + parseAmount(row.price)).toFixed(2));
        current.materialCost = Number((current.materialCost + materialCost).toFixed(2));
        if (prescription && prescription !== '-') {
          current.prescriptions.add(prescription);
        }
        grouped.set(key, current);
      });

      const rows = [...grouped.values()].map((row) => ({
        'Treatment ID': row.treatmentId,
        'Patient Name': mergedPatientNameById.get(row.patientId) || `Patient #${row.patientId || '-'}`,
        Dentist: row.dentist,
        Diagnosis: row.diagnosis,
        'Procedure Type': row.procedureType,
        'Start Date': formatFullDate(row.startDate),
        'Completion Date': formatFullDate(row.completionDate),
        'Number of Sessions': row.sessions,
        'Treatment Status': row.status,
        'Total Cost': formatCsvAmount(row.totalCost),
        'Material Used Cost': formatCsvAmount(row.materialCost),
        Prescription: row.prescriptions.size > 0 ? [...row.prescriptions].join(' | ') : '-',
        Outcome: row.outcome,
        'Notes (Optional)': row.notes,
      }));

      downloadCsv(`clinical-treatment-${startDate}-to-${endDate}.csv`, rows.length > 0 ? rows : [{
        'Treatment ID': 'No data',
        'Patient Name': '-',
        Dentist: '-',
        Diagnosis: '-',
        'Procedure Type': '-',
        'Start Date': '-',
        'Completion Date': '-',
        'Number of Sessions': '-',
        'Treatment Status': '-',
        'Total Cost': '-',
        'Material Used Cost': '-',
        Prescription: '-',
        Outcome: '-',
        'Notes (Optional)': '-',
      }]);
      return;
    }

    if (csvExportType === 'inventory_stock') {
      const usageByItemId = new Map<string, InventoryUsageReportRow[]>();
      inventoryUsageRows.forEach((row) => {
        const list = usageByItemId.get(row.inventoryItemId) ?? [];
        list.push(row);
        usageByItemId.set(row.inventoryItemId, list);
      });

      const rows: Array<Record<string, string | number>> = [];
      stockStatusRows.forEach((row) => {
        const usageRows = usageByItemId.get(row.id) ?? [];
        if (usageRows.length === 0) {
          rows.push({
            'Item ID': row.id || '-',
            'Item Name': row.itemName,
            Category: toHumanLabel(row.category),
            Supplier: row.supplier || '-',
            'Purchase Price': formatCsvAmount(row.unitCost),
            'Selling Price': formatCsvAmount(row.sellingPrice),
            'Current Stock': row.quantity,
            'Minimum Level': row.minStock,
            'Expiry Date': formatFullDate(row.expiryDate),
            'Batch Number': row.lotNumber || '-',
            'Last Updated': formatFullDate(row.updatedAt || row.entryDate),
            'Stock Status': row.status,
            'Usage Date': '-',
            'Usage Qty': 0,
            'Used For Treatment': '-',
            'Used For Patient': '-',
            'Visit': '-',
          });
          return;
        }

        usageRows.forEach((usage) => {
          rows.push({
            'Item ID': row.id || '-',
            'Item Name': row.itemName,
            Category: toHumanLabel(row.category),
            Supplier: row.supplier || '-',
            'Purchase Price': formatCsvAmount(row.unitCost),
            'Selling Price': formatCsvAmount(row.sellingPrice),
            'Current Stock': row.quantity,
            'Minimum Level': row.minStock,
            'Expiry Date': formatFullDate(row.expiryDate),
            'Batch Number': row.lotNumber || '-',
            'Last Updated': formatFullDate(row.updatedAt || row.entryDate),
            'Stock Status': row.status,
            'Usage Date': formatFullDate(usage.usedOn),
            'Usage Qty': `${usage.quantityUsed} ${usage.unit}`,
            'Used For Treatment': usage.treatmentName,
            'Used For Patient': usage.patientName,
            Visit: usage.visitLabel,
          });
        });
      });

      downloadCsv(`inventory-stock-${startDate}-to-${endDate}.csv`, rows.length > 0 ? rows : [{
        'Item ID': 'No data',
        'Item Name': '-',
        Category: '-',
        Supplier: '-',
        'Purchase Price': '-',
        'Selling Price': '-',
        'Current Stock': '-',
        'Minimum Level': '-',
        'Expiry Date': '-',
        'Batch Number': '-',
        'Last Updated': '-',
        'Stock Status': '-',
        'Usage Date': '-',
        'Usage Qty': '-',
        'Used For Treatment': '-',
        'Used For Patient': '-',
        Visit: '-',
      }]);
      return;
    }

    if (csvExportType === 'audit_log') {
      const rows: Array<Record<string, string | number>> = [];
      let logCounter = 1;

      financialModificationLogRows.forEach((row) => {
        rows.push({
          'Log ID': logCounter++,
          User: row.changedBy || 'System',
          Role: '-',
          'Action Type': row.action,
          Module: row.entity.toLowerCase().includes('invoice') ? 'Financial' : 'Safe',
          'Record ID': row.entity,
          'Old Value': row.beforeValue,
          'New Value': row.afterValue,
          'IP Address': '-',
          Timestamp: formatDateTime(row.timestamp),
        });
      });

      accessLogRows.forEach((row) => {
        rows.push({
          'Log ID': logCounter++,
          User: row.user,
          Role: '-',
          'Action Type': row.action,
          Module: 'Reports',
          'Record ID': row.range,
          'Old Value': '-',
          'New Value': '-',
          'IP Address': '-',
          Timestamp: formatDateTime(row.generatedAt),
        });
      });

      downloadCsv(`audit-log-${startDate}-to-${endDate}.csv`, rows.length > 0 ? rows : [{
        'Log ID': 'No data',
        User: '-',
        Role: '-',
        'Action Type': '-',
        Module: '-',
        'Record ID': '-',
        'Old Value': '-',
        'New Value': '-',
        'IP Address': '-',
        Timestamp: '-',
      }]);
      return;
    }

    if (csvExportType === 'executive_summary') {
      const executiveRows = [
        { Metric: 'Total Revenue', Value: formatCsvAmount(displayKpis.paid) },
        { Metric: 'Net Profit', Value: formatCsvAmount(displayProfitOrLoss) },
        { Metric: 'Total Expenses', Value: formatCsvAmount(displayKpis.expenses) },
        { Metric: 'Outstanding Payments', Value: formatCsvAmount(displayKpis.debt) },
        { Metric: 'New Patients', Value: String(displayNewPatientsCount) },
        { Metric: 'Implant Revenue', Value: formatCsvAmount(displayImplantRevenue) },
        { Metric: 'Cash In Safe', Value: formatCsvAmount(displayCashInSafe) },
        { Metric: 'Bank Balance', Value: formatCsvAmount(displayBankBalance) },
        { Metric: 'Treatment Acceptance Rate', Value: `${displayTreatmentAcceptanceRate}%` },
        { Metric: 'Chair Utilization Rate', Value: `${displayChairUtilizationRate}%` },
      ];
      downloadCsv(`executive-summary-${startDate}-to-${endDate}.csv`, executiveRows);
      return;
    }

    const reportName = `${toHumanLabel(activeTab)} Report`;
    const exportRows: Array<Record<string, string | number>> = [];
    const addRow = (row: Partial<{
      Amount: string | number;
      Balance: string | number;
      Date: string;
      Dentist: string;
      Name: string;
      Notes: string;
      Paid: string | number;
      Patient: string;
      PaymentMethod: string;
      Quantity: string | number;
      Report: string;
      Section: string;
      Status: string;
      Subsection: string;
      Treatment: string;
    }>): void => {
      exportRows.push({
        Amount: '',
        Balance: '',
        Date: '',
        Dentist: '',
        Name: '',
        Notes: '',
        Paid: '',
        Patient: '',
        PaymentMethod: '',
        Quantity: '',
        Report: reportName,
        Section: '',
        Status: '',
        Subsection: '',
        Treatment: '',
        ...row,
      });
    };

    const selectedDentistLabel = selectedDentistFilter === 'all' ? 'All Dentists' : selectedDentistFilter;
    const selectedTreatmentLabel = selectedTreatmentFilter === 'all' ? 'All Treatments' : selectedTreatmentFilter;
    const selectedPaymentLabel = selectedPaymentMethodFilter === 'all' ? 'All Payment Methods' : toHumanLabel(selectedPaymentMethodFilter);
    const selectedPatientLabel = selectedPatientFilter === 'all'
      ? 'All Patients'
      : (patientFilterOptions.find((patient) => patient.id === selectedPatientFilter)?.name
          || mergedPatientNameById.get(selectedPatientFilter)
          || `Patient #${selectedPatientFilter}`);

    addRow({
      Name: 'Report Name',
      Notes: reportName,
      Section: 'Report Info',
      Subsection: 'Meta',
    });
    addRow({
      Date: `${formatFullDate(startDate)} to ${formatFullDate(endDate)}`,
      Name: 'Date Range',
      Section: 'Report Info',
      Subsection: 'Meta',
    });
    addRow({
      Name: 'Generated By',
      Notes: 'Current User',
      Section: 'Report Info',
      Subsection: 'Meta',
    });
    addRow({
      Date: formatDateTime(new Date().toISOString()),
      Name: 'Generated At',
      Section: 'Report Info',
      Subsection: 'Meta',
    });
    addRow({
      Name: 'Dentist Filter',
      Notes: selectedDentistLabel,
      Section: 'Report Filters',
      Subsection: 'Global Filters',
    });
    addRow({
      Name: 'Treatment Filter',
      Notes: selectedTreatmentLabel,
      Section: 'Report Filters',
      Subsection: 'Global Filters',
    });
    addRow({
      Name: 'Payment Method Filter',
      Notes: selectedPaymentLabel,
      Section: 'Report Filters',
      Subsection: 'Global Filters',
    });
    addRow({
      Name: 'Patient Filter',
      Notes: selectedPatientLabel,
      Section: 'Report Filters',
      Subsection: 'Global Filters',
    });
    addRow({
      Name: 'Status Filter',
      Notes: toHumanLabel(globalStatusFilter),
      Section: 'Report Filters',
      Subsection: 'Global Filters',
    });
    addRow({
      Name: 'Granularity',
      Notes: toHumanLabel(granularity),
      Section: 'Report Filters',
      Subsection: 'Global Filters',
    });

    if (activeTab === 'executive') {
      addRow({
        Amount: formatCsvAmount(displayKpis.paid),
        Name: 'Total Revenue',
        Section: 'Executive',
        Subsection: 'KPI',
      });
      addRow({
        Amount: formatCsvAmount(displayProfitOrLoss),
        Name: 'Net Profit',
        Section: 'Executive',
        Subsection: 'KPI',
      });
      addRow({
        Amount: formatCsvAmount(displayKpis.expenses),
        Name: 'Total Expenses',
        Section: 'Executive',
        Subsection: 'KPI',
      });
      addRow({
        Amount: formatCsvAmount(displayKpis.debt),
        Name: 'Outstanding',
        Section: 'Executive',
        Subsection: 'KPI',
      });
      addRow({
        Name: 'New Patients',
        Quantity: displayNewPatientsCount,
        Section: 'Executive',
        Subsection: 'KPI',
      });
      addRow({
        Amount: formatCsvAmount(displayImplantRevenue),
        Name: 'Implant Revenue',
        Section: 'Executive',
        Subsection: 'KPI',
      });
      addRow({
        Amount: formatCsvAmount(displayCashInSafe),
        Name: 'Cash In Safe',
        Section: 'Executive',
        Subsection: 'KPI',
      });
      addRow({
        Amount: formatCsvAmount(displayBankBalance),
        Name: 'Bank Balance',
        Section: 'Executive',
        Subsection: 'KPI',
      });
      addRow({
        Name: 'Treatment Acceptance Rate',
        Notes: `${displayTreatmentAcceptanceRate}%`,
        Section: 'Executive',
        Subsection: 'KPI',
      });
      addRow({
        Name: 'Chair Utilization Rate',
        Notes: `${displayChairUtilizationRate}%`,
        Section: 'Executive',
        Subsection: 'KPI',
      });

      displayExecutiveRevenueTrendMonthly.forEach((row) => {
        addRow({
          Amount: formatCsvAmount(row.amount),
          Date: row.label,
          Name: 'Revenue Trend',
          Section: 'Executive',
          Subsection: 'Revenue Trend Monthly',
        });
      });
      displayTreatmentVolume.forEach((row) => {
        addRow({
          Amount: formatCsvAmount(row.revenue),
          Name: row.name,
          Quantity: row.sessions,
          Section: 'Executive',
          Subsection: 'Revenue by Treatment',
          Treatment: row.name,
        });
      });
      displayDentistProductivity.forEach((row) => {
        addRow({
          Amount: formatCsvAmount(row.revenue),
          Dentist: row.dentist,
          Name: 'Dentist Revenue',
          Quantity: row.visits,
          Section: 'Executive',
          Subsection: 'Revenue by Dentist',
        });
      });
      displayImplantPlacementTrend.forEach((row) => {
        addRow({
          Amount: formatCsvAmount(row.revenue),
          Date: row.label,
          Name: 'Implant Placement',
          Quantity: row.count,
          Section: 'Executive',
          Subsection: 'Implant Placement Trend',
          Treatment: 'Implant',
        });
      });
      expenseSummary.byCategory.forEach((row) => {
        addRow({
          Amount: formatCsvAmount(row.amount),
          Name: row.category,
          Notes: 'Expense Category',
          Section: 'Executive',
          Subsection: 'Expense Breakdown',
        });
      });
    }

    if (activeTab === 'financial') {
      addRow({
        Amount: formatCsvAmount(dailyFinancialSummary.openingBalance),
        Name: 'Daily Financial Summary',
        Notes: `Cash In: ${formatCsvAmount(dailyFinancialSummary.totalCashIn)} | Cash Out: ${formatCsvAmount(dailyFinancialSummary.totalCashOut)} | Closing: ${formatCsvAmount(dailyFinancialSummary.closingBalance)}`,
        Paid: formatCsvAmount(dailyFinancialSummary.totalCashIn),
        Balance: formatCsvAmount(dailyFinancialSummary.closingBalance),
        Section: 'Financial',
        Subsection: 'Daily Financial',
      });
      addRow({
        Amount: formatCsvAmount(dailyFinancialSummary.physicalBalance),
        Balance: formatCsvAmount(dailyFinancialSummary.variance),
        Name: 'Physical Balance / Variance',
        Section: 'Financial',
        Subsection: 'Daily Financial',
      });

      revenueByTreatmentRows.forEach((row) => {
        addRow({
          Amount: formatCsvAmount(parseAmount(row.gross)),
          Balance: formatCsvAmount(parseAmount(row.net)),
          Name: 'Revenue by Treatment',
          Notes: `Discount: ${formatCsvAmount(parseAmount(row.discount))} | Cost: ${row.cost} | Profit: ${row.profit}`,
          Paid: formatCsvAmount(parseAmount(row.discount)),
          Quantity: row.count,
          Section: 'Financial',
          Subsection: 'Revenue By Treatment',
          Treatment: row.label,
        });
      });
      revenueByDentistRows.forEach((row) => {
        addRow({
          Amount: formatCsvAmount(parseAmount(row.gross)),
          Balance: formatCsvAmount(parseAmount(row.net)),
          Dentist: row.label,
          Name: 'Revenue by Dentist',
          Notes: `Discount: ${formatCsvAmount(parseAmount(row.discount))} | Cost: ${row.cost} | Profit: ${row.profit}`,
          Paid: formatCsvAmount(parseAmount(row.discount)),
          Quantity: row.count,
          Section: 'Financial',
          Subsection: 'Revenue By Dentist',
        });
      });
      revenueByPaymentMethodRows.forEach((row) => {
        addRow({
          Amount: formatCsvAmount(parseAmount(row.gross)),
          Balance: formatCsvAmount(parseAmount(row.net)),
          Name: 'Revenue by Payment Method',
          Notes: `Discount: ${formatCsvAmount(parseAmount(row.discount))} | Cost: ${row.cost} | Profit: ${row.profit}`,
          Paid: formatCsvAmount(parseAmount(row.discount)),
          PaymentMethod: row.label,
          Quantity: row.count,
          Section: 'Financial',
          Subsection: 'Revenue By Payment Method',
        });
      });
      revenueByPatientRows.forEach((row) => {
        addRow({
          Amount: formatCsvAmount(parseAmount(row.gross)),
          Balance: formatCsvAmount(parseAmount(row.net)),
          Name: 'Revenue by Patient',
          Notes: `Discount: ${formatCsvAmount(parseAmount(row.discount))} | Cost: ${row.cost} | Profit: ${row.profit}`,
          Paid: formatCsvAmount(parseAmount(row.discount)),
          Patient: row.label,
          Quantity: row.count,
          Section: 'Financial',
          Subsection: 'Revenue By Patient',
        });
      });

      outstandingInvoices.forEach((invoice) => {
        const agingBucket = toDebtAgingBucket(invoice.date, endDate) || '-';
        addRow({
          Amount: formatCsvAmount(invoice.net),
          Balance: formatCsvAmount(invoice.debt),
          Date: formatFullDate(invoice.date),
          Name: `Invoice #${invoice.id}`,
          Paid: formatCsvAmount(invoice.paid),
          Patient: mergedPatientNameById.get(invoice.patientId) || `Patient #${invoice.patientId || '-'}`,
          Section: 'Financial',
          Status: agingBucket,
          Subsection: 'Outstanding Aging',
        });
      });

      thirdCompanyUnpaidRows.forEach((row) => {
        addRow({
          Amount: formatCsvAmount(row.supplierTotal),
          Balance: formatCsvAmount(row.supplierRemaining),
          Name: row.toothNumber || 'Implant',
          Notes: 'Next Due: Pending',
          Paid: formatCsvAmount(row.supplierPaid),
          Patient: mergedPatientNameById.get(row.patientId) || `Patient #${row.patientId || '-'}`,
          Section: 'Financial',
          Subsection: 'Implant Installment',
          Treatment: 'Implant',
        });
      });

      [...filteredDailyExpenses, ...filteredClinicalExpenses].forEach((row) => {
        addRow({
          Amount: formatCsvAmount(row.amount),
          Date: formatFullDate(row.expenseDate),
          Name: row.category,
          Notes: `Type: ${toHumanLabel(row.expenseType)}`,
          Section: 'Financial',
          Subsection: 'Expense Report',
        });
      });
      safeRows.filter((row) => inRange(row.transactionDate, startDate, endDate)).forEach((row) => {
        addRow({
          Amount: formatCsvAmount(row.amount),
          Date: formatFullDate(row.transactionDate),
          Name: toHumanLabel(row.entryType),
          Notes: row.notes || '-',
          Patient: '-',
          PaymentMethod: toHumanLabel(row.entryType),
          Dentist: row.pickedByStaffName || row.pickedByStaffId || '-',
          Section: 'Financial',
          Status: toHumanLabel(row.direction),
          Subsection: 'Safe Transactions',
        });
      });
      salaryRows.filter((row) => inRange(row.paymentDate, startDate, endDate)).forEach((row) => {
        addRow({
          Amount: formatCsvAmount(row.netAmount),
          Date: formatFullDate(row.paymentDate),
          Name: 'Salary Payment',
          Notes: `Staff: ${row.staffName || row.staffId}`,
          Section: 'Financial',
          Status: toHumanLabel(row.status),
          Subsection: 'Salary Payments',
        });
      });
      ledgerRowsFilteredByPatient.forEach((row) => {
        addRow({
          Amount: formatCsvAmount(row.debit),
          Balance: formatCsvAmount(row.balance),
          Date: formatFullDate(row.date),
          Name: `Invoice #${row.invoiceId}`,
          Notes: `Method: ${toHumanLabel(row.method)}`,
          Paid: formatCsvAmount(row.credit),
          Patient: mergedPatientNameById.get(row.patientId) || `Patient #${row.patientId || '-'}`,
          PaymentMethod: toHumanLabel(row.method),
          Section: 'Financial',
          Status: toHumanLabel(row.type),
          Subsection: 'Receivables Ledger',
        });
      });
    }

    if (activeTab === 'clinical') {
      addRow({
        Name: 'Completed Treatments',
        Notes: `${treatmentPerformanceSummary.successRate}% success`,
        Quantity: treatmentPerformanceSummary.completedTreatments,
        Section: 'Clinical',
        Subsection: 'Treatment Performance',
      });
      addRow({
        Name: 'Cancelled Treatments',
        Quantity: treatmentPerformanceSummary.cancelledTreatments,
        Section: 'Clinical',
        Subsection: 'Treatment Performance',
      });
      treatmentVolume.forEach((row) => {
        addRow({
          Amount: formatCsvAmount(row.revenue),
          Name: row.name,
          Quantity: row.sessions,
          Section: 'Clinical',
          Subsection: 'Treatment Volume',
          Treatment: row.name,
        });
      });
      dentistPerformanceRows.forEach((row) => {
        addRow({
          Amount: formatCsvAmount(row.revenue),
          Dentist: row.dentist,
          Name: 'Dentist Performance',
          Notes: `Patients Seen: ${row.patientsSeen} | Commission: ${formatCsvAmount(row.commission)}`,
          Quantity: row.treatments,
          Section: 'Clinical',
          Subsection: 'Dentist Performance',
        });
      });
      implantSuccessRows.forEach((row) => {
        addRow({
          Date: formatFullDate(row.placementDate),
          Name: 'Implant Success',
          Notes: row.warrantyTracking,
          Patient: row.patientName,
          Quantity: row.failures,
          Section: 'Clinical',
          Status: toHumanLabel(row.status),
          Subsection: 'Implant Success',
          Treatment: row.brand,
        });
      });
    }

    if (activeTab === 'inventory') {
      addRow({
        Name: 'Inventory Summary',
        Notes: `Total Items in Database: ${totalInventoryItemsInDatabase} | Usage Rows in Range: ${inventoryUsageRows.length}`,
        Quantity: totalInventoryItemsInDatabase,
        Section: 'Inventory',
        Subsection: 'Summary',
      });
      stockStatusRows.forEach((row) => {
        addRow({
          Date: formatFullDate(row.expiryDate),
          Name: row.itemName,
          Notes: `Min Level: ${row.minStock} | Unit: ${row.unit}`,
          Quantity: row.quantity,
          Section: 'Inventory',
          Status: row.status,
          Subsection: 'Stock Status',
        });
      });
      materialUsagePerTreatment.forEach((row) => {
        addRow({
          Amount: formatCsvAmount(row.totalCost),
          Name: row.treatment,
          Notes: `Average Cost per Session: ${formatCsvAmount(row.avgCost)}`,
          Quantity: row.sessions,
          Section: 'Inventory',
          Subsection: 'Material Usage Per Treatment',
          Treatment: row.treatment,
        });
      });
      implantInventoryRows.forEach((row) => {
        addRow({
          Date: formatFullDate(row.entryDate),
          Name: row.itemName,
          Notes: `Lot/Serial: ${row.lotNumber || '-'} | Expiry: ${formatFullDate(row.expiryDate)}`,
          Patient: '-',
          Dentist: '-',
          PaymentMethod: '-',
          Quantity: row.quantity,
          Status: row.supplier || '-',
          Section: 'Inventory',
          Subsection: 'Implant Inventory',
          Treatment: 'Implant',
        });
      });
      inventoryUsageRows.forEach((row) => {
        addRow({
          Date: formatFullDate(row.usedOn),
          Name: row.itemName,
          Notes: `Visit: ${row.visitLabel} | Qty Used: ${row.quantityUsed} ${row.unit}`,
          Patient: row.patientName,
          Quantity: row.quantityUsed,
          Section: 'Inventory',
          Subsection: 'Usage by Patient',
          Treatment: row.treatmentName,
        });
      });
    }

    if (activeTab === 'audit') {
      financialModificationLogRows.forEach((row) => {
        addRow({
          Date: formatDateTime(row.timestamp),
          Name: row.entity,
          Notes: `Before: ${row.beforeValue} | After: ${row.afterValue}`,
          Dentist: row.changedBy,
          Section: 'Audit',
          Status: row.action,
          Subsection: 'Financial Modification Log',
        });
      });
      accessLogRows.forEach((row) => {
        addRow({
          Date: formatDateTime(row.generatedAt),
          Name: row.action,
          Notes: row.range,
          Dentist: row.user,
          Section: 'Audit',
          Subsection: 'Access Logs',
        });
      });
      snapshotRecords.forEach((row) => {
        addRow({
          Amount: formatCsvAmount(row.billed),
          Balance: formatCsvAmount(row.debt),
          Date: formatDateTime(row.generatedAt),
          Name: 'Snapshot',
          Notes: `${formatFullDate(row.rangeStart)} to ${formatFullDate(row.rangeEnd)} | Collection: ${row.collectionRate}%`,
          Paid: formatCsvAmount(row.paid),
          Section: 'Audit',
          Subsection: 'Snapshots',
        });
      });
    }

    if (exportRows.length === 0) {
      addRow({
        Name: 'Info',
        Notes: 'No records in selected range',
        Section: 'Report Info',
        Subsection: 'Meta',
      });
    }

    const extension = 'csv';
    downloadCsv(`reports-${activeTab}-${startDate}-to-${endDate}.${extension}`, exportRows);
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
              <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-8">
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
                  value={selectedDentistFilter}
                  onChange={(event) => setSelectedDentistFilter(event.target.value)}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="all">All Dentists</option>
                  {dentistFilterOptions.map((dentist) => (
                    <option key={`dentist-filter-${dentist}`} value={dentist}>{dentist}</option>
                  ))}
                </select>
                <select
                  value={selectedTreatmentFilter}
                  onChange={(event) => setSelectedTreatmentFilter(event.target.value)}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="all">All Treatments</option>
                  {treatmentFilterOptions.map((treatment) => (
                    <option key={`treatment-filter-${treatment}`} value={treatment}>{treatment}</option>
                  ))}
                </select>
                <select
                  value={selectedPaymentMethodFilter}
                  onChange={(event) => setSelectedPaymentMethodFilter(event.target.value)}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="all">All Payment Methods</option>
                  {paymentMethodFilterOptions.map((method) => (
                    <option key={`payment-filter-${method}`} value={method}>{toHumanLabel(method)}</option>
                  ))}
                </select>
                <select
                  value={selectedPatientFilter}
                  onChange={(event) => setSelectedPatientFilter(event.target.value)}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="all">All Patients</option>
                  {patientFilterOptions.map((patient) => (
                    <option key={`patient-filter-${patient.id}`} value={patient.id}>{patient.name}</option>
                  ))}
                </select>
                <select
                  value={globalStatusFilter}
                  onChange={(event) => setGlobalStatusFilter(event.target.value as ReportStatusFilter)}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="all">All Status</option>
                  <option value="completed">Completed</option>
                  <option value="pending">Pending</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div className="grid gap-3 rounded-md border border-border/70 bg-muted/20 p-3 md:grid-cols-4">
                <div>
                  <p className="text-xs text-muted-foreground">{tReportsPage('summary.incomePaid')}</p>
                  <p className="text-lg font-semibold text-emerald-600">{formatCurrency(displayKpis.paid)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{tReportsPage('summary.outcome')}</p>
                  <p className="text-lg font-semibold text-orange-600">{formatCurrency(Number((displayKpis.expenses + displayKpis.salaryPaid + displayKpis.thirdCompanyPaid).toFixed(2)))}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{tReportsPage('summary.profitLoss')}</p>
                  <p className={`text-lg font-semibold ${displayProfitOrLoss >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {formatCurrency(displayProfitOrLoss)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Third-Company Unpaid</p>
                  <p className="text-lg font-semibold text-orange-600">{formatCurrency(displayKpis.thirdCompanyUnpaid)}</p>
                  <p className="text-xs text-muted-foreground">{displayKpis.thirdCompanyUnpaidCount} implant teeth</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={exportFormat}
                  onChange={(event) => setExportFormat(event.target.value as ReportExportFormat)}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="pdf">PDF</option>
                  <option value="csv">CSV</option>
                </select>
                {exportFormat === 'csv' ? (
                  <select
                    value={csvExportType}
                    onChange={(event) => setCsvExportType(event.target.value as CsvExportType)}
                    className="h-10 min-w-[230px] rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {csvExportOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                ) : null}
                <Button type="button" variant="outline" onClick={handleGlobalExport}>Export</Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    downloadCsv(
                      `profit-loss-${startDate}-to-${endDate}.csv`,
                      profitLossTrend.map((row) => ({
                        Income: formatCsvAmount(row.income),
                        Outcome: formatCsvAmount(row.outcome),
                        Period: row.label,
                        'Profit/Loss': formatCsvAmount(row.profit),
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
                        Currency: invoice.currency,
                        Discount: formatCsvAmount(invoice.discount),
                        'Entered Discount': formatCsvAmount(invoice.discountInput),
                        'Entered Net': formatCsvAmount(invoice.netInput),
                        'Entered Total': formatCsvAmount(invoice.totalInput),
                        'Exchange Rate': Number(invoice.exchangeRate).toFixed(6),
                        'Invoice #': invoice.id,
                        'Invoice Date': formatFullDate(invoice.date),
                        'Net Total': formatCsvAmount(invoice.net),
                        'Outstanding Debt': formatCsvAmount(invoice.debt),
                        'Paid Amount': formatCsvAmount(invoice.paid),
                        Patient: mergedPatientNameById.get(invoice.patientId) || `Patient #${invoice.patientId || '-'}`,
                        Status: toHumanLabel(invoice.status),
                        'Total Amount': formatCsvAmount(invoice.total),
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
                        Income: formatCsvAmount(point.income),
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
                        Balance: formatCsvAmount(ledgerRows.openingBalance),
                        Credit: '-',
                        Date: formatFullDate(startDate),
                        Debit: '-',
                        Description: 'Opening Balance',
                        'Entry Type': 'Opening',
                        'Invoice #': '-',
                        Patient: selectedPatientName,
                        'Payment Method': '-',
                      },
                      ...ledgerRows.inRangeEntries.map((entry) => ({
                        Balance: formatCsvAmount(entry.balance),
                        Credit: entry.credit > 0 ? formatCsvAmount(entry.credit) : '-',
                        Date: formatFullDate(entry.date),
                        Debit: entry.debit > 0 ? formatCsvAmount(entry.debit) : '-',
                        Description: entry.label,
                        'Entry Type': toHumanLabel(entry.type),
                        'Invoice #': entry.invoiceId || '-',
                        Patient: mergedPatientNameById.get(entry.patientId) || `Patient #${entry.patientId || '-'}`,
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
                        Amount: formatCsvAmount(row.amount),
                        Category: row.category,
                        Currency: row.currency,
                        Date: formatFullDate(row.expenseDate),
                        'Entered Amount': formatCsvAmount(row.amountInput),
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
                        Amount: formatCsvAmount(row.amount),
                        Currency: row.currency,
                        Date: formatFullDate(row.transactionDate),
                        Direction: toHumanLabel(row.direction),
                        'Entered Amount': formatCsvAmount(row.amountInput),
                        'Entry Type': toHumanLabel(row.entryType),
                        'Exchange Rate': row.exchangeRate.toFixed(6),
                        Notes: row.notes || '-',
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
                        Currency: row.currency,
                        'Entered Net': formatCsvAmount(row.netAmountInput),
                        'Exchange Rate': row.exchangeRate.toFixed(6),
                        'Net Paid': formatCsvAmount(row.netAmount),
                        'Payment Date': formatFullDate(row.paymentDate),
                        Staff: row.staffName || row.staffId,
                        Status: toHumanLabel(row.status),
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
                        Availability: toHumanLabel(row.availability),
                        'Paid To Supplier': formatCsvAmount(row.supplierPaid),
                        Patient: mergedPatientNameById.get(row.patientId) || `Patient #${row.patientId || '-'}`,
                        'Supplier Total': formatCsvAmount(row.supplierTotal),
                        Tooth: row.toothNumber,
                        'Unpaid To Supplier': formatCsvAmount(row.supplierRemaining),
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
                        Appointments: snapshot.appointments,
                        Billed: formatCsvAmount(snapshot.billed),
                        'Collection Rate (%)': `${snapshot.collectionRate}%`,
                        Debt: formatCsvAmount(snapshot.debt),
                        Discount: formatCsvAmount(snapshot.discount),
                        'Generated At': formatDateTime(snapshot.generatedAt),
                        Granularity: toHumanLabel(snapshot.granularity),
                        'Invoice Status Filter': toHumanLabel(snapshot.statusFilter),
                        Net: formatCsvAmount(snapshot.net),
                        Paid: formatCsvAmount(snapshot.paid),
                        'Range End': formatFullDate(snapshot.rangeEnd),
                        'Range Start': formatFullDate(snapshot.rangeStart),
                        Visits: snapshot.visits,
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

          <Tabs
            value={activeTab}
            onValueChange={(value) => {
              startTransition(() => {
                setActiveTab(value as typeof activeTab);
              });
            }}
            className="space-y-3"
          >
            <TabsList>
              <TabsTrigger value="executive">Executive Dashboard</TabsTrigger>
              <TabsTrigger value="financial">Financial Reports</TabsTrigger>
              <TabsTrigger value="clinical">Clinical Reports</TabsTrigger>
              <TabsTrigger value="inventory">Inventory Reports</TabsTrigger>
              <TabsTrigger value="audit">Audit & Compliance</TabsTrigger>
            </TabsList>

            <TabsContent value="executive" className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <Card className="border-border/70">
                  <CardContent className="pt-5">
                    <p className="text-xs text-muted-foreground">Total Revenue</p>
                    <p className="text-2xl font-semibold">{formatCurrency(displayKpis.paid)}</p>
                    <p className="text-xs text-muted-foreground">Collection: {displayKpis.collectionRate}%</p>
                  </CardContent>
                </Card>
                <Card className="border-border/70">
                  <CardContent className="pt-5">
                    <p className="text-xs text-muted-foreground">Net Profit</p>
                    <p className={`text-2xl font-semibold ${displayProfitOrLoss >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {formatCurrency(displayProfitOrLoss)}
                    </p>
                    <p className="text-xs text-muted-foreground">After operational outcome</p>
                  </CardContent>
                </Card>
                <Card className="border-border/70">
                  <CardContent className="pt-5">
                    <p className="text-xs text-muted-foreground">Total Expenses</p>
                    <p className="text-2xl font-semibold">{formatCurrency(displayKpis.expenses)}</p>
                    <p className="text-xs text-muted-foreground">Daily + clinical buys</p>
                  </CardContent>
                </Card>
                <Card className="border-border/70">
                  <CardContent className="pt-5">
                    <p className="text-xs text-muted-foreground">Outstanding Payments</p>
                    <p className="text-2xl font-semibold">{formatCurrency(displayKpis.debt)}</p>
                    <p className="text-xs text-muted-foreground">Pending receivables</p>
                  </CardContent>
                </Card>
                <Card className="border-border/70">
                  <CardContent className="pt-5">
                    <p className="text-xs text-muted-foreground">New Patients</p>
                    <p className="text-2xl font-semibold">{displayNewPatientsCount}</p>
                    <p className="text-xs text-muted-foreground">In selected range</p>
                  </CardContent>
                </Card>
                <Card className="border-border/70">
                  <CardContent className="pt-5">
                    <p className="text-xs text-muted-foreground">Implant Revenue</p>
                    <p className="text-2xl font-semibold">{formatCurrency(displayImplantRevenue)}</p>
                    <p className="text-xs text-muted-foreground">From implant treatments</p>
                  </CardContent>
                </Card>
                <Card className="border-border/70">
                  <CardContent className="pt-5">
                    <p className="text-xs text-muted-foreground">Cash in Safe</p>
                    <p className="text-2xl font-semibold">{formatCurrency(displayCashInSafe)}</p>
                    <p className="text-xs text-muted-foreground">System balance</p>
                  </CardContent>
                </Card>
                <Card className="border-border/70">
                  <CardContent className="pt-5">
                    <p className="text-xs text-muted-foreground">Bank Balance</p>
                    <p className="text-2xl font-semibold">{formatCurrency(displayBankBalance)}</p>
                    <p className="text-xs text-muted-foreground">Bank/card collections</p>
                  </CardContent>
                </Card>
                <Card className="border-border/70">
                  <CardContent className="pt-5">
                    <p className="text-xs text-muted-foreground">Treatment Acceptance Rate</p>
                    <p className="text-2xl font-semibold">{displayTreatmentAcceptanceRate}%</p>
                    <p className="text-xs text-muted-foreground">Visits vs appointments</p>
                  </CardContent>
                </Card>
                <Card className="border-border/70">
                  <CardContent className="pt-5">
                    <p className="text-xs text-muted-foreground">Chair Utilization Rate</p>
                    <p className="text-2xl font-semibold">{displayChairUtilizationRate}%</p>
                    <p className="text-xs text-muted-foreground">Visit density by day</p>
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
                      <p className="text-sm font-semibold text-foreground">{formatCurrency(displayKpis.billed)}</p>
                    </div>
                    <div className="rounded-md border border-border/70 bg-muted/20 p-2">
                      <p className="text-xs text-muted-foreground">Discount</p>
                      <p className="text-sm font-semibold text-foreground">{formatCurrency(displayKpis.discount)}</p>
                    </div>
                    <div className="rounded-md border border-border/70 bg-muted/20 p-2">
                      <p className="text-xs text-muted-foreground">Collected</p>
                      <p className="text-sm font-semibold text-foreground">{formatCurrency(displayKpis.paid)}</p>
                    </div>
                    <div className="rounded-md border border-border/70 bg-muted/20 p-2">
                      <p className="text-xs text-muted-foreground">Outstanding</p>
                      <p className="text-sm font-semibold text-foreground">{formatCurrency(displayKpis.debt)}</p>
                    </div>
                    <div className="rounded-md border border-border/70 bg-muted/20 p-2 md:col-span-2">
                      <p className="text-xs text-muted-foreground">Expenses (Daily + Clinical)</p>
                      <p className="text-sm font-semibold text-foreground">
                        {formatCurrency(displayExpenseSummary.total)} ({formatCurrency(displayExpenseSummary.daily)} daily / {formatCurrency(displayExpenseSummary.clinical)} clinical)
                      </p>
                      <p className="text-xs text-muted-foreground">Third-company paid: {formatCurrency(displayKpis.thirdCompanyPaid)}</p>
                      <p className="text-xs text-muted-foreground">Operational net cash: {formatCurrency(displayKpis.netAfterExpenses)}</p>
                    </div>
                    <div className="rounded-md border border-border/70 bg-muted/20 p-2 md:col-span-2">
                      <p className="text-xs text-muted-foreground">Third-Company Liability</p>
                      <p className="text-sm font-semibold text-foreground">
                        Unpaid {formatCurrency(displayKpis.thirdCompanyUnpaid)} / Total {formatCurrency(displayKpis.thirdCompanyTotal)}
                      </p>
                      <p className="text-xs text-muted-foreground">Unpaid teeth: {displayKpis.thirdCompanyUnpaidCount}</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="h-2 rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full bg-emerald-500"
                        style={{ width: `${displayKpis.net > 0 ? Math.min(100, (displayKpis.paid / displayKpis.net) * 100) : 0}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Collection flow progress: {displayKpis.collectionRate}% of net invoices collected.
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
                  {displayProfitLossTrend.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{tReportsPage('profitLossChart.empty')}</p>
                  ) : (
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={displayProfitLossTrend}>
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
                            {displayProfitLossTrend.map((entry) => (
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
                  {isLoadingExecutiveSummary ? (
                    <LoadingState
                      compact
                      title="Loading executive report"
                      description="Preparing revenue trends and summary KPIs."
                    />
                  ) : displayExecutiveRevenueTrendMonthly.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No income data in selected range.</p>
                  ) : (
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={displayExecutiveRevenueTrendMonthly} margin={{ bottom: 8, left: 0, right: 10, top: 8 }}>
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
                          <Area dataKey="amount" fill="url(#reportsIncomeGradient)" stroke="#0ea5e9" strokeWidth={2} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="grid gap-4 xl:grid-cols-2">
                <Card className="border-border/70">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Revenue by Treatment Type</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {displayTreatmentVolume.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No treatment revenue in selected range.</p>
                    ) : (
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={displayTreatmentVolume}>
                            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                            <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} />
                            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(value) => `AFN ${Number(value).toFixed(0)}`} />
                            <Tooltip formatter={(value) => [formatCurrency(Number(value ?? 0)), 'Revenue']} />
                            <Bar dataKey="revenue" fill="#0ea5e9" radius={[8, 8, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-border/70">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Revenue by Dentist</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {displayDentistProductivity.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No dentist revenue in selected range.</p>
                    ) : (
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={displayDentistProductivity}>
                            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                            <XAxis dataKey="dentist" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} />
                            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(value) => `AFN ${Number(value).toFixed(0)}`} />
                            <Tooltip formatter={(value) => [formatCurrency(Number(value ?? 0)), 'Revenue']} />
                            <Bar dataKey="revenue" fill="#22c55e" radius={[8, 8, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-border/70">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Implant Placement Trend</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {displayImplantPlacementTrend.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No implant placements in selected range.</p>
                    ) : (
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={displayImplantPlacementTrend}>
                            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                            <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} />
                            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} />
                            <Tooltip formatter={(value, name) => [Number(value ?? 0), name === 'count' ? 'Placements' : 'Revenue']} />
                            <Legend />
                            <Line dataKey="count" stroke="#6366f1" strokeWidth={2} name="Placements" />
                            <Line dataKey="revenue" stroke="#f97316" strokeWidth={2} name="Revenue" />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-border/70">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Expense Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {displayExpenseSummary.byCategory.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No expenses in selected range.</p>
                    ) : (
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={displayExpenseSummary.byCategory}>
                            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                            <XAxis dataKey="category" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} />
                            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(value) => `AFN ${Number(value).toFixed(0)}`} />
                            <Tooltip formatter={(value) => [formatCurrency(Number(value ?? 0)), 'Expense']} />
                            <Bar dataKey="amount" fill="#ef4444" radius={[8, 8, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="financial" className="space-y-4">
              <Card className="border-border/70">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Daily Financial Report</CardTitle>
                  <CardDescription>Opening, inflow, outflow, and closing safe balance with variance check.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-5">
                    <div className="rounded-md border border-border/70 bg-muted/20 p-3">
                      <p className="text-xs text-muted-foreground">Opening Safe Balance</p>
                      <p className="text-base font-semibold">{formatCurrency(dailyFinancialSummary.openingBalance)}</p>
                    </div>
                    <div className="rounded-md border border-border/70 bg-muted/20 p-3">
                      <p className="text-xs text-muted-foreground">Total Cash In</p>
                      <p className="text-base font-semibold text-emerald-700">{formatCurrency(dailyFinancialSummary.totalCashIn)}</p>
                    </div>
                    <div className="rounded-md border border-border/70 bg-muted/20 p-3">
                      <p className="text-xs text-muted-foreground">Total Cash Out</p>
                      <p className="text-base font-semibold text-rose-700">{formatCurrency(dailyFinancialSummary.totalCashOut)}</p>
                    </div>
                    <div className="rounded-md border border-border/70 bg-muted/20 p-3">
                      <p className="text-xs text-muted-foreground">Closing Balance</p>
                      <p className="text-base font-semibold">{formatCurrency(dailyFinancialSummary.closingBalance)}</p>
                    </div>
                    <div className="rounded-md border border-border/70 bg-muted/20 p-3">
                      <p className="text-xs text-muted-foreground">Variance (System vs Physical)</p>
                      <p className={`text-base font-semibold ${dailyFinancialSummary.variance >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {formatCurrency(dailyFinancialSummary.variance)}
                      </p>
                    </div>
                  </div>
                  <div className="max-w-sm">
                    <p className="mb-1 text-xs text-muted-foreground">Physical Safe Balance</p>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={physicalSafeBalanceInput}
                      onChange={(event) => setPhysicalSafeBalanceInput(event.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/70">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Shareholder Capital Report</CardTitle>
                  <CardDescription>
                    Lifetime capital position and selected-range contribution/distribution flow.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-2 md:grid-cols-5">
                    <div className="rounded-md border border-border/70 bg-muted/20 p-2">
                      <p className="text-xs text-muted-foreground">Shareholders</p>
                      <p className="text-sm font-semibold text-foreground">
                        {shareholderFinancialSummary.activeCount} active / {shareholderFinancialSummary.totalShareholders} total
                      </p>
                    </div>
                    <div className="rounded-md border border-border/70 bg-muted/20 p-2">
                      <p className="text-xs text-muted-foreground">Initial Capital</p>
                      <p className="text-sm font-semibold text-foreground">{formatCurrency(shareholderFinancialSummary.totalInitial)}</p>
                    </div>
                    <div className="rounded-md border border-border/70 bg-emerald-100/70 p-2">
                      <p className="text-xs text-emerald-700">Range Contributed</p>
                      <p className="text-sm font-semibold text-emerald-900">{formatCurrency(shareholderFinancialSummary.rangeContributed)}</p>
                    </div>
                    <div className="rounded-md border border-border/70 bg-rose-100/70 p-2">
                      <p className="text-xs text-rose-700">Range Distributed</p>
                      <p className="text-sm font-semibold text-rose-900">{formatCurrency(shareholderFinancialSummary.rangeDistributed)}</p>
                    </div>
                    <div className="rounded-md border border-border/70 bg-indigo-100/70 p-2">
                      <p className="text-xs text-indigo-700">Lifetime Balance</p>
                      <p className="text-sm font-semibold text-indigo-900">{formatCurrency(shareholderFinancialSummary.totalBalance)}</p>
                    </div>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-2">
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-foreground">
                        Range Net by Shareholder ({shareholderFinancialSummary.transactionCount} transactions)
                      </p>
                      {shareholderFinancialSummary.rangeRows.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No shareholder transactions in selected range.</p>
                      ) : (
                        <div className="overflow-x-auto rounded-md border border-border/70">
                          <table className="min-w-full text-xs">
                            <thead className="bg-muted/30">
                              <tr>
                                <th className="px-2 py-2 text-left font-semibold">Shareholder</th>
                                <th className="px-2 py-2 text-right font-semibold">Contributed</th>
                                <th className="px-2 py-2 text-right font-semibold">Distributed</th>
                                <th className="px-2 py-2 text-right font-semibold">Net</th>
                              </tr>
                            </thead>
                            <tbody>
                              {shareholderFinancialSummary.rangeRows.slice(0, 12).map((row) => (
                                <tr key={`shareholder-range-${row.id}`} className="border-t border-border/70">
                                  <td className="px-2 py-2">{row.name}</td>
                                  <td className="px-2 py-2 text-right">{formatCurrency(row.contribution)}</td>
                                  <td className="px-2 py-2 text-right">{formatCurrency(row.distribution)}</td>
                                  <td className="px-2 py-2 text-right font-semibold">{formatCurrency(row.net)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-foreground">Top Shareholder Balances</p>
                      {shareholderFinancialSummary.topBalances.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No shareholder balances available.</p>
                      ) : (
                        shareholderFinancialSummary.topBalances.map((row) => (
                          <div key={`shareholder-balance-${row.id}`} className="rounded-md border border-border/70 bg-muted/20 p-2 text-xs">
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-semibold text-foreground">{row.name}</p>
                              <p className="font-semibold text-foreground">{formatCurrency(row.balance)}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/70">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Revenue Report</CardTitle>
                  <CardDescription>Grouped by treatment, dentist, payment method, and patient.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { label: 'By Treatment Type', rows: revenueByTreatmentRows },
                    { label: 'By Dentist', rows: revenueByDentistRows },
                    { label: 'By Payment Method', rows: revenueByPaymentMethodRows },
                    { label: 'By Patient', rows: revenueByPatientRows },
                  ].map((section) => (
                    <div key={`revenue-group-${section.label}`} className="space-y-2">
                      <p className="text-sm font-semibold">{section.label}</p>
                      {section.rows.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No rows in selected filters.</p>
                      ) : (
                        <div className="overflow-x-auto rounded-md border border-border/70">
                          <table className="min-w-full text-xs">
                            <thead className="bg-muted/30">
                              <tr>
                                <th className="px-2 py-2 text-left font-semibold">Treatment / Group</th>
                                <th className="px-2 py-2 text-right font-semibold">Count</th>
                                <th className="px-2 py-2 text-right font-semibold">Gross</th>
                                <th className="px-2 py-2 text-right font-semibold">Discount</th>
                                <th className="px-2 py-2 text-right font-semibold">Net</th>
                                <th className="px-2 py-2 text-right font-semibold">Cost</th>
                                <th className="px-2 py-2 text-right font-semibold">Profit</th>
                              </tr>
                            </thead>
                            <tbody>
                              {section.rows.map((row) => (
                                <tr key={`revenue-row-${section.label}-${row.label}`} className="border-t border-border/70">
                                  <td className="px-2 py-2">{row.label}</td>
                                  <td className="px-2 py-2 text-right">{row.count}</td>
                                  <td className="px-2 py-2 text-right">{row.gross}</td>
                                  <td className="px-2 py-2 text-right">{row.discount}</td>
                                  <td className="px-2 py-2 text-right">{row.net}</td>
                                  <td className="px-2 py-2 text-right">{row.cost}</td>
                                  <td className="px-2 py-2 text-right">{row.profit}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-border/70">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Outstanding Report (Aging)</CardTitle>
                </CardHeader>
                <CardContent>
                  {outstandingInvoices.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No outstanding rows.</p>
                  ) : (
                    <div className="overflow-x-auto rounded-md border border-border/70">
                      <table className="min-w-full text-xs">
                        <thead className="bg-muted/30">
                          <tr>
                            <th className="px-2 py-2 text-left font-semibold">Patient</th>
                            <th className="px-2 py-2 text-left font-semibold">Invoice</th>
                            <th className="px-2 py-2 text-right font-semibold">Total</th>
                            <th className="px-2 py-2 text-right font-semibold">Paid</th>
                            <th className="px-2 py-2 text-right font-semibold">Remaining</th>
                            <th className="px-2 py-2 text-right font-semibold">30d</th>
                            <th className="px-2 py-2 text-right font-semibold">60d</th>
                            <th className="px-2 py-2 text-right font-semibold">90d+</th>
                          </tr>
                        </thead>
                        <tbody>
                          {outstandingInvoices.map((invoice) => {
                            const bucket = toDebtAgingBucket(invoice.date, endDate);
                            return (
                              <tr key={`aging-${invoice.id}`} className="border-t border-border/70">
                                <td className="px-2 py-2">{mergedPatientNameById.get(invoice.patientId) || `Patient #${invoice.patientId || '-'}`}</td>
                                <td className="px-2 py-2">#{invoice.id}</td>
                                <td className="px-2 py-2 text-right">{formatCurrency(invoice.net)}</td>
                                <td className="px-2 py-2 text-right">{formatCurrency(invoice.paid)}</td>
                                <td className="px-2 py-2 text-right">{formatCurrency(invoice.debt)}</td>
                                <td className="px-2 py-2 text-right">{bucket === '0-30 days' ? formatCurrency(invoice.debt) : '-'}</td>
                                <td className="px-2 py-2 text-right">{bucket === '31-60 days' ? formatCurrency(invoice.debt) : '-'}</td>
                                <td className="px-2 py-2 text-right">{bucket === '61-90 days' || bucket === '90+ days' ? formatCurrency(invoice.debt) : '-'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/70">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Implant Installment Report</CardTitle>
                </CardHeader>
                <CardContent>
                  {thirdCompanyInstallmentRows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No implant installment rows.</p>
                  ) : (
                    <div className="overflow-x-auto rounded-md border border-border/70">
                      <table className="min-w-full text-xs">
                        <thead className="bg-muted/30">
                          <tr>
                            <th className="px-2 py-2 text-left font-semibold">Patient</th>
                            <th className="px-2 py-2 text-left font-semibold">Implant Brand</th>
                            <th className="px-2 py-2 text-left font-semibold">Status</th>
                            <th className="px-2 py-2 text-right font-semibold">Total</th>
                            <th className="px-2 py-2 text-right font-semibold">Paid</th>
                            <th className="px-2 py-2 text-right font-semibold">Remaining</th>
                            <th className="px-2 py-2 text-left font-semibold">Next Due</th>
                          </tr>
                        </thead>
                        <tbody>
                          {thirdCompanyInstallmentRows.map((row) => (
                            <tr key={`implant-installment-${row.taskId}-${row.toothNumber}`} className="border-t border-border/70">
                              <td className="px-2 py-2">{mergedPatientNameById.get(row.patientId) || `Patient #${row.patientId || '-'}`}</td>
                              <td className="px-2 py-2">{row.toothNumber || 'Implant'}</td>
                              <td className="px-2 py-2">{toHumanLabel(row.availability)}</td>
                              <td className="px-2 py-2 text-right">{formatCurrency(row.supplierTotal)}</td>
                              <td className="px-2 py-2 text-right">{formatCurrency(row.supplierPaid)}</td>
                              <td className="px-2 py-2 text-right">{formatCurrency(row.supplierRemaining)}</td>
                              <td className="px-2 py-2">{row.supplierRemaining > 0 ? 'Pending' : 'Cleared'}</td>
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
                  <CardTitle className="text-base">Expense Report (Category / Supplier / Date)</CardTitle>
                </CardHeader>
                <CardContent>
                  {[...filteredDailyExpenses, ...filteredClinicalExpenses].length === 0 ? (
                    <p className="text-sm text-muted-foreground">No expense rows in selected range.</p>
                  ) : (
                    <div className="overflow-x-auto rounded-md border border-border/70">
                      <table className="min-w-full text-xs">
                        <thead className="bg-muted/30">
                          <tr>
                            <th className="px-2 py-2 text-left font-semibold">Date</th>
                            <th className="px-2 py-2 text-left font-semibold">Category</th>
                            <th className="px-2 py-2 text-left font-semibold">Supplier</th>
                            <th className="px-2 py-2 text-right font-semibold">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...filteredDailyExpenses, ...filteredClinicalExpenses].slice(0, 200).map((row) => (
                            <tr key={`expense-row-${row.id}`} className="border-t border-border/70">
                              <td className="px-2 py-2">{formatFullDate(row.expenseDate)}</td>
                              <td className="px-2 py-2">{row.category}</td>
                              <td className="px-2 py-2">-</td>
                              <td className="px-2 py-2 text-right">{formatCurrency(row.amount)}</td>
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
                  {thirdCompanySummary.implantCount === 0 ? (
                    <p className="text-sm text-muted-foreground">No third-company implant rows in selected range.</p>
                  ) : (
                    <>
                      {thirdCompanyStatusChart.every((item) => item.unpaid <= 0) ? (
                        <p className="text-xs text-muted-foreground">
                          All supplier balances are cleared. Unpaid amount is currently zero.
                        </p>
                      ) : null}
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
                    </>
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
                      {patientFilterOptions.map((patient) => (
                        <option key={`ledger-patient-${patient.id}`} value={patient.id}>
                          {patient.name}
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
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Card className="border-border/70">
                  <CardContent className="pt-5">
                    <p className="text-xs text-muted-foreground">Completed Treatments</p>
                    <p className="text-2xl font-semibold">{treatmentPerformanceSummary.completedTreatments}</p>
                  </CardContent>
                </Card>
                <Card className="border-border/70">
                  <CardContent className="pt-5">
                    <p className="text-xs text-muted-foreground">Cancelled Treatments</p>
                    <p className="text-2xl font-semibold">{treatmentPerformanceSummary.cancelledTreatments}</p>
                  </CardContent>
                </Card>
                <Card className="border-border/70">
                  <CardContent className="pt-5">
                    <p className="text-xs text-muted-foreground">Average Duration</p>
                    <p className="text-2xl font-semibold">
                      {treatmentPerformanceSummary.avgDurationMinutes > 0
                        ? `${treatmentPerformanceSummary.avgDurationMinutes}m`
                        : 'N/A'}
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-border/70">
                  <CardContent className="pt-5">
                    <p className="text-xs text-muted-foreground">Success Rate</p>
                    <p className="text-2xl font-semibold">{treatmentPerformanceSummary.successRate}%</p>
                  </CardContent>
                </Card>
              </div>

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

              <Card className="border-border/70">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Dentist Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  {dentistPerformanceRows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No dentist performance rows in selected range.</p>
                  ) : (
                    <div className="overflow-x-auto rounded-md border border-border/70">
                      <table className="min-w-full text-xs">
                        <thead className="bg-muted/30">
                          <tr>
                            <th className="px-2 py-2 text-left font-semibold">Dentist</th>
                            <th className="px-2 py-2 text-right font-semibold">Patients Seen</th>
                            <th className="px-2 py-2 text-right font-semibold">Revenue</th>
                            <th className="px-2 py-2 text-right font-semibold">Treatments</th>
                            <th className="px-2 py-2 text-right font-semibold">Commission</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dentistPerformanceRows.map((row) => (
                            <tr key={`dentist-performance-${row.dentist}`} className="border-t border-border/70">
                              <td className="px-2 py-2">{row.dentist}</td>
                              <td className="px-2 py-2 text-right">{row.patientsSeen}</td>
                              <td className="px-2 py-2 text-right">{formatCurrency(row.revenue)}</td>
                              <td className="px-2 py-2 text-right">{row.treatments}</td>
                              <td className="px-2 py-2 text-right">{formatCurrency(row.commission)}</td>
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
                  <CardTitle className="text-base">Implant Success Report</CardTitle>
                </CardHeader>
                <CardContent>
                  {implantSuccessRows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No implant success rows in selected range.</p>
                  ) : (
                    <div className="overflow-x-auto rounded-md border border-border/70">
                      <table className="min-w-full text-xs">
                        <thead className="bg-muted/30">
                          <tr>
                            <th className="px-2 py-2 text-left font-semibold">Patient</th>
                            <th className="px-2 py-2 text-left font-semibold">Brand</th>
                            <th className="px-2 py-2 text-left font-semibold">Placement Date</th>
                            <th className="px-2 py-2 text-right font-semibold">Failures</th>
                            <th className="px-2 py-2 text-left font-semibold">Warranty</th>
                          </tr>
                        </thead>
                        <tbody>
                          {implantSuccessRows.map((row, index) => (
                            <tr key={`implant-success-${row.patientName}-${index}`} className="border-t border-border/70">
                              <td className="px-2 py-2">{row.patientName}</td>
                              <td className="px-2 py-2">{row.brand}</td>
                              <td className="px-2 py-2">{formatFullDate(row.placementDate)}</td>
                              <td className="px-2 py-2 text-right">{row.failures}</td>
                              <td className="px-2 py-2">{row.warrantyTracking}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="inventory" className="space-y-4">
              <Card className="border-border/70">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Stock Status</CardTitle>
                  <CardDescription>
                    Total items in database: {totalInventoryItemsInDatabase}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingInventoryData ? (
                    <LoadingState
                      compact
                      title="Loading inventory report"
                      description="Checking stock rows, minimum levels, and expiry details."
                    />
                  ) : stockStatusRows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No inventory rows in selected range.</p>
                  ) : (
                    <div className="overflow-x-auto rounded-md border border-border/70">
                      <table className="min-w-full text-xs">
                        <thead className="bg-muted/30">
                          <tr>
                            <th className="px-2 py-2 text-left font-semibold">Item</th>
                            <th className="px-2 py-2 text-right font-semibold">In Stock</th>
                            <th className="px-2 py-2 text-right font-semibold">Min Level</th>
                            <th className="px-2 py-2 text-left font-semibold">Expiry</th>
                            <th className="px-2 py-2 text-left font-semibold">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stockStatusRows.map((row) => (
                            <tr key={`stock-status-${row.itemName}-${row.entryDate}-${row.lotNumber}`} className="border-t border-border/70">
                              <td className="px-2 py-2">{row.itemName}</td>
                              <td className="px-2 py-2 text-right">{row.quantity}</td>
                              <td className="px-2 py-2 text-right">{row.minStock}</td>
                              <td className="px-2 py-2">{formatFullDate(row.expiryDate)}</td>
                              <td className="px-2 py-2">
                                <Badge variant={row.status === 'In Stock' ? 'secondary' : 'outline'}>{row.status}</Badge>
                              </td>
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
                  <CardTitle className="text-base">Material Usage Per Treatment</CardTitle>
                </CardHeader>
                <CardContent>
                  {materialUsagePerTreatment.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No treatment usage data in selected range.</p>
                  ) : (
                    <div className="overflow-x-auto rounded-md border border-border/70">
                      <table className="min-w-full text-xs">
                        <thead className="bg-muted/30">
                          <tr>
                            <th className="px-2 py-2 text-left font-semibold">Treatment</th>
                            <th className="px-2 py-2 text-right font-semibold">Sessions</th>
                            <th className="px-2 py-2 text-right font-semibold">Total Cost</th>
                            <th className="px-2 py-2 text-right font-semibold">Avg Cost / Session</th>
                          </tr>
                        </thead>
                        <tbody>
                          {materialUsagePerTreatment.map((row) => (
                            <tr key={`material-usage-${row.treatment}`} className="border-t border-border/70">
                              <td className="px-2 py-2">{row.treatment}</td>
                              <td className="px-2 py-2 text-right">{row.sessions}</td>
                              <td className="px-2 py-2 text-right">{formatCurrency(row.totalCost)}</td>
                              <td className="px-2 py-2 text-right">{formatCurrency(row.avgCost)}</td>
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
                  <CardTitle className="text-base">Inventory Usage by Patient</CardTitle>
                  <CardDescription>
                    Which inventory item was used, for what treatment, and for which patient.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {inventoryUsageRows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No inventory usage records in selected range.</p>
                  ) : (
                    <div className="overflow-x-auto rounded-md border border-border/70">
                      <table className="min-w-full text-xs">
                        <thead className="bg-muted/30">
                          <tr>
                            <th className="px-2 py-2 text-left font-semibold">Date</th>
                            <th className="px-2 py-2 text-left font-semibold">Item</th>
                            <th className="px-2 py-2 text-right font-semibold">Qty Used</th>
                            <th className="px-2 py-2 text-left font-semibold">Patient</th>
                            <th className="px-2 py-2 text-left font-semibold">Treatment</th>
                            <th className="px-2 py-2 text-left font-semibold">Visit</th>
                          </tr>
                        </thead>
                        <tbody>
                          {inventoryUsageRows.map((row, index) => (
                            <tr
                              key={`inventory-usage-${row.inventoryItemId}-${row.patientId}-${row.visitLabel}-${index}`}
                              className="border-t border-border/70"
                            >
                              <td className="px-2 py-2">{formatFullDate(row.usedOn)}</td>
                              <td className="px-2 py-2">{row.itemName}</td>
                              <td className="px-2 py-2 text-right">{row.quantityUsed} {row.unit}</td>
                              <td className="px-2 py-2">{row.patientName}</td>
                              <td className="px-2 py-2">{row.treatmentName}</td>
                              <td className="px-2 py-2">{row.visitLabel}</td>
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
                  <CardTitle className="text-base">Implant Inventory</CardTitle>
                </CardHeader>
                <CardContent>
                  {implantInventoryRows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No implant inventory rows in selected range.</p>
                  ) : (
                    <div className="overflow-x-auto rounded-md border border-border/70">
                      <table className="min-w-full text-xs">
                        <thead className="bg-muted/30">
                          <tr>
                            <th className="px-2 py-2 text-left font-semibold">Item</th>
                            <th className="px-2 py-2 text-left font-semibold">Batch / Serial</th>
                            <th className="px-2 py-2 text-right font-semibold">Qty</th>
                            <th className="px-2 py-2 text-left font-semibold">Supplier</th>
                            <th className="px-2 py-2 text-left font-semibold">Entry Date</th>
                            <th className="px-2 py-2 text-left font-semibold">Expiry</th>
                          </tr>
                        </thead>
                        <tbody>
                          {implantInventoryRows.map((row) => (
                            <tr key={`implant-inventory-${row.itemName}-${row.lotNumber}-${row.entryDate}`} className="border-t border-border/70">
                              <td className="px-2 py-2">{row.itemName}</td>
                              <td className="px-2 py-2">{row.lotNumber || '-'}</td>
                              <td className="px-2 py-2 text-right">{row.quantity}</td>
                              <td className="px-2 py-2">{row.supplier || '-'}</td>
                              <td className="px-2 py-2">{formatFullDate(row.entryDate)}</td>
                              <td className="px-2 py-2">{formatFullDate(row.expiryDate)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="audit" className="space-y-4">
              <Card className="border-border/70">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Financial Modification Log</CardTitle>
                  <CardDescription>Who changed financial records, with timestamp and value notes.</CardDescription>
                </CardHeader>
                <CardContent>
                  {financialModificationLogRows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No modification logs available from current dataset.</p>
                  ) : (
                    <div className="overflow-x-auto rounded-md border border-border/70">
                      <table className="min-w-full text-xs">
                        <thead className="bg-muted/30">
                          <tr>
                            <th className="px-2 py-2 text-left font-semibold">Entity</th>
                            <th className="px-2 py-2 text-left font-semibold">Action</th>
                            <th className="px-2 py-2 text-left font-semibold">Changed By</th>
                            <th className="px-2 py-2 text-left font-semibold">Timestamp</th>
                            <th className="px-2 py-2 text-left font-semibold">Before</th>
                            <th className="px-2 py-2 text-left font-semibold">After</th>
                          </tr>
                        </thead>
                        <tbody>
                          {financialModificationLogRows.map((row, index) => (
                            <tr key={`mod-log-${row.entity}-${row.timestamp}-${index}`} className="border-t border-border/70">
                              <td className="px-2 py-2">{row.entity}</td>
                              <td className="px-2 py-2">{row.action}</td>
                              <td className="px-2 py-2">{row.changedBy}</td>
                              <td className="px-2 py-2">{formatDateTime(row.timestamp)}</td>
                              <td className="px-2 py-2">{row.beforeValue}</td>
                              <td className="px-2 py-2">{row.afterValue}</td>
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
                  <CardTitle className="text-base">Access Logs</CardTitle>
                  <CardDescription>Recent report access and snapshot activity.</CardDescription>
                </CardHeader>
                <CardContent>
                  {accessLogRows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No access logs yet.</p>
                  ) : (
                    <div className="overflow-x-auto rounded-md border border-border/70">
                      <table className="min-w-full text-xs">
                        <thead className="bg-muted/30">
                          <tr>
                            <th className="px-2 py-2 text-left font-semibold">Action</th>
                            <th className="px-2 py-2 text-left font-semibold">User</th>
                            <th className="px-2 py-2 text-left font-semibold">Range</th>
                            <th className="px-2 py-2 text-left font-semibold">Timestamp</th>
                          </tr>
                        </thead>
                        <tbody>
                          {accessLogRows.map((row, index) => (
                            <tr key={`access-log-${row.generatedAt}-${index}`} className="border-t border-border/70">
                              <td className="px-2 py-2">{row.action}</td>
                              <td className="px-2 py-2">{row.user}</td>
                              <td className="px-2 py-2">{row.range}</td>
                              <td className="px-2 py-2">{formatDateTime(row.generatedAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
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

