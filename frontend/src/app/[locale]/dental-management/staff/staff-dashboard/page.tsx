'use client';

import { type ComponentType, JSX, useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { Header } from '@/components/header';
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
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utilities';
import { AxiosClient } from '@/modules/common/infrastructure/api/axios-client';
import { fetchAllRows } from '@/modules/common/infrastructure/api/fetch-all-rows';
import { useGetStaff } from '@/modules/dental-management/presentation/hooks';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowLeft,
  BadgeDollarSign,
  BriefcaseBusiness,
  CalendarClock,
  Coins,
  ContactRound,
  HandCoins,
  Mail,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';

type SalaryRow = {
  netAmount: number;
  id: string;
  paymentDate: string;
  salaryMonth: string;
  staffId: string;
  status: string;
};

type SafeRow = {
  amount: number;
  direction: string;
  entryType: string;
  id: string;
  notes: string;
  pickedByStaffId: string;
  transactionDate: string;
};

type VisitRow = {
  dentistId: string;
  id: string;
  patientId: string;
  visitDate: string;
};

type InvoiceRow = {
  id: string;
  invoiceDate: string;
  netAmount: number;
  paidAmount: number;
  visitId: string;
};

type DashboardActivity = {
  amount: number;
  date: string;
  description: string;
  id: string;
  kind: 'invoice' | 'safe' | 'salary';
  title: string;
};

type MonthlyFinancePoint = {
  billed: number;
  collected: number;
  debt: number;
  label: string;
  monthKey: string;
  safe: number;
  salary: number;
};

type MixPoint = {
  fill: string;
  label: string;
  value: number;
};

type StaffFinancialProfile = {
  activityMix: MixPoint[];
  averageCollectedPerInvoice: number;
  averageDebtPerInvoice: number;
  averageSalaryPayment: number;
  averageVisitRevenue: number;
  collectionRate: number;
  collectionsAmount: number;
  debtAmount: number;
  invoiceRows: InvoiceRow[];
  monthlyTimeline: MonthlyFinancePoint[];
  patientCount: number;
  pendingInvoiceCount: number;
  recentActivity: DashboardActivity[];
  safeOutAmount: number;
  safeRows: SafeRow[];
  salaryPaidAmount: number;
  salaryPendingAmount: number;
  salaryRows: SalaryRow[];
  settledInvoiceCount: number;
  totalInvoicedAmount: number;
  visitCount: number;
};

const apiClient = new AxiosClient();

const asText = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value.trim();
  return '';
};

const parseAmount = (value: unknown): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const parsed = Number(asText(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('en-US', {
    currency: 'AFN',
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
    style: 'currency',
  }).format(value);

const formatCompactCurrency = (value: number): string =>
  new Intl.NumberFormat('en-US', {
    currency: 'AFN',
    maximumFractionDigits: 1,
    notation: 'compact',
    style: 'currency',
  }).format(value);

const formatDate = (value: string): string => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(parsed);
};

const formatShortDate = (value: string): string => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
  }).format(parsed);
};

const formatSalaryMonth = (value: string): string => {
  if (!value) return '-';
  const [yearRaw, monthRaw] = value.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return value;
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(
    new Date(year, month - 1, 1)
  );
};

const formatMonthLabel = (value: string): string => {
  if (!value) return '-';
  const [yearRaw, monthRaw] = value.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return value;
  return new Intl.DateTimeFormat('en-US', { month: 'short' }).format(new Date(year, month - 1, 1));
};

const percentage = (numerator: number, denominator: number): number => {
  if (denominator <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((numerator / denominator) * 100)));
};

const initialsFromName = (name: string): string => {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
  return initials || 'ST';
};

const createEmptyProfile = (): StaffFinancialProfile => ({
  activityMix: [],
  averageCollectedPerInvoice: 0,
  averageDebtPerInvoice: 0,
  averageSalaryPayment: 0,
  averageVisitRevenue: 0,
  collectionRate: 0,
  collectionsAmount: 0,
  debtAmount: 0,
  invoiceRows: [],
  monthlyTimeline: [],
  patientCount: 0,
  pendingInvoiceCount: 0,
  recentActivity: [],
  safeOutAmount: 0,
  safeRows: [],
  salaryPaidAmount: 0,
  salaryPendingAmount: 0,
  salaryRows: [],
  settledInvoiceCount: 0,
  totalInvoicedAmount: 0,
  visitCount: 0,
});

type MetricCardProps = {
  accentClassName: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  title: string;
  value: string;
};

const MetricCard = ({
  accentClassName,
  description,
  icon: Icon,
  title,
  value,
}: Readonly<MetricCardProps>): JSX.Element => (
  <Card className="overflow-hidden rounded-[26px] border border-border/60 bg-card/95 py-0 shadow-sm">
    <CardContent className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {title}
          </p>
          <p className="text-2xl font-semibold text-foreground">{value}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <div
          className={cn(
            'flex size-11 items-center justify-center rounded-2xl border text-foreground shadow-sm',
            accentClassName
          )}
        >
          <Icon className="size-5" />
        </div>
      </div>
    </CardContent>
  </Card>
);

type InsightMeterProps = {
  description: string;
  tone: 'amber' | 'emerald' | 'sky';
  value: number;
};

const meterToneClassNames: Record<InsightMeterProps['tone'], string> = {
  amber: 'bg-amber-500',
  emerald: 'bg-emerald-500',
  sky: 'bg-sky-500',
};

const InsightMeter = ({ description, tone, value }: Readonly<InsightMeterProps>): JSX.Element => (
  <div className="space-y-2">
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{description}</span>
      <span className="font-medium text-foreground">{value}%</span>
    </div>
    <div className="h-2.5 rounded-full bg-muted/70">
      <div
        className={cn('h-2.5 rounded-full transition-all', meterToneClassNames[tone])}
        style={{ width: `${value}%` }}
      />
    </div>
  </div>
);

const monthlyFinanceChartConfig = {
  billed: { color: '#0f766e', label: 'Billed' },
  collected: { color: '#2563eb', label: 'Collected' },
  salary: { color: '#f97316', label: 'Salary' },
} satisfies ChartConfig;

const activityMixChartConfig = {
  value: { color: '#1d4ed8', label: 'Entries' },
} satisfies ChartConfig;

// eslint-disable-next-line react/function-component-definition
export default function StaffDashboardPage(): JSX.Element {
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tSidebar = useTranslations('sidebar.dentalManagement');

  const staffId = searchParams.get('staffId')?.trim() ?? '';

  const { data: staffResponse, isFetching: isLoadingStaff } = useGetStaff(staffId, {
    enabled: !!staffId,
  });
  const staff = staffResponse?.data ?? null;

  const [salaryRows, setSalaryRows] = useState<SalaryRow[]>([]);
  const [safeRows, setSafeRows] = useState<SafeRow[]>([]);
  const [visitRows, setVisitRows] = useState<VisitRow[]>([]);
  const [invoiceRows, setInvoiceRows] = useState<InvoiceRow[]>([]);
  const [isLoadingFinance, setIsLoadingFinance] = useState(false);

  const fetchFinanceData = useCallback(async (): Promise<void> => {
    if (!staffId) return;

    setIsLoadingFinance(true);
    try {
      const [salaryItems, safeItems, visitItems] = await Promise.all([
        fetchAllRows(apiClient, '/api/v1/dental-management/salary-payments', {
          sortBy: 'paymentDate',
          sortDirection: 'desc',
          'filter[staffId]': staffId,
        }),
        fetchAllRows(apiClient, '/api/v1/dental-management/safe-transactions', {
          sortBy: 'transactionDate',
          sortDirection: 'desc',
          'filter[pickedByStaffId]': staffId,
        }),
        fetchAllRows(apiClient, '/api/v1/dental-management/visits', {
          sortBy: 'visitDate',
          sortDirection: 'desc',
          'filter[dentistId]': staffId,
        }),
      ]);

      const visitIds = Array.from(
        new Set(
          visitItems
            .map((row) => asText(row.id))
            .filter(Boolean)
        )
      );

      const invoiceBatches = Array.from(
        { length: Math.ceil(visitIds.length / 50) },
        (_, index) => visitIds.slice(index * 50, index * 50 + 50)
      );

      const invoiceItems = invoiceBatches.length === 0
        ? []
        : (
          await Promise.all(
            invoiceBatches.map((visitIdBatch) =>
              fetchAllRows(apiClient, '/api/v1/dental-management/invoices', {
                include: ['payments'],
                sortBy: 'invoiceDate',
                sortDirection: 'desc',
                'filter[visitId]': visitIdBatch,
              })
            )
          )
        ).flat();

      setSalaryRows(
        salaryItems.map((row) => ({
          id: asText(row.id),
          netAmount: parseAmount(row.netAmount ?? row.net_amount),
          paymentDate: asText(row.paymentDate ?? row.payment_date),
          salaryMonth: asText(row.salaryMonth ?? row.salary_month),
          staffId: asText(row.staffId ?? row.staff_id),
          status: asText(row.status).toLowerCase(),
        }))
      );

      setSafeRows(
        safeItems.map((row) => ({
          amount: parseAmount(row.amount),
          direction: asText(row.direction).toLowerCase(),
          entryType: asText(row.entryType ?? row.entry_type),
          id: asText(row.id),
          notes: asText(row.notes),
          pickedByStaffId: asText(row.pickedByStaffId ?? row.picked_by_staff_id),
          transactionDate: asText(row.transactionDate ?? row.transaction_date),
        }))
      );

      setVisitRows(
        visitItems.map((row) => ({
          dentistId: asText(row.dentistId ?? row.dentist_id),
          id: asText(row.id),
          patientId: asText(row.patientId ?? row.patient_id),
          visitDate: asText(row.visitDate ?? row.visit_date),
        }))
      );

      setInvoiceRows(
        invoiceItems.map((row) => {
          const netAmount = parseAmount(row.netAmount ?? row.net_amount);
          const payments = Array.isArray(row.payments) ? row.payments : [];
          const paidFromPayments = payments.reduce((sum, payment) => {
            if (!payment || typeof payment !== 'object') return sum;
            return sum + parseAmount((payment as Record<string, unknown>).amount);
          }, 0);
          const status = asText(row.status).toLowerCase();
          const paidAmount =
            status === 'paid' && paidFromPayments <= 0 && netAmount > 0
              ? netAmount
              : paidFromPayments;

          return {
            id: asText(row.id),
            invoiceDate: asText(row.invoiceDate ?? row.invoice_date),
            netAmount,
            paidAmount,
            visitId: asText(row.visitId ?? row.visit_id),
          };
        })
      );
    } finally {
      setIsLoadingFinance(false);
    }
  }, [staffId]);

  useEffect(() => {
    void fetchFinanceData();
  }, [fetchFinanceData]);

  const profile = useMemo(() => {
    if (!staffId) return null;

    const selectedProfile = createEmptyProfile();
    const uniquePatients = new Set<string>();
    const visitDentistByVisitId = new Map<string, string>();
    const monthlyFinanceMap = new Map<string, MonthlyFinancePoint>();
    const activity: DashboardActivity[] = [];

    const ensureMonthPoint = (dateValue: string): MonthlyFinancePoint | null => {
      const parsed = new Date(dateValue);
      if (Number.isNaN(parsed.getTime())) return null;
      const monthKey = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
      const existing = monthlyFinanceMap.get(monthKey);
      if (existing) return existing;

      const point: MonthlyFinancePoint = {
        billed: 0,
        collected: 0,
        debt: 0,
        label: formatMonthLabel(monthKey),
        monthKey,
        safe: 0,
        salary: 0,
      };
      monthlyFinanceMap.set(monthKey, point);
      return point;
    };

    visitRows.forEach((visit) => {
      visitDentistByVisitId.set(visit.id, visit.dentistId);
      if (visit.dentistId !== staffId) return;

      selectedProfile.visitCount += 1;
      if (visit.patientId) {
        uniquePatients.add(visit.patientId);
      }
    });

    selectedProfile.patientCount = uniquePatients.size;

    salaryRows.forEach((salary) => {
      if (salary.staffId !== staffId) return;
      selectedProfile.salaryRows.push(salary);

      const monthPoint = ensureMonthPoint(salary.paymentDate || `${salary.salaryMonth}-01`);
      if (monthPoint) {
        monthPoint.salary += salary.netAmount;
      }

      activity.push({
        amount: salary.netAmount,
        date: salary.paymentDate,
        description: `${formatSalaryMonth(salary.salaryMonth)} salary marked ${salary.status || 'pending'}.`,
        id: `salary-${salary.id}`,
        kind: 'salary',
        title: 'Salary activity',
      });

      if (salary.status === 'paid' || salary.status === 'partial') {
        selectedProfile.salaryPaidAmount += salary.netAmount;
      } else {
        selectedProfile.salaryPendingAmount += salary.netAmount;
      }
    });

    safeRows.forEach((row) => {
      if (row.pickedByStaffId !== staffId || row.direction !== 'out') return;
      selectedProfile.safeRows.push(row);
      selectedProfile.safeOutAmount += row.amount;

      const monthPoint = ensureMonthPoint(row.transactionDate);
      if (monthPoint) {
        monthPoint.safe += row.amount;
      }

      activity.push({
        amount: row.amount,
        date: row.transactionDate,
        description: row.notes || row.entryType.replaceAll('_', ' '),
        id: `safe-${row.id}`,
        kind: 'safe',
        title: 'Safe pickup',
      });
    });

    invoiceRows.forEach((invoice) => {
      const dentistId = visitDentistByVisitId.get(invoice.visitId);
      if (dentistId !== staffId) return;

      selectedProfile.invoiceRows.push(invoice);
      selectedProfile.collectionsAmount += invoice.paidAmount;
      selectedProfile.totalInvoicedAmount += invoice.netAmount;

      const remainingDebt = Math.max(0, invoice.netAmount - invoice.paidAmount);
      selectedProfile.debtAmount += remainingDebt;
      if (remainingDebt > 0) {
        selectedProfile.pendingInvoiceCount += 1;
      } else {
        selectedProfile.settledInvoiceCount += 1;
      }

      const monthPoint = ensureMonthPoint(invoice.invoiceDate);
      if (monthPoint) {
        monthPoint.billed += invoice.netAmount;
        monthPoint.collected += invoice.paidAmount;
        monthPoint.debt += remainingDebt;
      }

      activity.push({
        amount: invoice.paidAmount,
        date: invoice.invoiceDate,
        description: remainingDebt > 0
          ? `${formatCurrency(remainingDebt)} still outstanding on invoice #${invoice.id}.`
          : `Invoice #${invoice.id} is fully settled.`,
        id: `invoice-${invoice.id}`,
        kind: 'invoice',
        title: 'Invoice update',
      });
    });

    selectedProfile.collectionRate = percentage(
      selectedProfile.collectionsAmount,
      selectedProfile.totalInvoicedAmount
    );
    selectedProfile.averageCollectedPerInvoice =
      selectedProfile.invoiceRows.length > 0
        ? selectedProfile.collectionsAmount / selectedProfile.invoiceRows.length
        : 0;
    selectedProfile.averageDebtPerInvoice =
      selectedProfile.invoiceRows.length > 0
        ? selectedProfile.debtAmount / selectedProfile.invoiceRows.length
        : 0;
    selectedProfile.averageSalaryPayment =
      selectedProfile.salaryRows.length > 0
        ? (selectedProfile.salaryPaidAmount + selectedProfile.salaryPendingAmount) /
          selectedProfile.salaryRows.length
        : 0;
    selectedProfile.averageVisitRevenue =
      selectedProfile.visitCount > 0
        ? selectedProfile.totalInvoicedAmount / selectedProfile.visitCount
        : 0;

    selectedProfile.monthlyTimeline = Array.from(monthlyFinanceMap.values())
      .sort((left, right) => left.monthKey.localeCompare(right.monthKey))
      .slice(-6);

    selectedProfile.recentActivity = activity
      .sort((left, right) => {
        const leftTime = new Date(left.date).getTime();
        const rightTime = new Date(right.date).getTime();
        return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
      })
      .slice(0, 8);

    selectedProfile.activityMix = [
      {
        fill: '#2563eb',
        label: 'Invoices',
        value: selectedProfile.invoiceRows.length,
      },
      {
        fill: '#f97316',
        label: 'Salary',
        value: selectedProfile.salaryRows.length,
      },
      {
        fill: '#14b8a6',
        label: 'Safe',
        value: selectedProfile.safeRows.length,
      },
    ];

    return selectedProfile;
  }, [invoiceRows, safeRows, salaryRows, staffId, visitRows]);

  const dashboardTitle = staff?.fullName || 'Staff Dashboard';
  const isLoading = isLoadingStaff || isLoadingFinance;

  const staffStatus = String(staff?.enabled ?? '') === '1' ? 'Active' : 'Inactive';
  const staffStatusTone = String(staff?.enabled ?? '') === '1'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : 'border-slate-200 bg-slate-100 text-slate-700';

  const staffInsights = useMemo(() => {
    if (!profile) {
      return {
        collectionHealth: 0,
        patientReach: 0,
        salaryLoad: 0,
      };
    }

    return {
      collectionHealth: profile.collectionRate,
      patientReach: percentage(profile.patientCount, Math.max(profile.visitCount, 1)),
      salaryLoad: percentage(
        profile.salaryPaidAmount + profile.salaryPendingAmount,
        Math.max(profile.collectionsAmount, profile.totalInvoicedAmount, 1)
      ),
    };
  }, [profile]);

  const salarySummaryText = useMemo(() => {
    if (!profile) return 'No salary activity available yet.';
    if (profile.salaryRows.length === 0) return 'No salary activity available yet.';

    if (profile.salaryPendingAmount > 0) {
      return `${formatCurrency(profile.salaryPendingAmount)} is still pending across payroll records.`;
    }

    return 'All recorded salary entries are fully cleared.';
  }, [profile]);

  const salaryByMonth = useMemo(() => {
    if (!profile) return [];

    const grouped = new Map<string, { month: string; paid: number; pending: number; total: number }>();

    profile.salaryRows.forEach((row) => {
      const monthKey = row.salaryMonth || 'unknown';
      const current = grouped.get(monthKey) ?? {
        month: monthKey,
        paid: 0,
        pending: 0,
        total: 0,
      };

      current.total += row.netAmount;
      if (row.status === 'paid' || row.status === 'partial') {
        current.paid += row.netAmount;
      } else {
        current.pending += row.netAmount;
      }

      grouped.set(monthKey, current);
    });

    return Array.from(grouped.values()).sort((left, right) => right.month.localeCompare(left.month));
  }, [profile]);

  return (
    <>
      <Header
        breadcrumbs={[
          { id: 'dentalManagement', label: tSidebar('title') },
          { id: 'staff', href: `/${locale}/dental-management/staff`, label: tSidebar('staff') },
          { id: 'staffDashboard', isCurrent: true, label: dashboardTitle },
        ]}
      />

      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:px-6 md:py-6">
            <div className="flex justify-start">
              <Button
                type="button"
                variant="outline"
                className="rounded-2xl"
                onClick={() => {
                  router.push(`/${locale}/dental-management/staff`);
                }}
              >
                <ArrowLeft className="me-2 size-4" />
                Back To Staff
              </Button>
            </div>

            {!staffId ? (
              <Card className="rounded-[28px] border bg-background/95 shadow-sm">
                <CardContent className="p-6">
                  <p className="text-sm text-muted-foreground">Invalid staff id.</p>
                </CardContent>
              </Card>
            ) : !isLoadingStaff && !staff ? (
              <Card className="rounded-[28px] border bg-background/95 shadow-sm">
                <CardContent className="p-6">
                  <p className="text-sm text-muted-foreground">Staff record not found.</p>
                </CardContent>
              </Card>
            ) : isLoading && !staff ? (
              <div className="space-y-4">
                <Card className="rounded-[32px] border py-0">
                  <CardContent className="space-y-5 p-6 md:p-8">
                    <div className="flex items-center gap-4">
                      <Skeleton className="size-16 rounded-2xl" />
                      <div className="space-y-2">
                        <Skeleton className="h-5 w-40" />
                        <Skeleton className="h-4 w-56" />
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-4">
                      {Array.from({ length: 4 }).map((_, index) => (
                        <Skeleton key={`metric-skeleton-${index}`} className="h-28 rounded-[24px]" />
                      ))}
                    </div>
                  </CardContent>
                </Card>
                <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                  <Skeleton className="h-[360px] rounded-[28px]" />
                  <Skeleton className="h-[360px] rounded-[28px]" />
                </div>
              </div>
            ) : staff && profile ? (
              <div className="space-y-4">
                <section className="relative overflow-hidden rounded-[32px] border border-slate-200/80 bg-gradient-to-br from-slate-50 via-white to-cyan-50 text-slate-950 shadow-[0_24px_70px_rgba(148,163,184,0.22)] dark:border-border/60 dark:bg-gradient-to-br dark:from-slate-950 dark:via-slate-900 dark:to-cyan-950 dark:text-slate-50 dark:shadow-[0_24px_70px_rgba(15,23,42,0.28)]">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(8,145,178,0.16),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.12),transparent_32%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.2),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.24),transparent_32%)]" />
                  <div className="absolute -right-20 top-10 h-56 w-56 rounded-full bg-cyan-400/20 blur-3xl dark:bg-cyan-400/10" />
                  <div className="absolute left-10 top-16 h-44 w-44 rounded-full bg-blue-400/16 blur-3xl dark:bg-blue-400/10" />

                  <div className="relative grid gap-6 p-6 md:p-8 xl:grid-cols-[1.2fr_0.8fr]">
                    <div className="space-y-6">
                      <div className="flex flex-wrap items-start gap-4">
                        <Avatar className="size-16 rounded-2xl border border-slate-200/80 dark:border-white/15">
                          <AvatarFallback className="rounded-2xl bg-white/80 text-lg font-semibold text-slate-950 dark:bg-white/10 dark:text-white">
                            {initialsFromName(staff.fullName || `Staff ${staff.id}`)}
                          </AvatarFallback>
                        </Avatar>

                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className="rounded-full border border-slate-200/80 bg-white/80 px-3 py-1 text-slate-900 hover:bg-white/80 dark:border-white/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/10">
                              <Sparkles className="me-1.5 size-3.5" />
                              Advanced Staff Dashboard
                            </Badge>
                            <Badge className={cn('rounded-full px-3 py-1', staffStatusTone)}>
                              {staffStatus}
                            </Badge>
                          </div>

                          <div>
                            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                              {staff.fullName || `Staff #${staff.id}`}
                            </h1>
                            <p className="mt-2 max-w-2xl text-sm text-slate-600 md:text-base dark:text-slate-300">
                              Professional profile, revenue visibility, payroll posture, and recent operational movement in one place.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-[24px] border border-slate-200/70 bg-white/78 p-4 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none">
                          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                            <BriefcaseBusiness className="size-4 text-cyan-700 dark:text-cyan-300" />
                            Role
                          </div>
                          <p className="mt-2 text-base font-semibold text-slate-950 capitalize dark:text-white">
                            {staff.role || '-'}
                          </p>
                        </div>
                        <div className="rounded-[24px] border border-slate-200/70 bg-white/78 p-4 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none">
                          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                            <Stethoscope className="size-4 text-cyan-700 dark:text-cyan-300" />
                            Specialization
                          </div>
                          <p className="mt-2 text-base font-semibold text-slate-950 dark:text-white">
                            {staff.specialization || 'General support'}
                          </p>
                        </div>
                        <div className="rounded-[24px] border border-slate-200/70 bg-white/78 p-4 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none">
                          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                            <ContactRound className="size-4 text-cyan-700 dark:text-cyan-300" />
                            Contact
                          </div>
                          <p className="mt-2 text-base font-semibold text-slate-950 dark:text-white">
                            {staff.contactNumber || 'Not provided'}
                          </p>
                        </div>
                        <div className="rounded-[24px] border border-slate-200/70 bg-white/78 p-4 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none">
                          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                            <CalendarClock className="size-4 text-cyan-700 dark:text-cyan-300" />
                            Hire Date
                          </div>
                          <p className="mt-2 text-base font-semibold text-slate-950 dark:text-white">
                            {formatDate(staff.hireDate)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                      <div className="rounded-[28px] border border-slate-200/80 bg-white/80 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-white/8 dark:shadow-none">
                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-700 dark:text-slate-300">
                          Revenue Standing
                        </p>
                        <div className="mt-3 flex items-end justify-between gap-4">
                          <div>
                            <p className="text-3xl font-semibold text-slate-950 dark:text-white">
                              {profile.collectionRate}%
                            </p>
                            <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                              collection efficiency against total invoiced amount
                            </p>
                          </div>
                          <TrendingUp className="size-8 text-emerald-600 dark:text-emerald-300" />
                        </div>
                        <div className="mt-4 h-2.5 rounded-full bg-slate-200 dark:bg-white/10">
                          <div
                            className="h-2.5 rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400"
                            style={{ width: `${profile.collectionRate}%` }}
                          />
                        </div>
                      </div>

                      <div className="rounded-[28px] border border-slate-200/80 bg-white/80 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-white/8 dark:shadow-none">
                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-700 dark:text-slate-300">
                          Balance At Risk
                        </p>
                        <div className="mt-3 flex items-end justify-between gap-4">
                          <div>
                            <p className="text-3xl font-semibold text-slate-950 dark:text-white">
                              {formatCompactCurrency(profile.debtAmount)}
                            </p>
                            <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                              open debt across {profile.pendingInvoiceCount} invoice records
                            </p>
                          </div>
                          <TrendingDown className="size-8 text-amber-600 dark:text-amber-300" />
                        </div>
                        <div className="mt-4 flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                          <ShieldCheck className="size-4 text-cyan-700 dark:text-cyan-300" />
                          Avg debt per invoice: {formatCurrency(profile.averageDebtPerInvoice)}
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <MetricCard
                    title="Patients Reached"
                    value={String(profile.patientCount)}
                    description={`${profile.visitCount} completed visits linked to this staff profile.`}
                    icon={Users}
                    accentClassName="border-sky-200 bg-sky-50 text-sky-700"
                  />
                  <MetricCard
                    title="Collected Revenue"
                    value={formatCompactCurrency(profile.collectionsAmount)}
                    description={`Average settled amount ${formatCurrency(profile.averageCollectedPerInvoice)} per invoice.`}
                    icon={ReceiptText}
                    accentClassName="border-emerald-200 bg-emerald-50 text-emerald-700"
                  />
                  <MetricCard
                    title="Salary Exposure"
                    value={formatCompactCurrency(profile.salaryPaidAmount + profile.salaryPendingAmount)}
                    description={salarySummaryText}
                    icon={Coins}
                    accentClassName="border-amber-200 bg-amber-50 text-amber-700"
                  />
                  <MetricCard
                    title="Safe Outflow"
                    value={formatCompactCurrency(profile.safeOutAmount)}
                    description={`${profile.safeRows.length} safe pickup entries were assigned to this staff.`}
                    icon={HandCoins}
                    accentClassName="border-violet-200 bg-violet-50 text-violet-700"
                  />
                </section>

                <Tabs defaultValue="overview" className="gap-4">
                  <TabsList className="h-auto w-full flex-wrap justify-start rounded-2xl border border-border/60 bg-background p-1.5 sm:w-fit">
                    <TabsTrigger value="overview" className="rounded-xl px-4 py-2">
                      Overview
                    </TabsTrigger>
                    <TabsTrigger value="finance" className="rounded-xl px-4 py-2">
                      Finance
                    </TabsTrigger>
                    <TabsTrigger value="activity" className="rounded-xl px-4 py-2">
                      Activity
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="overview" className="space-y-4">
                    <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                      <Card className="rounded-[28px] border border-border/60 py-0 shadow-sm">
                        <CardHeader className="border-b px-6 py-5">
                          <CardTitle>Financial Momentum</CardTitle>
                          <CardDescription>
                            Six-month billed, collected, and salary trend for this staff member.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="p-4 md:p-6">
                          {profile.monthlyTimeline.length === 0 ? (
                            <div className="grid h-[320px] place-items-center rounded-[22px] border border-dashed text-sm text-muted-foreground">
                              No monthly finance history is available yet.
                            </div>
                          ) : (
                            <ChartContainer
                              config={monthlyFinanceChartConfig}
                              className="h-[320px] w-full"
                            >
                              <AreaChart data={profile.monthlyTimeline}>
                                <defs>
                                  <linearGradient id="staffCollectedGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="var(--color-collected)" stopOpacity={0.85} />
                                    <stop offset="95%" stopColor="var(--color-collected)" stopOpacity={0.12} />
                                  </linearGradient>
                                  <linearGradient id="staffBilledGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="var(--color-billed)" stopOpacity={0.75} />
                                    <stop offset="95%" stopColor="var(--color-billed)" stopOpacity={0.08} />
                                  </linearGradient>
                                  <linearGradient id="staffSalaryGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="var(--color-salary)" stopOpacity={0.7} />
                                    <stop offset="95%" stopColor="var(--color-salary)" stopOpacity={0.08} />
                                  </linearGradient>
                                </defs>
                                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                                <XAxis
                                  dataKey="label"
                                  tickLine={false}
                                  axisLine={false}
                                  tickMargin={8}
                                />
                                <YAxis
                                  tickLine={false}
                                  axisLine={false}
                                  width={70}
                                  tickFormatter={(value) => formatCompactCurrency(Number(value))}
                                />
                                <ChartTooltip
                                  cursor={false}
                                  content={<ChartTooltipContent indicator="line" />}
                                />
                                <Area
                                  dataKey="collected"
                                  type="monotone"
                                  fill="url(#staffCollectedGradient)"
                                  stroke="var(--color-collected)"
                                  strokeWidth={2}
                                />
                                <Area
                                  dataKey="billed"
                                  type="monotone"
                                  fill="url(#staffBilledGradient)"
                                  stroke="var(--color-billed)"
                                  strokeWidth={2}
                                />
                                <Area
                                  dataKey="salary"
                                  type="monotone"
                                  fill="url(#staffSalaryGradient)"
                                  stroke="var(--color-salary)"
                                  strokeWidth={2}
                                />
                              </AreaChart>
                            </ChartContainer>
                          )}
                        </CardContent>
                      </Card>

                      <Card className="rounded-[28px] border border-border/60 py-0 shadow-sm">
                        <CardHeader className="border-b px-6 py-5">
                          <CardTitle>Performance Signals</CardTitle>
                          <CardDescription>
                            Quick health indicators across collections, patient coverage, and payroll load.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6 p-6">
                          <InsightMeter
                            description="Collection health"
                            value={staffInsights.collectionHealth}
                            tone="emerald"
                          />
                          <InsightMeter
                            description="Patient reach"
                            value={staffInsights.patientReach}
                            tone="sky"
                          />
                          <InsightMeter
                            description="Salary load versus revenue"
                            value={staffInsights.salaryLoad}
                            tone="amber"
                          />

                          <Separator />

                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="rounded-[22px] border border-border/50 bg-muted/20 p-4">
                              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                                Average Visit Revenue
                              </p>
                              <p className="mt-2 text-lg font-semibold text-foreground">
                                {formatCurrency(profile.averageVisitRevenue)}
                              </p>
                            </div>
                            <div className="rounded-[22px] border border-border/50 bg-muted/20 p-4">
                              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                                Settled Invoices
                              </p>
                              <p className="mt-2 text-lg font-semibold text-foreground">
                                {profile.settledInvoiceCount}
                              </p>
                            </div>
                            <div className="rounded-[22px] border border-border/50 bg-muted/20 p-4">
                              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                                Pending Salary
                              </p>
                              <p className="mt-2 text-lg font-semibold text-foreground">
                                {formatCurrency(profile.salaryPendingAmount)}
                              </p>
                            </div>
                            <div className="rounded-[22px] border border-border/50 bg-muted/20 p-4">
                              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                                Email
                              </p>
                              <p className="mt-2 truncate text-lg font-semibold text-foreground">
                                {staff.email || '-'}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </TabsContent>

                  <TabsContent value="finance" className="space-y-4">
                    <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
                      <Card className="rounded-[28px] border border-border/60 py-0 shadow-sm">
                        <CardHeader className="border-b px-6 py-5">
                          <CardTitle>Transaction Mix</CardTitle>
                          <CardDescription>
                            Distribution of financial records attached to this staff profile.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="p-4 md:p-6">
                          {profile.activityMix.every((item) => item.value === 0) ? (
                            <div className="grid h-[300px] place-items-center rounded-[22px] border border-dashed text-sm text-muted-foreground">
                              No transaction mix data yet.
                            </div>
                          ) : (
                            <ChartContainer config={activityMixChartConfig} className="h-[300px] w-full">
                              <BarChart data={profile.activityMix}>
                                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={44} />
                                <ChartTooltip
                                  cursor={false}
                                  content={<ChartTooltipContent hideLabel />}
                                />
                                <Bar dataKey="value" radius={[14, 14, 0, 0]}>
                                  {profile.activityMix.map((entry) => (
                                    <Cell key={`mix-${entry.label}`} fill={entry.fill} />
                                  ))}
                                </Bar>
                              </BarChart>
                            </ChartContainer>
                          )}
                        </CardContent>
                      </Card>

                      <Card className="rounded-[28px] border border-border/60 py-0 shadow-sm">
                        <CardHeader className="border-b px-6 py-5">
                          <CardTitle>Finance Summary</CardTitle>
                          <CardDescription>
                            Core commercial and payroll indicators for faster review.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-4 p-6 md:grid-cols-2">
                          <div className="rounded-[24px] border border-emerald-200/70 bg-emerald-50/70 p-5">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-medium text-emerald-900">Total Invoiced</p>
                              <BadgeDollarSign className="size-5 text-emerald-700" />
                            </div>
                            <p className="mt-3 text-2xl font-semibold text-emerald-950">
                              {formatCurrency(profile.totalInvoicedAmount)}
                            </p>
                          </div>

                          <div className="rounded-[24px] border border-blue-200/70 bg-blue-50/70 p-5">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-medium text-blue-900">Collected</p>
                              <Wallet className="size-5 text-blue-700" />
                            </div>
                            <p className="mt-3 text-2xl font-semibold text-blue-950">
                              {formatCurrency(profile.collectionsAmount)}
                            </p>
                          </div>

                          <div className="rounded-[24px] border border-amber-200/70 bg-amber-50/70 p-5">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-medium text-amber-900">Outstanding Debt</p>
                              <TrendingDown className="size-5 text-amber-700" />
                            </div>
                            <p className="mt-3 text-2xl font-semibold text-amber-950">
                              {formatCurrency(profile.debtAmount)}
                            </p>
                          </div>

                          <div className="rounded-[24px] border border-violet-200/70 bg-violet-50/70 p-5">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-medium text-violet-900">Salary Paid</p>
                              <Coins className="size-5 text-violet-700" />
                            </div>
                            <p className="mt-3 text-2xl font-semibold text-violet-950">
                              {formatCurrency(profile.salaryPaidAmount)}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    <Card className="rounded-[28px] border border-border/60 py-0 shadow-sm">
                      <CardHeader className="border-b px-6 py-5">
                        <CardTitle>Full Salary Details</CardTitle>
                        <CardDescription>
                          Complete payroll visibility with total, paid, pending, and average salary values.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-5">
                        <div className="rounded-[24px] border border-violet-200/70 bg-violet-50/70 p-5">
                          <p className="text-sm font-medium text-violet-900">Total Salary</p>
                          <p className="mt-3 text-2xl font-semibold text-violet-950">
                            {formatCurrency(profile.salaryPaidAmount + profile.salaryPendingAmount)}
                          </p>
                        </div>

                        <div className="rounded-[24px] border border-emerald-200/70 bg-emerald-50/70 p-5">
                          <p className="text-sm font-medium text-emerald-900">Paid Salary</p>
                          <p className="mt-3 text-2xl font-semibold text-emerald-950">
                            {formatCurrency(profile.salaryPaidAmount)}
                          </p>
                        </div>

                        <div className="rounded-[24px] border border-amber-200/70 bg-amber-50/70 p-5">
                          <p className="text-sm font-medium text-amber-900">Pending Salary</p>
                          <p className="mt-3 text-2xl font-semibold text-amber-950">
                            {formatCurrency(profile.salaryPendingAmount)}
                          </p>
                        </div>

                        <div className="rounded-[24px] border border-sky-200/70 bg-sky-50/70 p-5">
                          <p className="text-sm font-medium text-sky-900">Average Salary Entry</p>
                          <p className="mt-3 text-2xl font-semibold text-sky-950">
                            {formatCurrency(profile.averageSalaryPayment)}
                          </p>
                        </div>

                        <div className="rounded-[24px] border border-slate-200/70 bg-slate-50/80 p-5">
                          <p className="text-sm font-medium text-slate-900">Salary Records</p>
                          <p className="mt-3 text-2xl font-semibold text-slate-950">
                            {profile.salaryRows.length}
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                    <div className="grid gap-4 xl:grid-cols-2">
                      <Card className="rounded-[28px] border border-border/60 py-0 shadow-sm">
                        <CardHeader className="border-b px-6 py-5">
                          <CardTitle>Salary Per Month</CardTitle>
                          <CardDescription>
                            Monthly salary totals with paid and pending breakdown.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                          {salaryByMonth.length === 0 ? (
                            <div className="px-6 py-8 text-sm text-muted-foreground">
                              No monthly salary data yet.
                            </div>
                          ) : (
                            <div className="max-h-[360px] overflow-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Month</TableHead>
                                    <TableHead className="text-right">Total</TableHead>
                                    <TableHead className="text-right">Paid</TableHead>
                                    <TableHead className="text-right">Pending</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {salaryByMonth.map((row) => (
                                    <TableRow key={row.month}>
                                      <TableCell>{formatSalaryMonth(row.month)}</TableCell>
                                      <TableCell className="text-right">
                                        {formatCurrency(row.total)}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        {formatCurrency(row.paid)}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        {formatCurrency(row.pending)}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      <Card className="rounded-[28px] border border-border/60 py-0 shadow-sm">
                        <CardHeader className="border-b px-6 py-5">
                          <CardTitle>Salary History</CardTitle>
                          <CardDescription>
                            Payroll records associated with this staff profile, with full amount visibility.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                          {profile.salaryRows.length === 0 ? (
                            <div className="px-6 py-8 text-sm text-muted-foreground">
                              No salary records yet.
                            </div>
                          ) : (
                            <div className="max-h-[360px] overflow-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Month</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Net</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {profile.salaryRows.map((row) => (
                                    <TableRow key={row.id}>
                                      <TableCell>{formatSalaryMonth(row.salaryMonth)}</TableCell>
                                      <TableCell>{formatDate(row.paymentDate)}</TableCell>
                                      <TableCell className="capitalize">{row.status || '-'}</TableCell>
                                      <TableCell className="text-right">
                                        {formatCurrency(row.netAmount)}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      <Card className="rounded-[28px] border border-border/60 py-0 shadow-sm">
                        <CardHeader className="border-b px-6 py-5">
                          <CardTitle>Invoice Ledger</CardTitle>
                          <CardDescription>
                            Invoice collection posture and unresolved balances.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                          {profile.invoiceRows.length === 0 ? (
                            <div className="px-6 py-8 text-sm text-muted-foreground">
                              No invoice payment data for this staff yet.
                            </div>
                          ) : (
                            <div className="max-h-[360px] overflow-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Invoice</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead className="text-right">Net</TableHead>
                                    <TableHead className="text-right">Paid</TableHead>
                                    <TableHead className="text-right">Debt</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {profile.invoiceRows.map((row) => (
                                    <TableRow key={row.id}>
                                      <TableCell>#{row.id}</TableCell>
                                      <TableCell>{formatDate(row.invoiceDate)}</TableCell>
                                      <TableCell className="text-right">
                                        {formatCurrency(row.netAmount)}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        {formatCurrency(row.paidAmount)}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        {formatCurrency(Math.max(0, row.netAmount - row.paidAmount))}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </TabsContent>

                  <TabsContent value="activity" className="space-y-4">
                    <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
                      <Card className="rounded-[28px] border border-border/60 py-0 shadow-sm">
                        <CardHeader className="border-b px-6 py-5">
                          <CardTitle>Profile Notes</CardTitle>
                          <CardDescription>
                            Static profile references and operator notes.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-5 p-6">
                          <div className="rounded-[22px] border border-border/50 bg-muted/20 p-4">
                            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                              Email Address
                            </p>
                            <div className="mt-2 flex items-center gap-2 text-sm font-medium text-foreground">
                              <Mail className="size-4 text-muted-foreground" />
                              {staff.email || 'Not available'}
                            </div>
                          </div>

                          <div className="rounded-[22px] border border-border/50 bg-muted/20 p-4">
                            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                              Remarks
                            </p>
                            <p className="mt-2 text-sm leading-6 text-foreground">
                              {staff.remarks || 'No remarks have been recorded for this staff profile.'}
                            </p>
                          </div>

                          <div className="rounded-[22px] border border-border/50 bg-muted/20 p-4">
                            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                              Safe Pickup Summary
                            </p>
                            <p className="mt-2 text-sm text-foreground">
                              {profile.safeRows.length} entries totaling {formatCurrency(profile.safeOutAmount)}.
                            </p>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="rounded-[28px] border border-border/60 py-0 shadow-sm">
                        <CardHeader className="border-b px-6 py-5">
                          <CardTitle>Recent Activity Feed</CardTitle>
                          <CardDescription>
                            Latest invoice, safe, and salary events tied to this staff member.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 p-6">
                          {profile.recentActivity.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                              No recent activity is available for this staff.
                            </p>
                          ) : (
                            profile.recentActivity.map((item) => (
                              <div
                                key={item.id}
                                className="rounded-[22px] border border-border/60 bg-background/80 p-4"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                      <Badge
                                        className={cn(
                                          'rounded-full px-2.5 py-0.5',
                                          item.kind === 'invoice' && 'border-blue-200 bg-blue-50 text-blue-700',
                                          item.kind === 'salary' && 'border-amber-200 bg-amber-50 text-amber-700',
                                          item.kind === 'safe' && 'border-teal-200 bg-teal-50 text-teal-700'
                                        )}
                                      >
                                        {item.title}
                                      </Badge>
                                      <span className="text-xs text-muted-foreground">
                                        {formatShortDate(item.date)}
                                      </span>
                                    </div>
                                    <p className="text-sm font-medium text-foreground">
                                      {item.description}
                                    </p>
                                  </div>
                                  <p className="text-sm font-semibold text-foreground">
                                    {formatCurrency(item.amount)}
                                  </p>
                                </div>
                              </div>
                            ))
                          )}
                        </CardContent>
                      </Card>
                    </div>

                    <Card className="rounded-[28px] border border-border/60 py-0 shadow-sm">
                      <CardHeader className="border-b px-6 py-5">
                        <CardTitle>Safe Pickup Ledger</CardTitle>
                        <CardDescription>
                          Outgoing safe transactions recorded under this staff profile.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-0">
                        {profile.safeRows.length === 0 ? (
                          <div className="px-6 py-8 text-sm text-muted-foreground">
                            No safe pickup entries for this staff.
                          </div>
                        ) : (
                          <div className="max-h-[360px] overflow-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Date</TableHead>
                                  <TableHead>Type</TableHead>
                                  <TableHead className="text-right">Amount</TableHead>
                                  <TableHead>Notes</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {profile.safeRows.map((row) => (
                                  <TableRow key={row.id}>
                                    <TableCell>{formatDate(row.transactionDate)}</TableCell>
                                    <TableCell className="capitalize">
                                      {row.entryType.replaceAll('_', ' ') || '-'}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {formatCurrency(row.amount)}
                                    </TableCell>
                                    <TableCell>{row.notes || '-'}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </div>
            ) : (
              <Card className="rounded-[28px] border bg-background/95 shadow-sm">
                <CardContent className="p-6">
                  <p className="text-sm text-muted-foreground">Loading staff dashboard...</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
