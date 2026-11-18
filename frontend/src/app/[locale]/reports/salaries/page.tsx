'use client';

import { FormEvent, JSX, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Header } from '@/components/header';
import { LoadingState } from '@/components/shared/loading-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DEFAULT_AFN_PER_USD,
  formatCurrency,
  getExchangeRate,
  parseMoney,
  type CurrencyCode,
} from '@/lib/currency-utils';
import { AxiosClient } from '@/modules/common/infrastructure/api/axios-client';
import { useStaffList } from '@/modules/dental-management/presentation/hooks';
import {
  createDefaultReportRange,
  fetchReport,
  toInputDate,
} from '@/modules/dental-management/presentation/reports/report-client';
import { ReportPageIntro } from '@/modules/dental-management/presentation/reports/report-page-intro';
import { BadgeCheck, Clock3, Coins, ReceiptText, Search, Trash2, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { useDebounce } from 'use-debounce';

type SalaryRow = {
  createdAt: string;
  currency: CurrencyCode;
  exchangeRate: number;
  id: number;
  netAmount: number;
  netAmountInput: number;
  paymentDate: string;
  salaryMonth: string;
  staffId: number;
  staffName: string;
  status: string;
};

type SalaryCurrencySections = Record<
  CurrencyCode,
  {
    paidTotal: number;
  }
>;

type SalaryReportResponse = {
  rows: {
    data: SalaryRow[];
    meta: {
      currentPage: number;
      lastPage: number;
      perPage: number;
      total: number;
    };
  };
  summary: {
    currencySections: SalaryCurrencySections;
    paidTotal: number;
    pendingCount: number;
    totalCount: number;
  };
};

type SalaryForm = {
  bonusAmount: string;
  currency: CurrencyCode;
  deductionAmount: string;
  exchangeRate: string;
  grossAmount: string;
  notes: string;
  paidFromSafe: boolean;
  paymentDate: string;
  salaryMonth: string;
  staffId: string;
  status: 'paid' | 'partial' | 'pending';
};

const client = new AxiosClient();

const toMonthValue = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const buildSalaryMonthOptions = (monthsBack: number): Array<{ label: string; value: string }> => {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });
  const options: Array<{ label: string; value: string }> = [];

  for (let index = 0; index < monthsBack; index += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    options.push({
      label: formatter.format(date),
      value: toMonthValue(date),
    });
  }

  return options;
};

const extractApiErrorMessage = (error: unknown, fallback: string): string => {
  const response = (
    error as {
      response?: {
        data?: { error?: { code?: string; details?: Record<string, unknown>; message?: string } };
      };
    }
  )?.response;
  const payload = response?.data?.error;
  const code = payload?.code;

  if (code === 'SAFE_BALANCE_INSUFFICIENT') {
    const currency = String(payload?.details?.currency ?? 'AFN') === 'USD' ? 'USD' : 'AFN';
    const currentBalance = Number(payload?.details?.currentBalance ?? 0);
    const requestedAmount = Number(payload?.details?.requestedAmount ?? 0);
    return `Safe balance is not enough. Current: ${formatCurrency(currentBalance, currency)}. Requested: ${formatCurrency(requestedAmount, currency)}. Add money to safe or reduce the salary amount.`;
  }

  return payload?.message || fallback;
};

const defaultForm = (): SalaryForm => ({
  bonusAmount: '0',
  currency: 'AFN',
  deductionAmount: '0',
  exchangeRate: '1',
  grossAmount: '',
  notes: '',
  paidFromSafe: true,
  paymentDate: toInputDate(new Date()),
  salaryMonth: toMonthValue(new Date()),
  staffId: '',
  status: 'paid',
});

const emptyCurrencySections = (): SalaryCurrencySections => ({
  AFN: {
    paidTotal: 0,
  },
  USD: {
    paidTotal: 0,
  },
});

const SalariesPage = (): JSX.Element => {
  const tSidebar = useTranslations('sidebar');
  const tReports = useTranslations('sidebar.reports');
  const { entities: staff } = useStaffList(1, 100);
  const range = createDefaultReportRange(180);
  const [form, setForm] = useState<SalaryForm>(() => defaultForm());
  const [report, setReport] = useState<SalaryReportResponse | null>(null);
  const [defaultExchangeRate, setDefaultExchangeRate] = useState(DEFAULT_AFN_PER_USD);
  const [startDate, setStartDate] = useState(range.startDate);
  const [endDate, setEndDate] = useState(range.endDate);
  const [staffFilter, setStaffFilter] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebounce(search, 350);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const salaryMonthOptions = useMemo(() => buildSalaryMonthOptions(24), []);

  const fetchData = useCallback(
    async (pageNumber = 1): Promise<void> => {
      setIsLoading(true);
      try {
        const data = await fetchReport<SalaryReportResponse>(
          '/api/v1/dental-management/reports/salaries',
          {
            endDate,
            page: pageNumber,
            perPage: 12,
            search: debouncedSearch,
            sortBy: 'paymentDate',
            sortDirection: 'desc',
            staffId: staffFilter,
            startDate,
          }
        );
        setReport(data);
        setPage(pageNumber);
      } finally {
        setIsLoading(false);
      }
    },
    [debouncedSearch, endDate, staffFilter, startDate]
  );

  useEffect(() => {
    void fetchData(1);
  }, [fetchData]);

  useEffect(() => {
    void getExchangeRate(client)
      .then((rate) => setDefaultExchangeRate(rate))
      .catch(() => {
        setDefaultExchangeRate(DEFAULT_AFN_PER_USD);
      });
  }, []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    const grossAmount = parseMoney(form.grossAmount);
    const bonusAmount = parseMoney(form.bonusAmount);
    const deductionAmount = parseMoney(form.deductionAmount);
    const resolvedExchangeRate =
      form.currency === 'USD'
        ? Math.max(parseMoney(form.exchangeRate) || defaultExchangeRate, DEFAULT_AFN_PER_USD)
        : 1;
    if (
      !form.staffId ||
      grossAmount <= 0 ||
      !form.salaryMonth ||
      !form.paymentDate ||
      resolvedExchangeRate <= 0
    ) {
      return;
    }

    const netAmount = Math.max(0, grossAmount + bonusAmount - deductionAmount);

    setIsSubmitting(true);
    void client
      .post('/api/v1/dental-management/salary-payments', {
        bonusAmount,
        currency: form.currency,
        deductionAmount,
        exchangeRate: resolvedExchangeRate,
        grossAmount,
        netAmount,
        notes: form.notes.trim() || undefined,
        paidFromSafe: form.paidFromSafe,
        paymentDate: form.paymentDate,
        salaryMonth: form.salaryMonth,
        staffId: Number(form.staffId),
        status: form.status,
      })
      .then(async () => {
        setForm(defaultForm());
        await fetchData(1);
        toast.success('Salary payment saved.');
      })
      .catch((error: unknown) => {
        toast.error(extractApiErrorMessage(error, 'Failed to save salary payment.'));
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  const removeRow = (id: number): void => {
    void client
      .delete(`/api/v1/dental-management/salary-payments/${id}`)
      .then(async () => {
        await fetchData(page);
        toast.success('Salary payment deleted.');
      })
      .catch((error: unknown) => {
        toast.error(extractApiErrorMessage(error, 'Failed to delete salary payment.'));
      });
  };

  const grossAmount = parseMoney(form.grossAmount);
  const bonusAmount = parseMoney(form.bonusAmount);
  const deductionAmount = parseMoney(form.deductionAmount);
  const netAmount = Math.max(0, grossAmount + bonusAmount - deductionAmount);
  const resolvedExchangeRate =
    form.currency === 'USD'
      ? Math.max(parseMoney(form.exchangeRate) || defaultExchangeRate, DEFAULT_AFN_PER_USD)
      : 1;
  const currencySections = report?.summary.currencySections ?? emptyCurrencySections();

  const renderMoney = (
    amountInput: number,
    currency: CurrencyCode,
    amountAfn: number
  ): JSX.Element => (
    <div>
      <p className="font-semibold">{formatCurrency(amountInput, currency)}</p>
      {currency === 'USD' && (
        <p className="mt-0.5 text-xs text-muted-foreground">
          AFN equivalent: {formatCurrency(amountAfn, 'AFN')}
        </p>
      )}
    </div>
  );

  return (
    <>
      <Header
        breadcrumbs={[
          { id: 'reports', label: tSidebar('reports.title') },
          { id: 'salaries', isCurrent: true, label: tReports('salaries') },
        ]}
      />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex min-w-0 flex-col gap-4 px-4 py-4 md:gap-6 md:px-6 md:py-6">
            <ReportPageIntro
              title="Staff salaries"
              description="Manage staff payments, see what is outstanding, and keep a clear record by month."
            />
            <Card className="overflow-hidden rounded-3xl border-border/60 bg-card shadow-sm">
              <CardHeader className="border-b border-border/50 bg-gradient-to-r from-violet-500/[0.08] via-background to-background px-5 py-5 md:px-7">
                <CardTitle className="inline-flex items-center gap-2 text-lg">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-violet-600 text-white shadow-sm">
                    <ReceiptText className="size-4" />
                  </span>
                  Record a salary payment
                </CardTitle>
                <CardDescription className="max-w-2xl">
                  Choose the staff member and salary month, then enter the payment details. The
                  take-home amount updates as you type.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5 p-4 md:p-6 lg:grid-cols-[1.15fr_0.85fr]">
                <form
                  onSubmit={handleSubmit}
                  className="grid content-start gap-4 rounded-2xl border border-border/60 bg-background p-4 md:p-5"
                >
                  <div className="grid gap-1.5">
                    <Label>Staff</Label>
                    <select
                      className="h-9 rounded-md border bg-background px-3 text-sm"
                      value={form.staffId}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, staffId: event.target.value }))
                      }
                      required
                    >
                      <option value="">Select staff</option>
                      {staff.map((member) => (
                        <option key={member.id} value={String(member.id)}>
                          {member.fullName || `Staff #${member.id}`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-1.5">
                      <Label>Salary Month</Label>
                      <select
                        className="h-9 rounded-md border bg-background px-3 text-sm"
                        value={form.salaryMonth}
                        onChange={(event) =>
                          setForm((prev) => ({ ...prev, salaryMonth: event.target.value }))
                        }
                        required
                      >
                        {salaryMonthOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Payment Date</Label>
                      <Input
                        type="date"
                        value={form.paymentDate}
                        onChange={(event) =>
                          setForm((prev) => ({ ...prev, paymentDate: event.target.value }))
                        }
                        required
                      />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="grid gap-1.5">
                      <Label>Base salary</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.grossAmount}
                        onChange={(event) =>
                          setForm((prev) => ({ ...prev, grossAmount: event.target.value }))
                        }
                        required
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Extra pay</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.bonusAmount}
                        onChange={(event) =>
                          setForm((prev) => ({ ...prev, bonusAmount: event.target.value }))
                        }
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Amount deducted</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.deductionAmount}
                        onChange={(event) =>
                          setForm((prev) => ({ ...prev, deductionAmount: event.target.value }))
                        }
                      />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-1.5">
                      <Label>Currency</Label>
                      <select
                        className="h-9 rounded-md border bg-background px-3 text-sm"
                        value={form.currency}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            currency: event.target.value as CurrencyCode,
                            exchangeRate:
                              event.target.value === 'USD' ? String(defaultExchangeRate) : '1',
                          }))
                        }
                      >
                        <option value="AFN">AFN</option>
                        <option value="USD">USD</option>
                      </select>
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Exchange Rate</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.exchangeRate}
                        onChange={(event) =>
                          setForm((prev) => ({ ...prev, exchangeRate: event.target.value }))
                        }
                        disabled={form.currency === 'AFN'}
                        placeholder="AFN per 1 USD"
                      />
                    </div>
                  </div>
                  <div className="grid gap-3 rounded-2xl border border-violet-200/70 bg-violet-50/70 p-4 dark:border-violet-400/15 dark:bg-violet-400/[0.06] sm:grid-cols-[1fr_auto] sm:items-center">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-700 dark:text-violet-300">
                        Take-home amount
                      </p>
                      <p className="mt-1 text-2xl font-bold tracking-tight">
                        {formatCurrency(netAmount, form.currency)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Base salary + extra pay minus deductions
                      </p>
                      {form.currency === 'USD' && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Rate: 1 USD = {formatCurrency(resolvedExchangeRate, 'AFN')}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground sm:text-right">
                      <p>
                        Base{' '}
                        <span className="font-medium text-foreground">
                          {formatCurrency(grossAmount, form.currency)}
                        </span>
                      </p>
                      <p>
                        Extra{' '}
                        <span className="font-medium text-foreground">
                          {formatCurrency(bonusAmount, form.currency)}
                        </span>
                      </p>
                      <p>
                        Deducted{' '}
                        <span className="font-medium text-foreground">
                          -{formatCurrency(deductionAmount, form.currency)}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-1.5">
                      <Label>Status</Label>
                      <select
                        className="h-9 rounded-md border bg-background px-3 text-sm"
                        value={form.status}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            status: event.target.value as SalaryForm['status'],
                          }))
                        }
                      >
                        <option value="paid">Paid</option>
                        <option value="partial">Partial</option>
                        <option value="pending">Pending</option>
                      </select>
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Paid from clinic safe</Label>
                      <select
                        className="h-9 rounded-md border bg-background px-3 text-sm"
                        value={form.paidFromSafe ? 'yes' : 'no'}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            paidFromSafe: event.target.value === 'yes',
                          }))
                        }
                      >
                        <option value="yes">Yes</option>
                        <option value="no">No</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Notes</Label>
                    <Input
                      value={form.notes}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, notes: event.target.value }))
                      }
                      placeholder="Optional note"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="h-11 rounded-xl bg-violet-700 text-white shadow-sm hover:bg-violet-800"
                  >
                    {isSubmitting ? 'Saving payment...' : 'Save salary payment'}
                  </Button>
                </form>

                <div className="grid content-start gap-4">
                  <div className="flex items-center gap-2 px-1 text-sm font-semibold">
                    <Wallet className="size-4 text-muted-foreground" />
                    Payment overview
                  </div>
                  <div className="grid gap-3 xl:grid-cols-2">
                    {(['AFN', 'USD'] as CurrencyCode[]).map((currency) => (
                      <div
                        key={currency}
                        className="rounded-2xl border border-border/60 bg-gradient-to-br from-background to-muted/30 p-4"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                            Paid in {currency}
                          </p>
                          <Coins className="size-4 text-violet-600" />
                        </div>
                        <p className="mt-3 text-xl font-bold tracking-tight">
                          {formatCurrency(currencySections[currency].paidTotal, currency)}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Paid or partially paid in this date range
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="flex items-center gap-3 rounded-2xl border border-amber-200/70 bg-amber-50/60 p-4 dark:border-amber-400/15 dark:bg-amber-400/[0.05]">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300">
                        <Clock3 className="size-5" />
                      </span>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">
                          Pending payments
                        </p>
                        <p className="text-xl font-bold">{report?.summary.pendingCount ?? 0}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-muted/20 p-4">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-background text-muted-foreground">
                        <BadgeCheck className="size-5" />
                      </span>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Payment records</p>
                        <p className="text-xl font-bold">{report?.summary.totalCount ?? 0}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 rounded-2xl border border-border/60 bg-muted/15 p-4 md:grid-cols-2">
                    <div className="md:col-span-2 flex items-center gap-2 text-sm font-semibold">
                      <Search className="size-4 text-muted-foreground" />
                      Find salary records
                    </div>
                    <div className="grid gap-1.5">
                      <Label>From date</Label>
                      <Input
                        type="date"
                        value={startDate}
                        onChange={(event) => setStartDate(event.target.value)}
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>To date</Label>
                      <Input
                        type="date"
                        value={endDate}
                        onChange={(event) => setEndDate(event.target.value)}
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Staff member</Label>
                      <select
                        className="h-9 rounded-md border bg-background px-3 text-sm"
                        value={staffFilter}
                        onChange={(event) => setStaffFilter(event.target.value)}
                      >
                        <option value="">All staff</option>
                        {staff.map((member) => (
                          <option key={member.id} value={String(member.id)}>
                            {member.fullName || `Staff #${member.id}`}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Search records</Label>
                      <Input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Month or staff name"
                      />
                    </div>
                    <div className="md:col-span-2 flex justify-end">
                      <p className="text-xs text-muted-foreground">Results update automatically.</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden rounded-3xl border-border/60 shadow-sm">
              <CardHeader>
                <CardTitle className="inline-flex items-center gap-2">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    <ReceiptText className="size-4" />
                  </span>
                  Salary history
                </CardTitle>
                <CardDescription>Review and manage recorded salary payments.</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading && report === null ? (
                  <LoadingState
                    compact
                    title="Loading salary report"
                    description="Fetching salary payments."
                  />
                ) : (
                  <div className="space-y-4">
                    <div className="overflow-x-auto rounded-2xl border border-border/60">
                      <table className="min-w-[760px] w-full text-sm">
                        <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                          <tr>
                            <th className="px-4 py-3">Payment date</th>
                            <th className="px-4 py-3">Salary month</th>
                            <th className="px-4 py-3">Staff member</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3">Take-home amount</th>
                            <th className="px-4 py-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(report?.rows.data ?? []).map((row) => (
                            <tr
                              key={row.id}
                              className="border-t border-border/50 transition-colors hover:bg-muted/20"
                            >
                              <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                                {row.paymentDate}
                              </td>
                              <td className="whitespace-nowrap px-4 py-3 font-medium">
                                {row.salaryMonth}
                              </td>
                              <td className="px-4 py-3 font-medium">{row.staffName}</td>
                              <td className="px-4 py-3">
                                <span
                                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${row.status === 'paid' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300' : row.status === 'partial' ? 'bg-amber-100 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-200'}`}
                                >
                                  {row.status}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                {renderMoney(row.netAmountInput, row.currency, row.netAmount)}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  aria-label={`Delete salary payment for ${row.staffName}`}
                                  className="rounded-xl text-muted-foreground hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-400/10"
                                  onClick={() => removeRow(row.id)}
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                          {(report?.rows.data ?? []).length === 0 && (
                            <tr>
                              <td colSpan={6} className="px-4 py-12 text-center">
                                <div className="mx-auto flex max-w-sm flex-col items-center gap-2">
                                  <span className="flex size-11 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                                    <ReceiptText className="size-5" />
                                  </span>
                                  <p className="font-semibold">No salary payments found</p>
                                  <p className="text-sm text-muted-foreground">
                                    Try changing the date range or search, or record a new payment
                                    above.
                                  </p>
                                </div>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                      <span>{report?.rows.meta.total ?? 0} rows</span>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          disabled={(report?.rows.meta.currentPage ?? 1) <= 1}
                          onClick={() => void fetchData((report?.rows.meta.currentPage ?? 1) - 1)}
                        >
                          Previous
                        </Button>
                        <span>
                          Page {report?.rows.meta.currentPage ?? 1} of{' '}
                          {report?.rows.meta.lastPage ?? 1}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={
                            (report?.rows.meta.currentPage ?? 1) >=
                            (report?.rows.meta.lastPage ?? 1)
                          }
                          onClick={() => void fetchData((report?.rows.meta.currentPage ?? 1) + 1)}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
};

export default SalariesPage;
