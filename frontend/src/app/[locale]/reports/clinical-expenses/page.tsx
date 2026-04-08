'use client';

import { FormEvent, JSX, useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Header } from '@/components/header';
import { LoadingState } from '@/components/shared/loading-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DEFAULT_AFN_PER_USD, type CurrencyCode, formatCurrency, getExchangeRate, parseMoney } from '@/lib/currency-utils';
import { AxiosClient } from '@/modules/common/infrastructure/api/axios-client';
import { createDefaultReportRange, fetchReport, toInputDate } from '@/modules/dental-management/presentation/reports/report-client';
import { ShoppingBag, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

type ClinicalExpenseRecord = {
  amount: number;
  amountInput: number;
  category: string;
  createdAt: string;
  currency: CurrencyCode;
  expenseDate: string;
  exchangeRate: number;
  id: number;
  itemName: string;
  notes: string;
  quantity: number;
  staffName: string;
  unitCost: number;
  unitCostInput: number;
  vendor: string;
};

type ClinicalExpenseCurrencySections = Record<CurrencyCode, {
  totalSpend: number;
}>;

type ClinicalExpenseReportResponse = {
  breakdown: Array<{ amount: number; category: string }>;
  history: {
    data: ClinicalExpenseRecord[];
    meta: {
      currentPage: number;
      lastPage: number;
      perPage: number;
      total: number;
    };
  };
  summary: {
    currencySections: ClinicalExpenseCurrencySections;
    recordCount: number;
    totalSpend: number;
  };
};

type ClinicalExpenseForm = {
  category: string;
  currency: CurrencyCode;
  date: string;
  exchangeRate: string;
  itemName: string;
  notes: string;
  quantity: string;
  unitCost: string;
  vendor: string;
};

const categoryOptions = [
  'all',
  'Dental Accessories',
  'Implants',
  'Chair & Unit',
  'Sterilization',
  'Imaging',
  'Consumables',
  'Other',
];
const categoryColors = ['#0ea5e9', '#14b8a6', '#22c55e', '#f97316', '#f59e0b', '#6366f1', '#a855f7'];

const createDefaultForm = (): ClinicalExpenseForm => ({
  category: 'Dental Accessories',
  currency: 'AFN',
  date: toInputDate(new Date()),
  exchangeRate: '1',
  itemName: '',
  notes: '',
  quantity: '1',
  unitCost: '',
  vendor: '',
});

const emptyCurrencySections = (): ClinicalExpenseCurrencySections => ({
  AFN: {
    totalSpend: 0,
  },
  USD: {
    totalSpend: 0,
  },
});

const extractApiErrorMessage = (error: unknown, fallback: string): string => {
  const response = (error as { response?: { data?: { error?: { code?: string; details?: Record<string, unknown>; message?: string } } } })?.response;
  const payload = response?.data?.error;
  const code = payload?.code;

  if (code === 'SAFE_BALANCE_INSUFFICIENT') {
    const currency = String(payload?.details?.currency ?? 'AFN') === 'USD' ? 'USD' : 'AFN';
    const currentBalance = Number(payload?.details?.currentBalance ?? 0);
    const requestedAmount = Number(payload?.details?.requestedAmount ?? 0);
    return `Safe balance is not enough. Current: ${formatCurrency(currentBalance, currency)}. Requested: ${formatCurrency(requestedAmount, currency)}.`;
  }

  return payload?.message || fallback;
};

const client = new AxiosClient();

const ClinicalExpensesPage = (): JSX.Element => {
  const tReports = useTranslations('sidebar.reports');
  const tSidebar = useTranslations('sidebar');
  const range = createDefaultReportRange(90);
  const [form, setForm] = useState<ClinicalExpenseForm>(() => createDefaultForm());
  const [report, setReport] = useState<ClinicalExpenseReportResponse | null>(null);
  const [defaultExchangeRate, setDefaultExchangeRate] = useState(DEFAULT_AFN_PER_USD);
  const [startDate, setStartDate] = useState(range.startDate);
  const [endDate, setEndDate] = useState(range.endDate);
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchExpenses = useCallback(async (pageNumber = page): Promise<void> => {
    setIsLoading(true);
    try {
      const data = await fetchReport<ClinicalExpenseReportResponse>('/api/v1/dental-management/reports/clinical-expenses', {
        category,
        endDate,
        page: pageNumber,
        perPage: 10,
        search,
        sortBy: 'expenseDate',
        sortDirection: 'desc',
        startDate,
      });
      setReport(data);
      setPage(pageNumber);
    } finally {
      setIsLoading(false);
    }
  }, [category, endDate, page, search, startDate]);

  useEffect(() => {
    void fetchExpenses(1);
  }, [fetchExpenses]);

  useEffect(() => {
    void getExchangeRate(client)
      .then((rate) => setDefaultExchangeRate(rate))
      .catch(() => {
        setDefaultExchangeRate(DEFAULT_AFN_PER_USD);
      });
  }, []);

  const totalCost = Math.max(0, parseMoney(form.quantity)) * Math.max(0, parseMoney(form.unitCost));
  const resolvedExchangeRate = form.currency === 'USD'
    ? Math.max(parseMoney(form.exchangeRate) || defaultExchangeRate, DEFAULT_AFN_PER_USD)
    : 1;
  const currencySections = report?.summary.currencySections ?? emptyCurrencySections();

  const renderMoney = (amountInput: number, currency: CurrencyCode, amountAfn: number): JSX.Element => (
    <div>{formatCurrency(amountInput, currency)}</div>
  );

  const handleCreate = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    const quantity = Math.max(0, parseMoney(form.quantity));
    const unitCost = Math.max(0, parseMoney(form.unitCost));
    const totalCost = quantity * unitCost;

    if (!form.itemName.trim() || !form.date || quantity <= 0 || unitCost <= 0 || resolvedExchangeRate <= 0) {
      return;
    }

    setIsSubmitting(true);
    void client
      .post('/api/v1/dental-management/expenses', {
        amount: totalCost,
        category: form.category,
        currency: form.currency,
        exchangeRate: resolvedExchangeRate,
        expenseDate: form.date,
        expenseType: 'clinical',
        notes: form.notes.trim() || undefined,
        paymentMethod: 'bank_transfer',
        quantity,
        title: form.itemName.trim(),
        unitCost,
        vendor: form.vendor.trim() || undefined,
      })
      .then(async () => {
        setForm(createDefaultForm());
        await fetchExpenses(1);
        toast.success('Clinical expense saved.');
      })
      .catch((error: unknown) => {
        toast.error(extractApiErrorMessage(error, 'Failed to save clinical expense.'));
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  const removeRecord = (id: number): void => {
    void client
      .delete(`/api/v1/dental-management/expenses/${id}`)
      .then(async () => {
        await fetchExpenses(page);
        toast.success('Clinical expense deleted.');
      })
      .catch((error: unknown) => {
        toast.error(extractApiErrorMessage(error, 'Failed to delete clinical expense.'));
      });
  };

  return (
    <>
      <Header
        breadcrumbs={[
          { id: 'reports', label: tSidebar('reports.title') },
          { id: 'clinicalExpenses', isCurrent: true, label: tReports('clinicalExpenses') },
        ]}
      />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:px-6 md:py-6">
            <Card className="overflow-hidden rounded-3xl border border-cyan-200 bg-gradient-to-br from-cyan-50 via-background to-blue-50">
              <CardHeader>
                <CardTitle className="inline-flex items-center gap-2">
                  <ShoppingBag className="size-5 text-cyan-700" />
                  Clinical Buys Expenses
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
                <form onSubmit={handleCreate} className="grid gap-3 rounded-2xl border bg-background/85 p-4">
                  <div className="grid gap-1.5">
                    <Label htmlFor="item-name">Item Name</Label>
                    <Input id="item-name" value={form.itemName} onChange={(event) => setForm((prev) => ({ ...prev, itemName: event.target.value }))} placeholder="Implant screw set" required />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-1.5">
                      <Label htmlFor="buy-date">Date</Label>
                      <Input id="buy-date" type="date" value={form.date} onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))} required />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="buy-category">Category</Label>
                      <select id="buy-category" className="h-9 rounded-md border bg-background px-3 text-sm" value={form.category} onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}>
                        {categoryOptions.filter((option) => option !== 'all').map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-1.5">
                      <Label htmlFor="buy-quantity">Quantity</Label>
                      <Input id="buy-quantity" type="number" min="1" step="1" value={form.quantity} onChange={(event) => setForm((prev) => ({ ...prev, quantity: event.target.value }))} required />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="buy-unit-cost">Unit Cost</Label>
                      <Input id="buy-unit-cost" type="number" min="0" step="0.01" value={form.unitCost} onChange={(event) => setForm((prev) => ({ ...prev, unitCost: event.target.value }))} required />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-1.5">
                      <Label htmlFor="buy-currency">Currency</Label>
                      <select
                        id="buy-currency"
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
                      <Label htmlFor="buy-rate">Exchange Rate</Label>
                      <Input
                        id="buy-rate"
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
                  <div className="rounded-xl border border-dashed bg-slate-50/80 p-3 text-xs text-muted-foreground">
                    This buy is tracked only inside the selected currency section.
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="buy-vendor">Vendor</Label>
                    <Input id="buy-vendor" value={form.vendor} onChange={(event) => setForm((prev) => ({ ...prev, vendor: event.target.value }))} placeholder="Supplier or store" />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="buy-notes">Notes</Label>
                    <Input id="buy-notes" value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} placeholder="Optional details" />
                  </div>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Saving...' : 'Save Clinical Expense'}
                  </Button>
                </form>

                <div className="grid gap-3">
                  <div className="grid gap-3 xl:grid-cols-2">
                    {(['AFN', 'USD'] as CurrencyCode[]).map((currency) => (
                      <div key={currency} className="rounded-2xl border bg-background/80 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">{currency} Spend</p>
                        <p className="mt-3 text-2xl font-semibold">{formatCurrency(currencySections[currency].totalSpend, currency)}</p>
                        <p className="mt-1 text-xs text-muted-foreground">Original saved currency totals in the selected range.</p>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-2xl border bg-background/80 p-4">
                    <p className="text-xs text-muted-foreground">Records</p>
                    <p className="mt-2 text-2xl font-semibold">{report?.summary.recordCount ?? 0}</p>
                  </div>

                  <div className="grid gap-3 rounded-2xl border bg-background/80 p-4 md:grid-cols-4">
                    <div className="grid gap-1.5">
                      <Label>Start Date</Label>
                      <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>End Date</Label>
                      <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Category</Label>
                      <select className="h-9 rounded-md border bg-background px-3 text-sm" value={category} onChange={(event) => setCategory(event.target.value)}>
                        {categoryOptions.map((option) => (
                          <option key={option} value={option}>{option === 'all' ? 'All categories' : option}</option>
                        ))}
                      </select>
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Search</Label>
                      <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Item, note, vendor..." />
                    </div>
                    <div className="md:col-span-4">
                      <Button type="button" onClick={() => void fetchExpenses(1)}>Apply Filters</Button>
                    </div>
                  </div>

                  <div className="h-72 rounded-2xl border bg-background/80 p-3">
                    {isLoading ? (
                      <LoadingState compact title="Refreshing report" description="Fetching clinical expense breakdown." />
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={report?.breakdown ?? []} dataKey="amount" nameKey="category" outerRadius={95}>
                            {(report?.breakdown ?? []).map((entry, index) => (
                              <Cell key={`${entry.category}-${index}`} fill={categoryColors[index % categoryColors.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => formatCurrency(Number(value), 'AFN')} />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border">
              <CardHeader>
                <CardTitle>Clinical Expense History</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading && report === null ? (
                  <LoadingState compact title="Loading history" description="Fetching clinical expense rows." />
                ) : (
                  <div className="space-y-4">
                    <div className="overflow-x-auto rounded-2xl border">
                      <table className="min-w-full text-sm">
                        <thead className="bg-muted/30 text-left text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2">Date</th>
                            <th className="px-3 py-2">Item</th>
                            <th className="px-3 py-2">Category</th>
                            <th className="px-3 py-2">Quantity</th>
                            <th className="px-3 py-2">Unit Cost</th>
                            <th className="px-3 py-2">Vendor</th>
                            <th className="px-3 py-2">Amount</th>
                            <th className="px-3 py-2">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(report?.history.data ?? []).map((record) => (
                            <tr key={record.id} className="border-t">
                              <td className="px-3 py-2">{record.expenseDate}</td>
                              <td className="px-3 py-2 font-medium">{record.itemName}</td>
                              <td className="px-3 py-2">{record.category}</td>
                              <td className="px-3 py-2">{record.quantity}</td>
                              <td className="px-3 py-2">{renderMoney(record.unitCostInput, record.currency, record.unitCost)}</td>
                              <td className="px-3 py-2">{record.vendor || '-'}</td>
                              <td className="px-3 py-2">{renderMoney(record.amountInput, record.currency, record.amount)}</td>
                              <td className="px-3 py-2">
                                <Button type="button" variant="ghost" size="icon" onClick={() => removeRecord(record.id)}>
                                  <Trash2 className="size-4" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>{report?.history.meta.total ?? 0} records</span>
                      <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" disabled={(report?.history.meta.currentPage ?? 1) <= 1} onClick={() => void fetchExpenses((report?.history.meta.currentPage ?? 1) - 1)}>
                          Previous
                        </Button>
                        <span>
                          Page {report?.history.meta.currentPage ?? 1} of {report?.history.meta.lastPage ?? 1}
                        </span>
                        <Button type="button" variant="outline" disabled={(report?.history.meta.currentPage ?? 1) >= (report?.history.meta.lastPage ?? 1)} onClick={() => void fetchExpenses((report?.history.meta.currentPage ?? 1) + 1)}>
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

export default ClinicalExpensesPage;
