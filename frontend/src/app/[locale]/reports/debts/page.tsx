'use client';

import { FormEvent, JSX, useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Header } from '@/components/header';
import { LoadingState } from '@/components/shared/loading-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { formatCurrency, type CurrencyCode } from '@/lib/currency-utils';
import { AxiosClient } from '@/modules/common/infrastructure/api/axios-client';
import { getIntlLocale } from '@/modules/common/utils/locale';
import {
  createDefaultReportRange,
  fetchReport,
  toInputDate,
} from '@/modules/dental-management/presentation/reports/report-client';
import { ReportPageIntro } from '@/modules/dental-management/presentation/reports/report-page-intro';
import { Check, CircleDollarSign, FileText, Search, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { useDebounce } from 'use-debounce';

type DebtRow = {
  agingBucket: string;
  debtAmount: number;
  debtAmountInput: number;
  currency: CurrencyCode;
  exchangeRate: number;
  id: number;
  invoiceDate: string;
  invoiceId: string;
  netAmount: number;
  netAmountInput: number;
  paidAmount: number;
  paidAmountInput: number;
  patientDebtAmount?: number;
  patientId: string;
  patientName: string;
  status: string;
};

type DebtCurrencySections = Record<
  CurrencyCode,
  {
    totalDebt: number;
    totalNet: number;
    totalPaid: number;
  }
>;

type DebtReportResponse = {
  aging: Array<{ amount: number; bucket: string; count: number }>;
  rows: {
    data: DebtRow[];
    meta: {
      currentPage: number;
      lastPage: number;
      perPage: number;
      total: number;
    };
  };
  summary: {
    currencySections: DebtCurrencySections;
    debtCount: number;
    totalDebt: number;
    totalNet: number;
    totalPaid: number;
  };
};

type SettleFormState = {
  amount: string;
  method: 'cash' | 'card' | 'insurance';
  notes: string;
  paymentDate: string;
};

const client = new AxiosClient();

const extractApiErrorMessage = (
  error: unknown,
  fallback: string,
  remainingTemplate: (remaining: string) => string
): string => {
  const payload = (
    error as {
      response?: { data?: { error?: { details?: Record<string, unknown>; message?: string } } };
    }
  )?.response?.data?.error;

  if (!payload) return fallback;
  const currency = String(payload.details?.currency ?? 'AFN') === 'USD' ? 'USD' : 'AFN';
  const amountLimit =
    payload.details?.outstandingAmountInput ??
    payload.details?.outstandingBalance ??
    payload.details?.outstandingAmount;
  if (typeof amountLimit === 'number') {
    return remainingTemplate(formatCurrency(amountLimit, currency));
  }
  return payload.message || fallback;
};

const createDefaultForm = (): SettleFormState => ({
  amount: '',
  method: 'cash',
  notes: '',
  paymentDate: toInputDate(new Date()),
});

const emptyCurrencySections = (): DebtCurrencySections => ({
  AFN: {
    totalDebt: 0,
    totalNet: 0,
    totalPaid: 0,
  },
  USD: {
    totalDebt: 0,
    totalNet: 0,
    totalPaid: 0,
  },
});

const getSettledNote = (baseNote: string, row: DebtRow): string => {
  const prefix = `Debt settled for invoice #${row.invoiceId}`;
  const note = baseNote.trim();
  return note ? `${prefix} - ${note}` : prefix;
};

const DebtsPage = (): JSX.Element => {
  const locale = useLocale();
  const tDebts = useTranslations('app.debtsPage');
  const tSidebar = useTranslations('sidebar');
  const tReports = useTranslations('sidebar.reports');
  const range = createDefaultReportRange(90);
  const [report, setReport] = useState<DebtReportResponse | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState<SettleFormState>(() => createDefaultForm());
  const [startDate, setStartDate] = useState(range.startDate);
  const [endDate, setEndDate] = useState(range.endDate);
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebounce(search, 350);
  const [invoiceId, setInvoiceId] = useState('');
  const [agingBucket, setAgingBucket] = useState('all');
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const totalDebts = report?.summary.debtCount ?? 0;
  const currencySections = report?.summary.currencySections ?? emptyCurrencySections();

  const activePage = report?.rows.meta.currentPage ?? page;
  const lastPage = report?.rows.meta.lastPage ?? 1;

  const refreshDebts = useCallback(
    async (pageNumber = 1): Promise<void> => {
      setIsLoading(true);
      try {
        const data = await fetchReport<DebtReportResponse>(
          '/api/v1/dental-management/reports/debts',
          {
            debtAgingBucket: agingBucket,
            endDate,
            invoiceId,
            page: pageNumber,
            perPage: 12,
            search: debouncedSearch,
            sortBy: 'invoiceDate',
            sortDirection: 'desc',
            startDate,
          }
        );
        setReport(data);
        setPage(pageNumber);
      } finally {
        setIsLoading(false);
      }
    },
    [agingBucket, debouncedSearch, endDate, invoiceId, startDate]
  );

  useEffect(() => {
    void refreshDebts(1);
  }, [refreshDebts]);

  useEffect(() => {
    if (selectedId !== null && report && !report.rows.data.some((row) => row.id === selectedId)) {
      setSelectedId(null);
      setForm((previous) => ({ ...previous, amount: '' }));
    }
  }, [report, selectedId]);

  const selectedDebt = report?.rows.data.find((row) => row.id === selectedId) ?? null;
  const patientGroups = useMemo(() => {
    const groups = new Map<string, { patientName: string; invoices: DebtRow[] }>();
    for (const row of report?.rows.data ?? []) {
      const group = groups.get(row.patientId) ?? { invoices: [], patientName: row.patientName };
      group.invoices.push(row);
      groups.set(row.patientId, group);
    }
    return Array.from(groups.entries()).map(([patientId, group]) => ({ patientId, ...group }));
  }, [report?.rows.data]);
  const enteredAmount = Number.parseFloat(form.amount);
  const normalizedEnteredAmount = Number.isFinite(enteredAmount) ? Math.max(0, enteredAmount) : 0;
  const selectedDebtAmount = selectedDebt?.debtAmountInput ?? 0;
  const selectedDebtCurrency = selectedDebt?.currency ?? 'AFN';
  const remainingAfterPayment = selectedDebt
    ? Math.max(0, Number((selectedDebtAmount - normalizedEnteredAmount).toFixed(2)))
    : 0;

  const renderMoney = (amountInput: number, currency: CurrencyCode): JSX.Element => (
    <div>{formatCurrency(amountInput, currency)}</div>
  );

  const selectDebt = (row: DebtRow): void => {
    setSelectedId(row.id);
    setForm((previous) => ({ ...previous, amount: '' }));
  };

  const resetFilters = (): void => {
    setStartDate(range.startDate);
    setEndDate(range.endDate);
    setSearch('');
    setInvoiceId('');
    setAgingBucket('all');
  };

  const handleSettleSelected = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!selectedDebt) {
      toast.error('Choose an invoice before recording a payment.');
      return;
    }

    const parsedAmount = Number.parseFloat(form.amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error('Enter a valid amount to pay.');
      return;
    }

    if (parsedAmount - selectedDebt.debtAmountInput > 0.01) {
      toast.error(
        `Amount cannot be greater than remaining debt ${formatCurrency(selectedDebt.debtAmountInput, selectedDebt.currency)}.`
      );
      return;
    }

    setIsSubmitting(true);

    void client
      .post(`/api/v1/dental-management/debts/${selectedDebt.id}/settle`, {
        amount: parsedAmount,
        method: form.method,
        notes: getSettledNote(form.notes, selectedDebt),
        paymentDate: form.paymentDate,
      })
      .then(async () => {
        toast.success(tDebts('savedSuccess', { count: 1 }));
        setForm((previous) => ({ ...previous, amount: '' }));
        await refreshDebts(1);
      })
      .catch((error: unknown) => {
        toast.error(
          extractApiErrorMessage(error, 'Payment could not be recorded.', (remaining) =>
            tDebts('remainingError', { remaining })
          )
        );
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  return (
    <>
      <Header
        breadcrumbs={[
          { id: 'reports', label: tSidebar('reports.title') },
          { id: 'debts', isCurrent: true, label: tReports('debts') },
        ]}
      />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex min-w-0 flex-col gap-5 px-4 py-4 md:gap-6 md:px-6 md:py-6">
            <ReportPageIntro
              title="Outstanding debts"
              description="Find unpaid invoices, follow up on older balances, and record a payment against one invoice."
            />

            <section aria-label="Debt summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Card className="min-h-32 min-w-0 border-rose-200/70 bg-gradient-to-br from-rose-50 to-card dark:border-rose-500/20 dark:from-rose-500/10">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-muted-foreground">Total still owed</p>
                      <p className="mt-2 break-words text-2xl font-semibold text-rose-700 dark:text-rose-200">
                        {formatCurrency(report?.summary.totalDebt ?? 0, 'AFN')}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">Combined value in AFN</p>
                    </div>
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200">
                      <CircleDollarSign className="size-5" aria-hidden="true" />
                    </span>
                  </div>
                </CardContent>
              </Card>
              <Card className="min-h-32 min-w-0">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Invoices to follow up</p>
                      <p className="mt-2 text-2xl font-semibold">
                        {totalDebts.toLocaleString(getIntlLocale(locale))}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">Unpaid or partly paid</p>
                    </div>
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <FileText className="size-5" aria-hidden="true" />
                    </span>
                  </div>
                </CardContent>
              </Card>
              {(['AFN', 'USD'] as CurrencyCode[]).map((currency) => (
                <Card className="min-h-32 min-w-0" key={currency}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm text-muted-foreground">Outstanding in {currency}</p>
                        <p className="mt-2 break-words text-2xl font-semibold">
                          {formatCurrency(currencySections[currency].totalDebt, currency)}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">Invoice currency</p>
                      </div>
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                        <span className="text-[10px] font-bold tracking-tight">{currency}</span>
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </section>

            <details className="group rounded-2xl border bg-card px-4 py-3">
              <summary className="cursor-pointer list-none text-sm font-medium marker:hidden">
                <span className="flex items-center justify-between gap-3">
                  <span>View paid and invoice totals by currency</span>
                  <span className="text-xs text-muted-foreground group-open:hidden">
                    Show details
                  </span>
                  <span className="hidden text-xs text-muted-foreground group-open:inline">
                    Hide details
                  </span>
                </span>
              </summary>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {(['AFN', 'USD'] as CurrencyCode[]).map((currency) => (
                  <div className="rounded-xl border bg-muted/20 p-4" key={currency}>
                    <h2 className="text-sm font-semibold">{currency} invoices</h2>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Invoice total</p>
                        <p className="mt-1 font-medium">
                          {formatCurrency(currencySections[currency].totalNet, currency)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Already paid</p>
                        <p className="mt-1 font-medium">
                          {formatCurrency(currencySections[currency].totalPaid, currency)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </details>

            <Card className="min-w-0 rounded-3xl border-border/60">
              <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle>Find an invoice</CardTitle>
                    <CardDescription className="mt-1">
                      Search by patient or invoice number. Results update as you change filters.
                    </CardDescription>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={resetFilters}>
                    Reset filters
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
                <label className="grid gap-1.5 text-sm font-medium" htmlFor="debt-search">
                  <span>Search invoices</span>
                  <span className="relative">
                    <Search
                      className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <Input
                      id="debt-search"
                      aria-label="Search patients or invoices"
                      className="pl-9"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Patient name or invoice number"
                    />
                  </span>
                </label>
                <label className="grid gap-1.5 text-sm font-medium">
                  <span>Time unpaid</span>
                  <select
                    className="h-10 rounded-md border bg-background px-3 text-sm font-normal"
                    value={agingBucket}
                    onChange={(event) => setAgingBucket(event.target.value)}
                  >
                    <option value="all">Any age</option>
                    <option value="0-30 days">0-30 days</option>
                    <option value="31-60 days">31-60 days</option>
                    <option value="61-90 days">61-90 days</option>
                    <option value="90+ days">Over 90 days</option>
                  </select>
                </label>
                <details className="rounded-xl border bg-muted/10 p-3 md:col-span-2">
                  <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium">
                    Date range and invoice number
                  </summary>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <label className="grid gap-1.5 text-xs text-muted-foreground">
                      From
                      <Input
                        aria-label="From date"
                        type="date"
                        value={startDate}
                        onChange={(event) => setStartDate(event.target.value)}
                      />
                    </label>
                    <label className="grid gap-1.5 text-xs text-muted-foreground">
                      To
                      <Input
                        aria-label="To date"
                        type="date"
                        value={endDate}
                        onChange={(event) => setEndDate(event.target.value)}
                      />
                    </label>
                    <label className="grid gap-1.5 text-xs text-muted-foreground">
                      Invoice number
                      <Input
                        aria-label="Invoice number"
                        value={invoiceId}
                        onChange={(event) => setInvoiceId(event.target.value)}
                        placeholder="Enter invoice number"
                      />
                    </label>
                  </div>
                </details>
                <p className="text-xs text-muted-foreground md:col-span-2">
                  Filters update automatically. Search refreshes after you pause typing.
                </p>
              </CardContent>
            </Card>

            <section
              className="rounded-3xl border bg-card p-4 sm:p-5"
              aria-labelledby="aging-summary-title"
            >
              <div className="mb-3">
                <h2 id="aging-summary-title" className="font-semibold">
                  How long balances have been unpaid
                </h2>
                <p className="text-sm text-muted-foreground">
                  See the age and value of open balances for your current filters.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                <div className="rounded-xl border bg-background p-3">
                  <p className="text-xs text-muted-foreground">Matching invoices</p>
                  <p className="mt-1 font-semibold">
                    {totalDebts.toLocaleString(getIntlLocale(locale))} invoices
                  </p>
                  <p className="mt-1 text-sm font-medium">
                    {formatCurrency(report?.summary.totalDebt ?? 0, 'AFN')}
                  </p>
                </div>
                {(report?.aging ?? []).map((row) => (
                  <div key={row.bucket} className="rounded-xl border bg-background p-3">
                    <p className="text-xs text-muted-foreground">{row.bucket}</p>
                    <p className="mt-1 font-semibold">
                      {row.count.toLocaleString(getIntlLocale(locale))} invoices
                    </p>
                    <p className="mt-1 text-sm font-medium">{formatCurrency(row.amount, 'AFN')}</p>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Amounts are combined and shown in AFN equivalent.
              </p>
            </section>

            <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,0.8fr)]">
              <Card className="min-w-0 rounded-3xl border-border/60">
                <CardHeader className="flex flex-col gap-1">
                  <CardTitle>Invoices to follow up</CardTitle>
                  <CardDescription>Select one invoice to see its payment form.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isLoading && report === null ? (
                    <LoadingState
                      compact
                      title="Loading invoices"
                      description="Getting outstanding balances."
                    />
                  ) : patientGroups.length === 0 ? (
                    <div className="rounded-2xl border border-dashed p-8 text-center">
                      <p className="font-medium">No outstanding invoices found</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Try a different date range or clear the filters.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        className="mt-4"
                        onClick={resetFilters}
                      >
                        Clear filters
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {patientGroups.map((patient) => (
                        <section
                          key={patient.patientId}
                          className="overflow-hidden rounded-2xl border bg-background"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/20 px-4 py-3">
                            <div className="font-medium">{patient.patientName}</div>
                            <span className="text-xs text-muted-foreground">
                              {patient.invoices.length}{' '}
                              {patient.invoices.length === 1 ? 'invoice' : 'invoices'}
                            </span>
                          </div>
                          <div className="divide-y">
                            {patient.invoices.map((row) => {
                              const isSelected = selectedId === row.id;
                              return (
                                <button
                                  type="button"
                                  key={row.id}
                                  disabled={isLoading}
                                  aria-pressed={isSelected}
                                  onClick={() => selectDebt(row)}
                                  className={`grid w-full gap-3 p-4 text-left transition sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center ${isSelected ? 'bg-primary/5 ring-2 ring-inset ring-primary/40' : 'hover:bg-accent/30'}`}
                                >
                                  <span className="flex min-w-0 items-start gap-3">
                                    <span
                                      className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border ${isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40 text-transparent'}`}
                                      aria-hidden="true"
                                    >
                                      {isSelected ? (
                                        <Check className="size-3" strokeWidth={3} />
                                      ) : null}
                                    </span>
                                    <span className="min-w-0">
                                      <span className="flex flex-wrap items-center gap-2 font-semibold">
                                        Invoice #{row.invoiceId}
                                        <span
                                          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${row.agingBucket === '0-30 days' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-100' : row.agingBucket === '31-60 days' ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-100' : row.agingBucket === '61-90 days' ? 'bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-100' : 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-100'}`}
                                        >
                                          {row.agingBucket}
                                        </span>
                                      </span>
                                      <span className="mt-1 block text-sm text-muted-foreground">
                                        {new Intl.DateTimeFormat(getIntlLocale(locale), {
                                          dateStyle: 'medium',
                                        }).format(new Date(row.invoiceDate))}
                                      </span>
                                    </span>
                                  </span>
                                  <span className="grid grid-cols-2 gap-4 pl-8 sm:min-w-[220px] sm:pl-0">
                                    <span>
                                      <span className="block text-xs text-muted-foreground">
                                        Paid
                                      </span>
                                      <span className="mt-1 block text-sm font-medium">
                                        {renderMoney(row.paidAmountInput, row.currency)}
                                      </span>
                                    </span>
                                    <span>
                                      <span className="block text-xs text-muted-foreground">
                                        Still owed
                                      </span>
                                      <span className="mt-1 block text-sm font-semibold text-rose-700 dark:text-rose-200">
                                        {renderMoney(row.debtAmountInput, row.currency)}
                                      </span>
                                    </span>
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </section>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-sm text-muted-foreground">
                    <span>{report?.rows.meta.total ?? 0} open invoices</span>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isLoading || activePage <= 1}
                        onClick={() => void refreshDebts(activePage - 1)}
                      >
                        Previous
                      </Button>
                      <span>
                        Page {activePage} of {lastPage}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isLoading || activePage >= lastPage}
                        onClick={() => void refreshDebts(activePage + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="min-w-0 self-start rounded-3xl border-border/60 xl:sticky xl:top-4">
                <CardHeader className="flex flex-row items-start gap-3">
                  <div className="flex items-start gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Wallet className="size-5" aria-hidden="true" />
                    </span>
                    <div className="space-y-1">
                      <CardTitle>Record a payment</CardTitle>
                      <CardDescription>Payments use the invoice currency.</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {selectedDebt ? (
                    <form onSubmit={handleSettleSelected} className="grid gap-4">
                      <div className="rounded-2xl border bg-muted/20 p-4">
                        <p className="text-xs text-muted-foreground">Selected invoice</p>
                        <p className="mt-1 font-semibold">
                          #{selectedDebt.invoiceId} | {selectedDebt.patientName}
                        </p>
                        <div className="mt-3 grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-xs text-muted-foreground">Still owed</p>
                            <p className="mt-1 font-semibold text-rose-700 dark:text-rose-200">
                              {formatCurrency(selectedDebtAmount, selectedDebtCurrency)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">After payment</p>
                            <p className="mt-1 font-semibold">
                              {formatCurrency(remainingAfterPayment, selectedDebtCurrency)}
                            </p>
                          </div>
                        </div>
                      </div>
                      <label className="grid gap-1.5 text-sm font-medium" htmlFor="debt-amount">
                        Amount received ({selectedDebt.currency})
                        <Input
                          id="debt-amount"
                          type="number"
                          min="0.01"
                          max={selectedDebt.debtAmountInput}
                          step="0.01"
                          value={form.amount}
                          onChange={(event) =>
                            setForm((previous) => ({ ...previous, amount: event.target.value }))
                          }
                          placeholder={`Up to ${selectedDebt.debtAmountInput}`}
                          required
                        />
                      </label>
                      <label className="grid gap-1.5 text-sm font-medium" htmlFor="debt-date">
                        {tDebts('paymentDate')}
                        <Input
                          id="debt-date"
                          type="date"
                          value={form.paymentDate}
                          onChange={(event) =>
                            setForm((previous) => ({
                              ...previous,
                              paymentDate: event.target.value,
                            }))
                          }
                          required
                        />
                      </label>
                      <label className="grid gap-1.5 text-sm font-medium" htmlFor="debt-method">
                        {tDebts('paymentMethod')}
                        <select
                          id="debt-method"
                          className="h-10 rounded-md border bg-background px-3 text-sm font-normal"
                          value={form.method}
                          onChange={(event) =>
                            setForm((previous) => ({
                              ...previous,
                              method: event.target.value as SettleFormState['method'],
                            }))
                          }
                        >
                          <option value="cash">{tDebts('methods.cash')}</option>
                          <option value="card">{tDebts('methods.card')}</option>
                          <option value="insurance">{tDebts('methods.insurance')}</option>
                        </select>
                      </label>
                      <label className="grid gap-1.5 text-sm font-medium" htmlFor="debt-notes">
                        {tDebts('notes')}{' '}
                        <span className="font-normal text-muted-foreground">(optional)</span>
                        <Input
                          id="debt-notes"
                          value={form.notes}
                          onChange={(event) =>
                            setForm((previous) => ({ ...previous, notes: event.target.value }))
                          }
                          placeholder={tDebts('notesPlaceholder')}
                        />
                      </label>
                      <Button type="submit" className="w-full" disabled={isSubmitting || isLoading}>
                        {isSubmitting ? tDebts('saving') : 'Record payment'}
                      </Button>
                    </form>
                  ) : (
                    <div className="rounded-2xl border border-dashed p-6 text-center">
                      <p className="font-medium">Choose an invoice first</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Select an invoice from the list to see its balance and record a payment.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default DebtsPage;
