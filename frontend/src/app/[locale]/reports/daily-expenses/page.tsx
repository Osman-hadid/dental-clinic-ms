'use client';

import { FormEvent, JSX, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Header } from '@/components/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AxiosClient } from '@/modules/common/infrastructure/api/axios-client';
import {
  DEFAULT_AFN_PER_USD,
  formatCurrency,
  formatDualFromUsd,
  getExchangeRate,
  parseMoney,
} from '@/lib/currency-utils';
import { Trash2, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

type DailyExpenseRecord = {
  amount: number;
  amountInput: number;
  category: string;
  createdAt?: string;
  currency: 'AFN' | 'USD';
  date: string;
  exchangeRate: number;
  expenseType?: string;
  id: string;
  method: string;
  notes: string;
  title: string;
};

type PaginatedRowsResponse = {
  data?: Array<Record<string, unknown>>;
  meta?: {
    currentPage?: number;
    lastPage?: number;
  };
};

type DailyFormState = {
  amount: string;
  category: string;
  currency: 'AFN' | 'USD';
  date: string;
  exchangeRate: string;
  method: string;
  notes: string;
  title: string;
};

const categoryOptions = ['Utilities', 'Salaries', 'Rent', 'Supplies', 'Maintenance', 'Other'];
const methodOptions = ['cash', 'card', 'bank_transfer', 'other'];

const toInputDate = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseAmount = (value: string): number => parseMoney(value);

const extractApiErrorMessage = (error: unknown, fallback: string): string => {
  const response = (error as { response?: { data?: { error?: { code?: string; details?: Record<string, unknown>; message?: string } } } })?.response;
  const payload = response?.data?.error;
  const code = payload?.code;

  if (code === 'SAFE_BALANCE_INSUFFICIENT') {
    const currentBalance = Number(payload?.details?.currentBalance ?? 0);
    const requestedAmount = Number(payload?.details?.requestedAmount ?? 0);
    return `Safe balance is not enough. Current: ${formatCurrency(currentBalance, 'USD')}. Requested: ${formatCurrency(requestedAmount, 'USD')}.`;
  }

  return payload?.message || fallback;
};

const createDefaultForm = (afnPerUsd: number): DailyFormState => ({
  amount: '',
  category: 'Utilities',
  currency: 'USD',
  date: toInputDate(new Date()),
  exchangeRate: String(afnPerUsd),
  method: 'cash',
  notes: '',
  title: '',
});

const client = new AxiosClient();
const API_MAX_PER_PAGE = 100;
const parseNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const normalizeExpenseRow = (row: Record<string, unknown>): DailyExpenseRecord => ({
  amount: parseNumber(row.amount),
  amountInput: parseNumber(row.amountInput ?? row.amount_input ?? row.amount),
  category: String(row.category ?? 'Other'),
  createdAt: typeof row.createdAt === 'string' ? row.createdAt : undefined,
  currency: (String(row.currency ?? 'USD').toUpperCase() as 'AFN' | 'USD'),
  date: String(row.expenseDate ?? row.date ?? ''),
  exchangeRate: parseNumber(row.exchangeRate ?? row.exchange_rate ?? 1),
  expenseType: typeof row.expenseType === 'string' ? row.expenseType : undefined,
  id: String(row.id ?? ''),
  method: String(row.paymentMethod ?? row.method ?? 'cash'),
  notes: String(row.notes ?? ''),
  title: String(row.title ?? ''),
});

const DailyExpensesPage = (): JSX.Element => {
  const tReports = useTranslations('sidebar.reports');
  const tSidebar = useTranslations('sidebar');
  const [afnPerUsd, setAfnPerUsd] = useState(DEFAULT_AFN_PER_USD);
  const [form, setForm] = useState<DailyFormState>(() => createDefaultForm(DEFAULT_AFN_PER_USD));
  const [records, setRecords] = useState<DailyExpenseRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchAllExpenses = useCallback(async (): Promise<Array<Record<string, unknown>>> => {
    const rows: Array<Record<string, unknown>> = [];
    let page = 1;

    while (true) {
      const response = await client.get<PaginatedRowsResponse>('/api/v1/dental-management/expenses', {
        params: {
          include: ['staff'],
          page,
          perPage: API_MAX_PER_PAGE,
          sortBy: 'expenseDate',
          sortDirection: 'desc',
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
  }, []);

  const fetchExpenses = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      const allRows = await fetchAllExpenses();
      const rows = Array.isArray(allRows)
        ? allRows
          .map(normalizeExpenseRow)
          .filter((row) => (row.expenseType ?? 'daily') === 'daily')
        : [];
      setRecords(rows);
    } finally {
      setIsLoading(false);
    }
  }, [fetchAllExpenses]);

  useEffect(() => {
    void fetchExpenses();
  }, [fetchExpenses]);

  useEffect(() => {
    void getExchangeRate(client).then((rate) => {
      setAfnPerUsd(rate);
      setForm((prev) => ({ ...prev, exchangeRate: String(rate) }));
    });
  }, []);

  const totals = useMemo(() => {
    const today = toInputDate(new Date());
    const monthToken = today.slice(0, 7);

    return records.reduce(
      (acc, record) => {
        const amount = Number.isFinite(record.amount) ? record.amount : 0;
        acc.all += amount;
        if (record.date === today) {
          acc.today += amount;
        }
        if (record.date.startsWith(monthToken)) {
          acc.month += amount;
        }
        return acc;
      },
      { all: 0, month: 0, today: 0 }
    );
  }, [records]);

  const chartData = useMemo(() => {
    const grouped = new Map<string, number>();
    records.forEach((record) => {
      const current = grouped.get(record.date) ?? 0;
      grouped.set(record.date, current + record.amount);
    });

    return Array.from(grouped.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-14)
      .map(([date, amount]) => ({ amount, date }));
  }, [records]);

  const sortedRecords = useMemo(() => {
    return [...records].sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
    });
  }, [records]);

  const handleCreate = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    const amount = parseAmount(form.amount);
    if (!form.title.trim() || !form.date || amount <= 0) {
      return;
    }
    const exchangeRate = Math.max(0.000001, parseAmount(form.exchangeRate) || afnPerUsd);
    setIsSubmitting(true);
    void client
      .post('/api/v1/dental-management/expenses', {
        amount,
        category: form.category,
        currency: form.currency,
        exchangeRate,
        expenseDate: form.date,
        expenseType: 'daily',
        notes: form.notes.trim() || undefined,
        paymentMethod: form.method,
        title: form.title.trim(),
      })
      .then(async () => {
        setForm(createDefaultForm(afnPerUsd));
        await fetchExpenses();
        toast.success('Daily expense saved.');
      })
      .catch((error: unknown) => {
        toast.error(extractApiErrorMessage(error, 'Failed to save daily expense.'));
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  const removeRecord = (id: string): void => {
    void client
      .delete(`/api/v1/dental-management/expenses/${id}`)
      .then(async () => {
        await fetchExpenses();
        toast.success('Daily expense deleted.');
      })
      .catch((error: unknown) => {
        toast.error(extractApiErrorMessage(error, 'Failed to delete daily expense.'));
      });
  };

  return (
    <>
      <Header
        breadcrumbs={[
          { id: 'reports', label: tSidebar('reports.title') },
          { id: 'dailyExpenses', isCurrent: true, label: tReports('dailyExpenses') },
        ]}
      />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:px-6 md:py-6">
            <Card className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 via-background to-emerald-50">
              <CardHeader>
                <CardTitle className="inline-flex items-center gap-2">
                  <Wallet className="size-5 text-emerald-600" />
                  Daily Expenses Register
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
                <form onSubmit={handleCreate} className="grid gap-3 rounded-2xl border bg-background/80 p-4">
                  <div className="grid gap-1.5">
                    <Label htmlFor="expense-title">Expense Title</Label>
                    <Input
                      id="expense-title"
                      value={form.title}
                      onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                      placeholder="Electricity bill"
                      required
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-1.5">
                      <Label htmlFor="expense-date">Date</Label>
                      <Input
                        id="expense-date"
                        type="date"
                        value={form.date}
                        onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))}
                        required
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="expense-amount">Amount</Label>
                      <Input
                        id="expense-amount"
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.amount}
                        onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))}
                        placeholder="0.00"
                        required
                      />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-1.5">
                      <Label htmlFor="expense-currency">Currency</Label>
                      <select
                        id="expense-currency"
                        className="h-9 rounded-md border bg-background px-3 text-sm"
                        value={form.currency}
                        onChange={(event) => setForm((prev) => ({ ...prev, currency: event.target.value as 'AFN' | 'USD' }))}
                      >
                        <option value="USD">USD ($)</option>
                        <option value="AFN">AFN (Afghani)</option>
                      </select>
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="expense-exchange-rate">Exchange Rate (AFN per 1 USD)</Label>
                      <Input
                        id="expense-exchange-rate"
                        type="number"
                        min="0.0001"
                        step="0.0001"
                        value={form.exchangeRate}
                        onChange={(event) => setForm((prev) => ({ ...prev, exchangeRate: event.target.value }))}
                        required
                      />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-1.5">
                      <Label htmlFor="expense-category">Category</Label>
                      <select
                        id="expense-category"
                        className="h-9 rounded-md border bg-background px-3 text-sm"
                        value={form.category}
                        onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
                      >
                        {categoryOptions.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="expense-method">Payment Method</Label>
                      <select
                        id="expense-method"
                        className="h-9 rounded-md border bg-background px-3 text-sm"
                        value={form.method}
                        onChange={(event) => setForm((prev) => ({ ...prev, method: event.target.value }))}
                      >
                        {methodOptions.map((option) => (
                          <option key={option} value={option}>{option.replace('_', ' ')}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="expense-notes">Notes</Label>
                    <textarea
                      id="expense-notes"
                      className="min-h-20 rounded-md border bg-background px-3 py-2 text-sm"
                      value={form.notes}
                      onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                      placeholder="Optional note"
                    />
                  </div>
                  <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Add Daily Expense'}</Button>
                </form>

                <div className="grid gap-3">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border bg-white/80 p-3">
                      <p className="text-xs text-muted-foreground">Today</p>
                      <p className="text-lg font-semibold">{formatDualFromUsd(totals.today, afnPerUsd)}</p>
                    </div>
                    <div className="rounded-xl border bg-white/80 p-3">
                      <p className="text-xs text-muted-foreground">This Month</p>
                      <p className="text-lg font-semibold">{formatDualFromUsd(totals.month, afnPerUsd)}</p>
                    </div>
                    <div className="rounded-xl border bg-white/80 p-3">
                      <p className="text-xs text-muted-foreground">All Time</p>
                      <p className="text-lg font-semibold">{formatDualFromUsd(totals.all, afnPerUsd)}</p>
                    </div>
                  </div>

                  <div className="h-64 rounded-2xl border bg-white/85 p-3">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" hide={chartData.length > 8} />
                        <YAxis />
                        <Tooltip formatter={(value) => formatCurrency(Number(value), 'USD')} />
                        <Bar dataKey="amount" fill="#10b981" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border">
              <CardHeader>
                <CardTitle>Expense History</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                    Loading daily expense records...
                  </p>
                ) : sortedRecords.length === 0 ? (
                  <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                    No daily expense records yet.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="px-3 py-2">Date</th>
                          <th className="px-3 py-2">Title</th>
                          <th className="px-3 py-2">Category</th>
                          <th className="px-3 py-2">Method</th>
                          <th className="px-3 py-2">Amount</th>
                          <th className="px-3 py-2">Currency</th>
                          <th className="px-3 py-2">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedRecords.map((record) => (
                          <tr key={record.id} className="border-b">
                            <td className="px-3 py-2">{record.date}</td>
                            <td className="px-3 py-2">{record.title}</td>
                            <td className="px-3 py-2">{record.category}</td>
                            <td className="px-3 py-2 capitalize">{record.method.replace('_', ' ')}</td>
                            <td className="px-3 py-2 font-semibold">{formatDualFromUsd(record.amount, afnPerUsd)}</td>
                            <td className="px-3 py-2">
                              {formatCurrency(record.amountInput, record.currency)} ({record.currency})
                            </td>
                            <td className="px-3 py-2">
                              <Button type="button" variant="ghost" size="sm" onClick={() => removeRecord(record.id)}>
                                <Trash2 className="size-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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

export default DailyExpensesPage;

