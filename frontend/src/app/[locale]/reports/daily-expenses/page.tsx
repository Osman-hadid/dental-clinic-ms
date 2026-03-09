'use client';

import { FormEvent, JSX, useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Header } from '@/components/header';
import { LoadingState } from '@/components/shared/loading-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AxiosClient } from '@/modules/common/infrastructure/api/axios-client';
import { createDefaultReportRange, fetchReport, toInputDate } from '@/modules/dental-management/presentation/reports/report-client';
import { formatCurrency, parseMoney } from '@/lib/currency-utils';
import { Trash2, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

type DailyExpenseRecord = {
  amountInput: number;
  category: string;
  createdAt: string;
  expenseDate: string;
  id: number;
  method: string;
  notes: string;
  staffName: string;
  title: string;
};

type DailyExpenseReportResponse = {
  chart: Array<{ amount: number; date: string }>;
  history: {
    data: DailyExpenseRecord[];
    meta: {
      currentPage: number;
      lastPage: number;
      perPage: number;
      total: number;
    };
  };
  summary: {
    allTotal: number;
    monthTotal: number;
    todayTotal: number;
  };
};

type DailyFormState = {
  amount: string;
  category: string;
  date: string;
  method: string;
  notes: string;
  title: string;
};

const categoryOptions = ['all', 'Utilities', 'Salaries', 'Rent', 'Supplies', 'Maintenance', 'Other'];
const methodOptions = ['cash', 'card', 'bank_transfer', 'other'];

const createDefaultForm = (): DailyFormState => ({
  amount: '',
  category: 'Utilities',
  date: toInputDate(new Date()),
  method: 'cash',
  notes: '',
  title: '',
});

const extractApiErrorMessage = (error: unknown, fallback: string): string => {
  const response = (error as { response?: { data?: { error?: { code?: string; details?: Record<string, unknown>; message?: string } } } })?.response;
  const payload = response?.data?.error;
  const code = payload?.code;

  if (code === 'SAFE_BALANCE_INSUFFICIENT') {
    const currentBalance = Number(payload?.details?.currentBalance ?? 0);
    const requestedAmount = Number(payload?.details?.requestedAmount ?? 0);
    return `Safe balance is not enough. Current: ${formatCurrency(currentBalance, 'AFN')}. Requested: ${formatCurrency(requestedAmount, 'AFN')}.`;
  }

  return payload?.message || fallback;
};

const client = new AxiosClient();

const DailyExpensesPage = (): JSX.Element => {
  const tReports = useTranslations('sidebar.reports');
  const tSidebar = useTranslations('sidebar');
  const range = createDefaultReportRange(90);
  const [form, setForm] = useState<DailyFormState>(() => createDefaultForm());
  const [report, setReport] = useState<DailyExpenseReportResponse | null>(null);
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
      const data = await fetchReport<DailyExpenseReportResponse>('/api/v1/dental-management/reports/daily-expenses', {
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

  const handleCreate = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    const amount = parseMoney(form.amount);
    if (!form.title.trim() || !form.date || amount <= 0) {
      return;
    }

    setIsSubmitting(true);
    void client
      .post('/api/v1/dental-management/expenses', {
        amount,
        category: form.category,
        currency: 'AFN',
        exchangeRate: 1,
        expenseDate: form.date,
        expenseType: 'daily',
        notes: form.notes.trim() || undefined,
        paymentMethod: form.method,
        title: form.title.trim(),
      })
      .then(async () => {
        setForm(createDefaultForm());
        await fetchExpenses(1);
        toast.success('Daily expense saved.');
      })
      .catch((error: unknown) => {
        toast.error(extractApiErrorMessage(error, 'Failed to save daily expense.'));
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
                      <Label htmlFor="expense-category">Category</Label>
                      <select
                        id="expense-category"
                        className="h-9 rounded-md border bg-background px-3 text-sm"
                        value={form.category}
                        onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
                      >
                        {categoryOptions.filter((option) => option !== 'all').map((option) => (
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
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="expense-notes">Notes</Label>
                    <Input
                      id="expense-notes"
                      value={form.notes}
                      onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                      placeholder="Optional details"
                    />
                  </div>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Saving...' : 'Save Daily Expense'}
                  </Button>
                </form>

                <div className="grid gap-3">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border bg-background/80 p-4">
                      <p className="text-xs text-muted-foreground">Today</p>
                      <p className="text-2xl font-semibold">{formatCurrency(report?.summary.todayTotal ?? 0, 'AFN')}</p>
                    </div>
                    <div className="rounded-2xl border bg-background/80 p-4">
                      <p className="text-xs text-muted-foreground">This Month</p>
                      <p className="text-2xl font-semibold">{formatCurrency(report?.summary.monthTotal ?? 0, 'AFN')}</p>
                    </div>
                    <div className="rounded-2xl border bg-background/80 p-4">
                      <p className="text-xs text-muted-foreground">In Range</p>
                      <p className="text-2xl font-semibold">{formatCurrency(report?.summary.allTotal ?? 0, 'AFN')}</p>
                    </div>
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
                      <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Title, note, staff..." />
                    </div>
                    <div className="md:col-span-4">
                      <Button type="button" onClick={() => void fetchExpenses(1)}>Apply Filters</Button>
                    </div>
                  </div>

                  <div className="h-72 rounded-2xl border bg-background/80 p-3">
                    {isLoading ? (
                      <LoadingState compact title="Refreshing report" description="Fetching daily expense totals and history." />
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={report?.chart ?? []}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis />
                          <Tooltip formatter={(value) => formatCurrency(Number(value), 'AFN')} />
                          <Bar dataKey="amount" fill="#10b981" radius={[8, 8, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border">
              <CardHeader>
                <CardTitle>Expense History</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading && report === null ? (
                  <LoadingState compact title="Loading history" description="Fetching daily expense rows." />
                ) : (
                  <div className="space-y-4">
                    <div className="overflow-x-auto rounded-2xl border">
                      <table className="min-w-full text-sm">
                        <thead className="bg-muted/30 text-left text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2">Date</th>
                            <th className="px-3 py-2">Title</th>
                            <th className="px-3 py-2">Category</th>
                            <th className="px-3 py-2">Method</th>
                            <th className="px-3 py-2">Staff</th>
                            <th className="px-3 py-2">Amount</th>
                            <th className="px-3 py-2">Notes</th>
                            <th className="px-3 py-2">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(report?.history.data ?? []).map((record) => (
                            <tr key={record.id} className="border-t">
                              <td className="px-3 py-2">{record.expenseDate}</td>
                              <td className="px-3 py-2 font-medium">{record.title}</td>
                              <td className="px-3 py-2">{record.category}</td>
                              <td className="px-3 py-2">{record.method}</td>
                              <td className="px-3 py-2">{record.staffName || '-'}</td>
                              <td className="px-3 py-2">{formatCurrency(record.amountInput, 'AFN')}</td>
                              <td className="px-3 py-2">{record.notes || '-'}</td>
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

export default DailyExpensesPage;
